import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to subscribe to realtime team member changes.
 * When a member is added or removed from the current team,
 * the members list is automatically refreshed.
 * 
 * NOTE: We only reload members, NOT teams, to prevent redirect issues.
 */
export function useTeamMemberRealtime() {
    const { currentTeam, loadMembers } = useTeamStore();

    useEffect(() => {
        if (!currentTeam?.id) return;

        // Subscribe to team_members changes for the current team
        const channel = supabase
            .channel(`team_members:${currentTeam.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'team_members',
                    filter: `team_id=eq.${currentTeam.id}`,
                },
                (payload) => {
                    console.log('[Realtime] Team member change:', payload);
                    // Only reload members, not teams (to prevent redirect)
                    loadMembers(currentTeam.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentTeam?.id, loadMembers]);
}

/**
 * Hook to subscribe to user's team membership changes.
 * Only triggers when the current user is REMOVED from a team.
 * 
 * NOTE: Disabled aggressive reload to prevent UI flickering.
 * Users will need to refresh to see new team invites.
 */
export function useUserTeamsRealtime() {
    const { loadTeams } = useTeamStore();
    const { user } = useAuthStore();

    useEffect(() => {
        if (!user?.id) return;

        // Subscribe to DELETE events only for this user
        const channel = supabase
            .channel(`user_teams:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE', // Only listen for removals
                    schema: 'public',
                    table: 'team_members',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('[Realtime] User removed from team:', payload);
                    loadTeams();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, loadTeams]);
}
