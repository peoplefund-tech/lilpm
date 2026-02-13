/**
 * React Query hooks for team members
 * Replaces direct Zustand store fetching with cached, deduplicated queries
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './useQueryKeys';
import { teamMemberService } from '@/lib/services/team/teamMemberService';

export interface TeamMemberWithProfile {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  created_at: string;
  profile: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

/** Fetch team members with profiles */
async function fetchTeamMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
  const members = await teamMemberService.getMembers(teamId);
  return members as TeamMemberWithProfile[];
}

/**
 * Hook to fetch team members with profiles
 * Cached for 5 minutes, refetches on window focus
 */
export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.members(teamId || ''),
    queryFn: () => fetchTeamMembers(teamId!),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to invalidate team members cache
 * Useful after invite acceptance or member removal
 */
export function useInvalidateTeamMembers() {
  const queryClient = useQueryClient();

  return (teamId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
  };
}
