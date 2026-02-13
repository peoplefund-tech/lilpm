import { useCallback, useRef } from 'react';
import { Presence } from '@/stores/collaborationStore';

// TODO: Migrate to collab-server WebSocket at ws://localhost:3001
// Sidebar presence tracking is currently disabled during EKS migration

/**
 * Hook to track and broadcast user's current sidebar menu position
 * Shows team member avatars next to sidebar menu items in real-time
 *
 * TEMPORARILY DISABLED during EKS migration - returns empty presence data
 */
export function useSidebarPresence() {
    const presenceUsersRef = useRef<Map<string, Presence>>(new Map());

    // Generate consistent color for user
    const getUserColor = useCallback((userId: string): string => {
        const colors = [
            '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
            '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
        ];
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        }
        return colors[Math.abs(hash) % colors.length];
    }, []);

    // TODO: Implement WebSocket connection to collab-server
    // useEffect(() => {
    //     if (!user || !currentTeam) return;
    //
    //     const ws = new WebSocket(`ws://localhost:3001/collab/presence/${currentTeam.id}`);
    //
    //     ws.onopen = () => {
    //         ws.send(JSON.stringify({
    //             type: 'track',
    //             data: {
    //                 id: user.id,
    //                 name: user.name || user.email,
    //                 avatarUrl: user.avatarUrl,
    //                 color: getUserColor(user.id),
    //                 currentPath: location.pathname,
    //                 lastSeen: Date.now(),
    //             }
    //         }));
    //     };
    //
    //     ws.onmessage = (event) => {
    //         const message = JSON.parse(event.data);
    //         // Handle presence sync, join, leave events
    //         // Update presenceUsersRef and setSidebarPresenceUsers
    //     };
    //
    //     return () => ws.close();
    // }, [user?.id, currentTeam?.id, location.pathname]);

    // Get presence users for a specific path
    const getPresenceForPath = useCallback((path: string): Presence[] => {
        const users: Presence[] = [];
        presenceUsersRef.current.forEach((presence) => {
            // Match path exactly or as prefix
            if (presence.currentPath === path || presence.currentPath?.startsWith(path + '/')) {
                users.push(presence);
            }
        });
        return users;
    }, []);

    return {
        getPresenceForPath,
        presenceUsers: Array.from(presenceUsersRef.current.values()),
    };
}
