// TODO: Migrate to polling or WebSocket-based realtime updates
// Team realtime subscriptions are currently disabled during EKS migration

/**
 * Hook to subscribe to realtime team member changes.
 * When a member is added or removed from the current team,
 * the members list is automatically refreshed.
 *
 * TEMPORARILY DISABLED during EKS migration - use manual refresh instead
 *
 * TODO: Implement one of the following approaches:
 * 1. Polling: setInterval to fetch team members every 30-60s
 * 2. WebSocket: Connect to collab-server for real-time updates
 * 3. Server-Sent Events (SSE): Subscribe to /api/teams/:id/events
 */
export function useTeamMemberRealtime() {
    // No-op during migration
    // TODO: Implement polling or WebSocket subscription
    // Example polling approach:
    // useEffect(() => {
    //     if (!currentTeam?.id) return;
    //
    //     const interval = setInterval(() => {
    //         loadMembers(currentTeam.id);
    //     }, 30000); // Poll every 30 seconds
    //
    //     return () => clearInterval(interval);
    // }, [currentTeam?.id, loadMembers]);
}

/**
 * Hook to subscribe to user's team membership changes.
 * Only triggers when the current user is REMOVED from a team.
 *
 * TEMPORARILY DISABLED during EKS migration - users need to refresh manually
 *
 * TODO: Implement polling or WebSocket subscription for team membership changes
 */
export function useUserTeamsRealtime() {
    // No-op during migration
    // TODO: Implement polling or WebSocket subscription
    // Example polling approach:
    // useEffect(() => {
    //     if (!user?.id) return;
    //
    //     const interval = setInterval(() => {
    //         loadTeams();
    //     }, 60000); // Poll every 60 seconds
    //
    //     return () => clearInterval(interval);
    // }, [user?.id, loadTeams]);
}
