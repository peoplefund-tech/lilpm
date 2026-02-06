import { create } from 'zustand';
import type { Team, TeamMember, Project } from '@/types';
import type { Team as DbTeam, Project as DbProject } from '@/types/database';
import { teamService, teamMemberService } from '@/lib/services';
import { projectService } from '@/lib/services/projectService';

// Convert database Team to app Team type
const convertDbTeam = (dbTeam: DbTeam): Team => ({
  id: dbTeam.id,
  name: dbTeam.name,
  slug: dbTeam.slug,
  logoUrl: dbTeam.logo_url || undefined,
  createdAt: dbTeam.created_at,
  updatedAt: dbTeam.updated_at,
});

// Convert database Project to app Project type
const convertDbProject = (dbProject: DbProject): Project => ({
  id: dbProject.id,
  teamId: dbProject.team_id,
  name: dbProject.name,
  slug: dbProject.slug,
  description: dbProject.description || undefined,
  color: dbProject.color || undefined,
  icon: dbProject.icon || undefined,
  status: dbProject.status,
  startDate: dbProject.start_date || undefined,
  targetDate: dbProject.target_date || undefined,
  createdAt: dbProject.created_at,
  updatedAt: dbProject.updated_at,
});

interface TeamStore {
  teams: Team[];
  currentTeam: Team | null;
  members: TeamMember[];
  projects: Project[];
  isLoading: boolean;
  isSwitchingTeam: boolean;
  switchingToTeamName: string | null;
  error: string | null;

  // Actions
  loadTeams: () => Promise<void>;
  selectTeam: (teamId: string) => Promise<void>;
  createTeam: (name: string, slug: string, issuePrefix?: string) => Promise<Team>;
  updateTeam: (teamId: string, data: Partial<Team>) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;

  // Members
  loadMembers: (teamId: string) => Promise<void>;
  inviteMember: (teamId: string, email: string, role: string) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  updateMemberRole: (teamId: string, memberId: string, role: string) => Promise<void>;

  // Projects
  loadProjects: (teamId: string) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  currentTeam: null,
  members: [],
  projects: [],
  isLoading: false,
  isSwitchingTeam: false,
  switchingToTeamName: null,
  error: null,

  loadTeams: async () => {
    // Don't clear existing teams during refresh to prevent redirect flicker
    const existingTeams = get().teams;
    set({ isLoading: true, error: null });

    try {
      // Use teamService directly (bypasses non-existent REST API)
      const dbTeams = await teamService.getTeams();
      const teams = dbTeams.map(convertDbTeam);

      set({ teams, isLoading: false, error: null });

      // Try to restore last selected team from localStorage
      if (!get().currentTeam && teams.length > 0) {
        let teamToSelect = teams[0].id;

        try {
          const savedTeamId = localStorage.getItem('lily-current-team-id');
          if (savedTeamId && teams.find(t => t.id === savedTeamId)) {
            teamToSelect = savedTeamId;
          }
        } catch (e) {
          console.error('Failed to read team selection from localStorage:', e);
        }

        await get().selectTeam(teamToSelect);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      // Keep existing teams on error to prevent redirect
      set({
        teams: existingTeams.length > 0 ? existingTeams : [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load teams'
      });
    }
  },

  selectTeam: async (teamId: string) => {
    const team = get().teams.find(t => t.id === teamId);
    if (team) {
      // Don't show loading overlay if it's the same team
      const currentTeamId = get().currentTeam?.id;
      const isNewTeam = currentTeamId && currentTeamId !== teamId;

      if (isNewTeam) {
        set({ isSwitchingTeam: true, switchingToTeamName: team.name });
      }

      set({ currentTeam: team });

      // Save selected team to localStorage for persistence across refreshes
      try {
        localStorage.setItem('lily-current-team-id', teamId);
      } catch (e) {
        console.error('Failed to save team selection to localStorage:', e);
      }

      // Load members and projects in parallel, but don't block on errors
      try {
        await Promise.all([
          get().loadMembers(teamId),
          get().loadProjects(teamId),
        ]);
      } catch (error) {
        console.error('Failed to load team data:', error);
        // Don't throw - allow the dashboard to render even if these fail
      } finally {
        // Add a small delay for visual feedback
        if (isNewTeam) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        set({ isSwitchingTeam: false, switchingToTeamName: null });
      }
    }
  },

  createTeam: async (name: string, slug: string, issuePrefix?: string) => {
    set({ isLoading: true, error: null });

    try {
      // Use teamService which calls the RPC function (bypasses RLS)
      const dbTeam = await teamService.createTeam(name, slug, issuePrefix);
      const team = convertDbTeam(dbTeam);

      // Update store with new team and set as current
      set((state) => ({
        ...state,
        teams: [...state.teams, team],
        currentTeam: team,
        isLoading: false,
        error: null,
      }));

      return team;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create team';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateTeam: async (teamId: string, data: Partial<Team>) => {
    try {
      const dbTeam = await teamService.updateTeam(teamId, {
        name: data.name,
        slug: data.slug,
        logo_url: data.logoUrl,
      });
      const team = convertDbTeam(dbTeam);

      set((state) => ({
        teams: state.teams.map(t => t.id === teamId ? team : t),
        currentTeam: state.currentTeam?.id === teamId ? team : state.currentTeam,
      }));
    } catch (error) {
      console.error('Failed to update team:', error);
      throw error;
    }
  },

  deleteTeam: async (teamId: string) => {
    try {
      await teamService.deleteTeam(teamId);
      set((state) => ({
        teams: state.teams.filter(t => t.id !== teamId),
        currentTeam: state.currentTeam?.id === teamId ? null : state.currentTeam,
      }));
    } catch (error) {
      console.error('Failed to delete team:', error);
      throw error;
    }
  },

  loadMembers: async (teamId: string) => {
    try {
      const dbMembers = await teamMemberService.getMembers(teamId);
      // Convert to app TeamMember type
      const members: TeamMember[] = dbMembers.map(m => ({
        id: m.id,
        teamId: m.team_id,
        userId: m.user_id,
        role: m.role as any,
        joinedAt: m.joined_at,
        user: m.profile ? {
          id: m.profile.id,
          email: m.profile.email || '',
          name: m.profile.name || m.profile.email?.split('@')[0] || '',
          avatarUrl: m.profile.avatar_url || undefined,
          role: m.role as any,
          createdAt: m.profile.created_at,
          updatedAt: m.profile.updated_at,
        } : {
          id: m.user_id,
          email: '',
          name: 'Unknown',
          role: 'member' as const,
          createdAt: m.joined_at,
          updatedAt: m.joined_at,
        },
      }));
      set({ members });
    } catch (error) {
      console.error('Failed to load members:', error);
      // Set empty members on error, don't throw
      set({ members: [] });
    }
  },

  inviteMember: async (teamId: string, email: string, role: string) => {
    try {
      const { teamInviteService } = await import('@/lib/services/teamService');
      await teamInviteService.createInvite(teamId, email, role as any);
    } catch (error) {
      console.error('Failed to invite member:', error);
      throw error;
    }
  },

  removeMember: async (teamId: string, memberId: string) => {
    try {
      await teamMemberService.removeMember(memberId);
      set((state) => ({
        members: state.members.filter(m => m.id !== memberId),
      }));
    } catch (error) {
      console.error('Failed to remove member:', error);
      throw error;
    }
  },

  updateMemberRole: async (teamId: string, memberId: string, role: string) => {
    try {
      await teamMemberService.updateMemberRole(memberId, role as any);
      set((state) => ({
        members: state.members.map(m =>
          m.id === memberId ? { ...m, role: role as any } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to update member role:', error);
      throw error;
    }
  },

  loadProjects: async (teamId: string) => {
    try {
      const dbProjects = await projectService.getProjects(teamId);
      const projects = dbProjects.map(convertDbProject);
      set({ projects });
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Set empty projects on error, don't throw
      set({ projects: [] });
    }
  },

  createProject: async (data: Partial<Project>) => {
    const teamId = get().currentTeam?.id;
    if (!teamId) throw new Error('No team selected');

    try {
      const dbProject = await projectService.createProject(teamId, {
        name: data.name || 'Untitled Project',
        description: data.description,
        color: data.color,
        icon: data.icon,
        start_date: data.startDate,
        target_date: data.targetDate,
      });

      const project = convertDbProject(dbProject);

      set((state) => ({
        projects: [...state.projects, project],
      }));
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  },

  updateProject: async (projectId: string, data: Partial<Project>) => {
    try {
      const dbProject = await projectService.updateProject(projectId, {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        status: data.status as any,
        start_date: data.startDate,
        target_date: data.targetDate,
      });
      const project = convertDbProject(dbProject);

      set((state) => ({
        projects: state.projects.map(p => p.id === projectId ? project : p),
      }));
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      set((state) => ({
        projects: state.projects.filter(p => p.id !== projectId),
      }));
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  },
}));
