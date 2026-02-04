import { supabase } from '@/lib/supabase';
import type { 
  Issue, 
  IssueStatus, 
  IssuePriority,
  Label,
  Comment,
  Activity,
  ActivityType,
  Profile,
  Project
} from '@/types/database';

// Extended types with relations
export interface IssueWithRelations extends Issue {
  assignee?: Profile | null;
  creator?: Profile | null;
  project?: Project | null;
  labels?: Label[];
}

export interface CommentWithUser extends Comment {
  user: Profile;
}

export interface ActivityWithUser extends Activity {
  user: Profile | null;
}

// ============================================
// ISSUE SERVICES
// ============================================

export const issueService = {
  async getIssues(
    teamId: string, 
    filters?: {
      status?: IssueStatus[];
      priority?: IssuePriority[];
      assignee_id?: string[];
      project_id?: string[];
      search?: string;
    }
  ): Promise<IssueWithRelations[]> {
    let query = supabase
      .from('issues')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (filters?.status?.length) {
      query = query.in('status', filters.status);
    }
    if (filters?.priority?.length) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.assignee_id?.length) {
      query = query.in('assignee_id', filters.assignee_id);
    }
    if (filters?.project_id?.length) {
      query = query.in('project_id', filters.project_id);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,identifier.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as unknown as IssueWithRelations[];
  },

  async getIssue(issueId: string): Promise<IssueWithRelations | null> {
    const { data, error } = await supabase
      .from('issues')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('id', issueId)
      .single();
    
    if (error) throw error;
    return data as unknown as IssueWithRelations;
  },

  async createIssue(
    teamId: string,
    issueData: {
      title: string;
      description?: string;
      status?: IssueStatus;
      priority?: IssuePriority;
      project_id?: string;
      cycle_id?: string;
      assignee_id?: string;
      estimate?: number;
      due_date?: string;
      parent_id?: string;
    }
  ): Promise<Issue> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate identifier using the database function
    const { data: identifier, error: idError } = await supabase
      .rpc('generate_issue_identifier', { _team_id: teamId } as any);
    
    if (idError) throw idError;

    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        team_id: teamId,
        identifier: identifier as string,
        title: issueData.title,
        description: issueData.description,
        status: issueData.status || 'backlog',
        priority: issueData.priority || 'none',
        project_id: issueData.project_id,
        cycle_id: issueData.cycle_id,
        assignee_id: issueData.assignee_id,
        creator_id: user.id,
        estimate: issueData.estimate,
        due_date: issueData.due_date,
        parent_id: issueData.parent_id,
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    if (!issue) throw new Error('Failed to create issue');

    // Create activity
    await activityService.createActivity((issue as Issue).id, 'issue_created', {
      title: (issue as Issue).title,
    });

    return issue as Issue;
  },

  async updateIssue(issueId: string, updates: Partial<Issue>): Promise<Issue> {
    // Get current issue for activity tracking
    const { data: current } = await supabase
      .from('issues')
      .select('*')
      .eq('id', issueId)
      .single();

    // Prepare updates - ensure type is included if provided
    const dbUpdates: Record<string, any> = { ...updates };
    
    const { data, error } = await supabase
      .from('issues')
      .update(dbUpdates)
      .eq('id', issueId)
      .select()
      .single();
    
    if (error) throw error;

    // Create activities for tracked changes
    if (current) {
      const curr = current as Issue;
      if (updates.status && updates.status !== curr.status) {
        await activityService.createActivity(issueId, 'status_changed', {
          from: curr.status,
          to: updates.status,
        });
      }
      if (updates.priority && updates.priority !== curr.priority) {
        await activityService.createActivity(issueId, 'priority_changed', {
          from: curr.priority,
          to: updates.priority,
        });
      }
      if (updates.assignee_id !== undefined && updates.assignee_id !== curr.assignee_id) {
        await activityService.createActivity(issueId, 'assignee_changed', {
          from: curr.assignee_id,
          to: updates.assignee_id,
        });
      }
      // Track type changes
      if ((updates as any).type && (updates as any).type !== (curr as any).type) {
        await activityService.createActivity(issueId, 'type_changed' as any, {
          from: (curr as any).type,
          to: (updates as any).type,
        });
      }
    }

    return data as Issue;
  },

  async deleteIssue(issueId: string): Promise<void> {
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueId);
    
    if (error) throw error;
  },

  async batchUpdateIssues(issueIds: string[], updates: Partial<Issue>): Promise<void> {
    const { error } = await supabase
      .from('issues')
      .update(updates as any)
      .in('id', issueIds);
    
    if (error) throw error;
  },

  async getSubIssues(parentId: string): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return (data || []) as Issue[];
  },
};

// ============================================
// LABEL SERVICES
// ============================================

export const labelService = {
  async getLabels(teamId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true });
    
    if (error) throw error;
    return (data || []) as Label[];
  },

  async createLabel(teamId: string, name: string, color: string, description?: string): Promise<Label> {
    const { data, error } = await supabase
      .from('labels')
      .insert({ team_id: teamId, name, color, description } as any)
      .select()
      .single();
    
    if (error) throw error;
    return data as Label;
  },

  async updateLabel(labelId: string, updates: Partial<Label>): Promise<Label> {
    const { data, error } = await supabase
      .from('labels')
      .update(updates as any)
      .eq('id', labelId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Label;
  },

  async deleteLabel(labelId: string): Promise<void> {
    const { error } = await supabase
      .from('labels')
      .delete()
      .eq('id', labelId);
    
    if (error) throw error;
  },

  async addLabelToIssue(issueId: string, labelId: string): Promise<void> {
    const { error } = await supabase
      .from('issue_labels')
      .insert({ issue_id: issueId, label_id: labelId } as any);
    
    if (error && error.code !== '23505') throw error; // Ignore duplicate

    await activityService.createActivity(issueId, 'label_added', { label_id: labelId });
  },

  async removeLabelFromIssue(issueId: string, labelId: string): Promise<void> {
    const { error } = await supabase
      .from('issue_labels')
      .delete()
      .eq('issue_id', issueId)
      .eq('label_id', labelId);
    
    if (error) throw error;

    await activityService.createActivity(issueId, 'label_removed', { label_id: labelId });
  },

  async getIssueLabels(issueId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('issue_labels')
      .select('label:labels(*)')
      .eq('issue_id', issueId);
    
    if (error) throw error;
    return (data || []).map(d => (d as any).label as Label);
  },
};

// ============================================
// COMMENT SERVICES
// ============================================

export const commentService = {
  async getComments(issueId: string): Promise<CommentWithUser[]> {
    // First get comments
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });
    
    if (commentsError) throw commentsError;
    if (!commentsData || commentsData.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];
    
    // Fetch profiles separately
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    
    const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
    
    // Combine comments with user profiles
    return commentsData.map(comment => ({
      ...comment,
      user: profilesMap.get(comment.user_id) || null,
    })) as unknown as CommentWithUser[];
  },

  async createComment(issueId: string, body: string): Promise<Comment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        issue_id: issueId,
        user_id: user.id,
        body,
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to create comment');

    await activityService.createActivity(issueId, 'comment_added', { comment_id: (data as Comment).id });

    return data as Comment;
  },

  async updateComment(commentId: string, body: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .update({ body } as any)
      .eq('id', commentId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Comment;
  },

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
    
    if (error) throw error;
  },
};

// ============================================
// ACTIVITY SERVICES
// ============================================

export const activityService = {
  async getActivities(issueId: string): Promise<ActivityWithUser[]> {
    // First get activities
    const { data: activitiesData, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });
    
    if (activitiesError) throw activitiesError;
    if (!activitiesData || activitiesData.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(activitiesData.map(a => a.user_id).filter(Boolean))];
    
    // Fetch profiles separately
    const { data: profilesData } = userIds.length > 0 
      ? await supabase.from('profiles').select('*').in('id', userIds)
      : { data: [] };
    
    const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
    
    // Combine activities with user profiles
    return activitiesData.map(activity => ({
      ...activity,
      user: activity.user_id ? profilesMap.get(activity.user_id) || null : null,
    })) as unknown as ActivityWithUser[];
  },

  async createActivity(
    issueId: string, 
    type: ActivityType, 
    activityData: Record<string, unknown>
  ): Promise<Activity> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('activities')
      .insert({
        issue_id: issueId,
        user_id: user?.id,
        type,
        data: activityData,
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return data as Activity;
  },

  async getTeamActivities(teamId: string, limit = 50): Promise<ActivityWithUser[]> {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        user:profiles(*),
        issue:issues!inner(team_id, identifier, title)
      `)
      .eq('issue.team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as unknown as ActivityWithUser[];
  },
};
