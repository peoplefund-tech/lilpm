/**
 * Centralized React Query key factory
 * Ensures consistent cache key management across all queries
 *
 * Usage:
 *   queryKey: queryKeys.teams.all
 *   queryKey: queryKeys.issues.list(teamId, filters)
 *   queryKey: queryKeys.projects.detail(projectId)
 */

export const queryKeys = {
  // Team queries
  teams: {
    all: ['teams'] as const,
    detail: (teamId: string) => ['teams', teamId] as const,
    members: (teamId: string) => ['teams', teamId, 'members'] as const,
  },

  // Project queries
  projects: {
    all: (teamId: string) => ['projects', teamId] as const,
    detail: (projectId: string) => ['projects', 'detail', projectId] as const,
    members: (projectId: string) => ['projects', projectId, 'members'] as const,
  },

  // Issue queries
  issues: {
    all: (teamId: string) => ['issues', teamId] as const,
    list: (teamId: string, filters?: Record<string, unknown>) =>
      ['issues', teamId, 'list', filters ?? {}] as const,
    detail: (issueId: string) => ['issues', 'detail', issueId] as const,
    archived: (teamId: string) => ['issues', teamId, 'archived'] as const,
  },

  // Cycle queries
  cycles: {
    all: (teamId: string) => ['cycles', teamId] as const,
    detail: (cycleId: string) => ['cycles', 'detail', cycleId] as const,
  },

  // PRD queries
  prds: {
    all: (teamId: string) => ['prds', teamId] as const,
    detail: (prdId: string) => ['prds', 'detail', prdId] as const,
  },

  // Notification queries
  notifications: {
    all: (userId: string) => ['notifications', userId] as const,
    unread: (userId: string) => ['notifications', userId, 'unread'] as const,
  },

  // Conversation queries
  conversations: {
    all: (teamId: string) => ['conversations', teamId] as const,
    detail: (conversationId: string) => ['conversations', 'detail', conversationId] as const,
    messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
  },

  // Activity queries
  activities: {
    team: (teamId: string) => ['activities', 'team', teamId] as const,
    issue: (issueId: string) => ['activities', 'issue', issueId] as const,
  },

  // User queries
  user: {
    profile: (userId: string) => ['user', userId, 'profile'] as const,
    settings: (userId: string) => ['user', userId, 'settings'] as const,
  },
} as const;
