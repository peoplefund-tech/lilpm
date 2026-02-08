import { create } from 'zustand';
import type { Issue, ViewPreferences, ViewFilters } from '@/types';
import { issueService, dependencyService } from '@/lib/services/issueService';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface IssueStore {
  issues: Issue[];
  selectedIssue: Issue | null;
  isLoading: boolean;
  error: string | null;
  viewPreferences: ViewPreferences;
  realtimeChannel: RealtimeChannel | null;

  // Actions
  loadIssues: (teamId: string, filters?: ViewFilters) => Promise<void>;
  selectIssue: (issueId: string | null) => void;
  createIssue: (teamId: string, data: Partial<Issue>) => Promise<Issue>;
  updateIssue: (issueId: string, data: Partial<Issue>) => Promise<void>;
  deleteIssue: (issueId: string) => Promise<void>;
  archiveIssue: (issueId: string) => Promise<void>;
  archiveIssues: (issueIds: string[]) => Promise<void>;
  batchUpdateIssues: (issueIds: string[], data: Partial<Issue>) => Promise<void>;

  // View preferences
  setViewPreferences: (prefs: Partial<ViewPreferences>) => void;
  setFilters: (filters: Partial<ViewFilters>) => void;

  // Real-time
  subscribeToChanges: (teamId: string) => void;
  unsubscribe: () => void;
  handleRemoteUpdate: (issueId: string, changes: Partial<Issue>) => void;
  createDependency: (sourceIssueId: string, targetIssueId: string) => Promise<void>;
  deleteDependency: (sourceIssueId: string, targetIssueId: string) => Promise<void>;
}
const VIEW_PREFS_STORAGE_KEY = 'lilpm_issue_view_preferences';

const defaultViewPreferences: ViewPreferences = {
  layout: 'list',
  groupBy: 'status',
  sortBy: 'created',
  sortOrder: 'desc',
  filters: {},
};

// Load persisted preferences from localStorage
const loadPersistedPreferences = (): ViewPreferences => {
  try {
    const stored = localStorage.getItem(VIEW_PREFS_STORAGE_KEY);
    if (stored) {
      return { ...defaultViewPreferences, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load view preferences:', e);
  }
  return defaultViewPreferences;
};

export const useIssueStore = create<IssueStore>((set, get) => ({
  issues: [],
  selectedIssue: null,
  isLoading: false,
  error: null,
  viewPreferences: loadPersistedPreferences(),
  realtimeChannel: null,

  loadIssues: async (teamId: string, filters?: ViewFilters) => {
    set({ isLoading: true, error: null });

    try {
      const issues = await issueService.getIssues(teamId, {
        status: filters?.status,
        priority: filters?.priority,
        assignee_id: filters?.assigneeId,
        project_id: filters?.projectId,
      });

      // Fetch dependencies
      let dependencies: any[] = [];
      try {
        dependencies = await dependencyService.getDependencies(teamId);
      } catch (depError) {
        console.warn('Failed to load dependencies:', depError);
        // Continue loading issues even if dependencies fail
      }


      // Map to frontend Issue type
      const mappedIssues: Issue[] = issues.map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || undefined,
        type: (issue as any).type || 'task',
        status: issue.status,
        priority: issue.priority,
        teamId: issue.team_id,
        projectId: issue.project_id || undefined,
        cycleId: issue.cycle_id || undefined,
        assigneeId: issue.assignee_id || undefined,
        creatorId: issue.creator_id,
        parentId: issue.parent_id || undefined,
        estimate: issue.estimate || undefined,
        dueDate: issue.due_date || undefined,
        sortOrder: issue.sort_order,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: [],
        acceptanceCriteria: (issue as any).acceptance_criteria || undefined,
        // Relations
        assignee: issue.assignee ? {
          id: issue.assignee.id,
          email: issue.assignee.email || '',
          name: issue.assignee.name || '',
          avatarUrl: issue.assignee.avatar_url || undefined,
          role: 'member',
          createdAt: issue.assignee.created_at,
          updatedAt: issue.assignee.updated_at,
        } : undefined,
        creator: issue.creator ? {
          id: issue.creator.id,
          email: issue.creator.email || '',
          name: issue.creator.name || '',
          avatarUrl: issue.creator.avatar_url || undefined,
          role: 'member',
          createdAt: issue.creator.created_at,
          updatedAt: issue.creator.updated_at,
        } : undefined,
        // Map dependencies
        blockedBy: dependencies
          .filter((d: any) => d.target_issue_id === issue.id)
          .map((d: any) => ({
            id: d.id,
            sourceIssueId: d.source_issue_id,
            targetIssueId: d.target_issue_id,
            createdAt: d.created_at,
          })),
        blocking: dependencies
          .filter((d: any) => d.source_issue_id === issue.id)
          .map((d: any) => ({
            id: d.id,
            sourceIssueId: d.source_issue_id,
            targetIssueId: d.target_issue_id,
            createdAt: d.created_at,
          })),
      }));

      set({ issues: mappedIssues, isLoading: false });
    } catch (error) {
      console.error('Failed to load issues:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load issues',
        isLoading: false
      });
    }
  },

  selectIssue: (issueId: string | null) => {
    if (issueId === null) {
      set({ selectedIssue: null });
    } else {
      const issue = get().issues.find(i => i.id === issueId);
      set({ selectedIssue: issue || null });
    }
  },

  createIssue: async (teamId: string, data: Partial<Issue>) => {
    set({ isLoading: true, error: null });

    try {
      const created = await issueService.createIssue(teamId, {
        title: data.title || 'New Issue',
        description: data.description,
        status: data.status,
        priority: data.priority,
        project_id: data.projectId,
        cycle_id: data.cycleId,
        assignee_id: data.assigneeId,
        estimate: data.estimate,
        due_date: data.dueDate,
        parent_id: data.parentId,
      });

      const newIssue: Issue = {
        id: created.id,
        identifier: created.identifier,
        title: created.title,
        description: created.description || undefined,
        type: (created as any).type || 'task',
        status: created.status,
        priority: created.priority,
        teamId: created.team_id,
        projectId: created.project_id || undefined,
        cycleId: created.cycle_id || undefined,
        assigneeId: created.assignee_id || undefined,
        creatorId: created.creator_id,
        parentId: created.parent_id || undefined,
        estimate: created.estimate || undefined,
        dueDate: created.due_date || undefined,
        sortOrder: created.sort_order,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
        labels: [],
        acceptanceCriteria: (created as any).acceptance_criteria || undefined,
      };

      set((state) => ({
        issues: [newIssue, ...state.issues],
        isLoading: false,
      }));

      return newIssue;
    } catch (error) {
      console.error('Failed to create issue:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to create issue',
        isLoading: false
      });
      throw error;
    }
  },

  updateIssue: async (issueId: string, data: Partial<Issue>) => {
    // Optimistic update
    const previousIssues = get().issues;

    set((state) => ({
      issues: state.issues.map(i =>
        i.id === issueId ? { ...i, ...data } : i
      ),
      selectedIssue: state.selectedIssue?.id === issueId
        ? { ...state.selectedIssue, ...data }
        : state.selectedIssue,
    }));

    try {
      // Map to database format
      // Map to database format, only including defined fields
      const payload: any = {};
      if (data.title !== undefined) payload.title = data.title;
      if (data.description !== undefined) payload.description = data.description;
      if (data.status !== undefined) payload.status = data.status;
      if (data.priority !== undefined) payload.priority = data.priority;
      if (data.projectId !== undefined) payload.project_id = data.projectId;
      if (data.cycleId !== undefined) payload.cycle_id = data.cycleId;
      if (data.assigneeId !== undefined) payload.assignee_id = data.assigneeId;
      if (data.estimate !== undefined) payload.estimate = data.estimate;
      if (data.dueDate !== undefined) payload.due_date = data.dueDate;
      if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;

      await issueService.updateIssue(issueId, payload);
    } catch (error) {
      console.error('Failed to update issue:', error);
      // Revert on failure
      set({
        issues: previousIssues,
        error: error instanceof Error ? error.message : 'Failed to update issue',
      });
    }
  },

  deleteIssue: async (issueId: string) => {
    const previousIssues = get().issues;

    // Optimistic delete
    set((state) => ({
      issues: state.issues.filter(i => i.id !== issueId),
      selectedIssue: state.selectedIssue?.id === issueId ? null : state.selectedIssue,
    }));

    try {
      await issueService.deleteIssue(issueId);
    } catch (error) {
      console.error('Failed to delete issue:', error);
      // Revert on failure
      set({
        issues: previousIssues,
        error: error instanceof Error ? error.message : 'Failed to delete issue',
      });
    }
  },

  batchUpdateIssues: async (issueIds: string[], data: Partial<Issue>) => {
    const previousIssues = get().issues;

    // Optimistic update
    set((state) => ({
      issues: state.issues.map(i =>
        issueIds.includes(i.id) ? { ...i, ...data } : i
      ),
    }));

    try {
      await issueService.batchUpdateIssues(issueIds, {
        status: data.status,
        priority: data.priority,
        assignee_id: data.assigneeId,
      } as any);
    } catch (error) {
      console.error('Failed to batch update issues:', error);
      set({
        issues: previousIssues,
        error: error instanceof Error ? error.message : 'Failed to update issues',
      });
    }
  },

  archiveIssue: async (issueId: string) => {
    const previousIssues = get().issues;

    // Optimistic removal from list
    set((state) => ({
      issues: state.issues.filter(i => i.id !== issueId),
      selectedIssue: state.selectedIssue?.id === issueId ? null : state.selectedIssue,
    }));

    try {
      // Set archived_at timestamp
      await supabase
        .from('issues')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', issueId);
    } catch (error) {
      console.error('Failed to archive issue:', error);
      // Revert on failure
      set({
        issues: previousIssues,
        error: error instanceof Error ? error.message : 'Failed to archive issue',
      });
    }
  },

  archiveIssues: async (issueIds: string[]) => {
    const previousIssues = get().issues;

    // Optimistic removal from list
    set((state) => ({
      issues: state.issues.filter(i => !issueIds.includes(i.id)),
      selectedIssue: state.selectedIssue && issueIds.includes(state.selectedIssue.id)
        ? null
        : state.selectedIssue,
    }));

    try {
      // Set archived_at timestamp for all issues
      await supabase
        .from('issues')
        .update({ archived_at: new Date().toISOString() })
        .in('id', issueIds);
    } catch (error) {
      console.error('Failed to archive issues:', error);
      // Revert on failure
      set({
        issues: previousIssues,
        error: error instanceof Error ? error.message : 'Failed to archive issues',
      });
    }
  },

  setViewPreferences: (prefs: Partial<ViewPreferences>) => {
    set((state) => {
      const newPrefs = { ...state.viewPreferences, ...prefs };
      // Persist to localStorage (exclude filters)
      try {
        const toStore = { layout: newPrefs.layout, groupBy: newPrefs.groupBy, sortBy: newPrefs.sortBy, sortOrder: newPrefs.sortOrder };
        localStorage.setItem(VIEW_PREFS_STORAGE_KEY, JSON.stringify(toStore));
      } catch (e) {
        console.warn('Failed to save view preferences:', e);
      }
      return { viewPreferences: newPrefs };
    });
  },

  setFilters: (filters: Partial<ViewFilters>) => {
    set((state) => ({
      viewPreferences: {
        ...state.viewPreferences,
        filters: { ...state.viewPreferences.filters, ...filters },
      },
    }));
  },

  subscribeToChanges: (teamId: string) => {
    const { realtimeChannel } = get();

    // Cleanup existing subscription
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    // Subscribe to issue changes for this team
    const channel = supabase
      .channel(`issues:team_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT' && newRecord) {
            const issue = newRecord as any;
            const newIssue: Issue = {
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              description: issue.description,
              type: issue.type || 'task',
              status: issue.status,
              priority: issue.priority,
              teamId: issue.team_id,
              projectId: issue.project_id,
              cycleId: issue.cycle_id,
              assigneeId: issue.assignee_id,
              creatorId: issue.creator_id,
              parentId: issue.parent_id,
              estimate: issue.estimate,
              dueDate: issue.due_date,
              sortOrder: issue.sort_order,
              createdAt: issue.created_at,
              updatedAt: issue.updated_at,
              labels: [],
              acceptanceCriteria: issue.acceptance_criteria || undefined,
            };

            set((state) => {
              // Avoid duplicates
              if (state.issues.some(i => i.id === newIssue.id)) return state;
              return { issues: [newIssue, ...state.issues] };
            });
          } else if (eventType === 'UPDATE' && newRecord) {
            const issue = newRecord as any;
            set((state) => ({
              issues: state.issues.map(i =>
                i.id === issue.id
                  ? {
                    ...i,
                    title: issue.title,
                    description: issue.description,
                    status: issue.status,
                    priority: issue.priority,
                    assigneeId: issue.assignee_id,
                    sortOrder: issue.sort_order,
                    dueDate: issue.due_date,
                    updatedAt: issue.updated_at,
                  }
                  : i
              ),
            }));
          } else if (eventType === 'DELETE' && oldRecord) {
            set((state) => ({
              issues: state.issues.filter(i => i.id !== (oldRecord as any).id),
            }));
          }
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribe: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  handleRemoteUpdate: (issueId: string, changes: Partial<Issue>) => {
    set((state) => ({
      issues: state.issues.map(i =>
        i.id === issueId ? { ...i, ...changes } : i
      ),
      selectedIssue: state.selectedIssue?.id === issueId
        ? { ...state.selectedIssue, ...changes }
        : state.selectedIssue,
    }));
  },

  createDependency: async (sourceIssueId: string, targetIssueId: string) => {
    try {
      // Optimistic update
      const dep = await dependencyService.createDependency(sourceIssueId, targetIssueId);

      set((state) => ({
        issues: state.issues.map(issue => {
          if (issue.id === sourceIssueId) {
            return {
              ...issue,
              blocking: [...(issue.blocking || []), {
                id: dep.id,
                sourceIssueId,
                targetIssueId,
                createdAt: dep.created_at
              }]
            };
          }
          if (issue.id === targetIssueId) {
            return {
              ...issue,
              blockedBy: [...(issue.blockedBy || []), {
                id: dep.id,
                sourceIssueId,
                targetIssueId,
                createdAt: dep.created_at
              }]
            };
          }
          return issue;
        })
      }));
    } catch (error) {
      console.error('Failed to create dependency:', error);
      throw error;
    }
  },

  deleteDependency: async (sourceIssueId: string, targetIssueId: string) => {
    try {
      await dependencyService.deleteDependency(sourceIssueId, targetIssueId);

      set((state) => ({
        issues: state.issues.map(issue => {
          if (issue.id === sourceIssueId) {
            return {
              ...issue,
              blocking: (issue.blocking || []).filter(d => d.targetIssueId !== targetIssueId)
            };
          }
          if (issue.id === targetIssueId) {
            return {
              ...issue,
              blockedBy: (issue.blockedBy || []).filter(d => d.sourceIssueId !== sourceIssueId)
            };
          }
          return issue;
        })
      }));
    } catch (error) {
      console.error('Failed to delete dependency:', error);
      throw error;
    }
  },
}));
