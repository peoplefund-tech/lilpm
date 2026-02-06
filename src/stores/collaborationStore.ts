import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Presence {
  odId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  focusedIssueId?: string;
  isEditing?: boolean;
  isTyping?: boolean;
  lastActivity?: number;
  color: string;
}

interface CollaborationStore {
  isConnected: boolean;
  roomId: string | null;
  channel: RealtimeChannel | null;
  users: Presence[];
  myPresence: Partial<Presence>;

  // Actions
  joinRoom: (roomId: string, userInfo: { id: string; name: string; avatarUrl?: string }) => Promise<void>;
  leaveRoom: () => void;
  updatePresence: (presence: Partial<Presence>) => void;
  setFocusedIssue: (issueId: string | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  updateCursor: (position: { x: number; y: number }) => void;
  broadcastIssueUpdate: (issueId: string, changes: Record<string, unknown>) => void;
}

const PRESENCE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
];

function getRandomColor(): string {
  return PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  isConnected: false,
  roomId: null,
  channel: null,
  users: [],
  myPresence: {
    color: getRandomColor(),
  },

  joinRoom: async (roomId: string, userInfo: { id: string; name: string; avatarUrl?: string }) => {
    // Leave existing room first
    get().leaveRoom();

    const myPresence: Presence = {
      odId: userInfo.id,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      color: get().myPresence.color || getRandomColor(),
    };

    // Create Supabase Realtime channel with Presence
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: userInfo.id,
        },
      },
    });

    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<Presence>();
      const users: Presence[] = [];
      
      Object.entries(state).forEach(([key, presences]) => {
        if (key !== userInfo.id && presences.length > 0) {
          users.push(presences[0] as unknown as Presence);
        }
      });
      
      set({ users });
    });

    // Handle presence join
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key !== userInfo.id && newPresences.length > 0) {
        const presence = newPresences[0] as unknown as Presence;
        set((state) => ({
          users: [...state.users.filter((u) => u.odId !== presence.odId), presence],
        }));
        
        // Emit join event for toast notification
        window.dispatchEvent(new CustomEvent('collaboration:user:joined', { 
          detail: { name: presence.name } 
        }));
      }
    });

    // Handle presence leave
    channel.on('presence', { event: 'leave' }, ({ key }) => {
      const leavingUser = get().users.find(u => u.odId === key);
      set((state) => ({
        users: state.users.filter((u) => u.odId !== key),
      }));
      
      // Emit leave event for toast notification
      if (leavingUser) {
        window.dispatchEvent(new CustomEvent('collaboration:user:left', { 
          detail: { name: leavingUser.name } 
        }));
      }
    });

    // Handle broadcast messages (issue updates)
    channel.on('broadcast', { event: 'issue:update' }, ({ payload }) => {
      // Emit custom event that issueStore can listen to
      window.dispatchEvent(new CustomEvent('realtime:issue:update', { detail: payload }));
    });

    // Handle cursor updates via broadcast
    channel.on('broadcast', { event: 'cursor:update' }, ({ payload }) => {
      const { odId, cursor } = payload as { odId: string; cursor: { x: number; y: number } };
      set((state) => ({
        users: state.users.map((u) =>
          u.odId === odId ? { ...u, cursor } : u
        ),
      }));
    });

    // Subscribe to channel
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track presence
        await channel.track(myPresence);
        set({ isConnected: true, roomId, channel, myPresence });
      }
    });
  },

  leaveRoom: () => {
    const { channel } = get();
    if (channel) {
      channel.untrack();
      supabase.removeChannel(channel);
    }
    set({ isConnected: false, roomId: null, channel: null, users: [] });
  },

  updatePresence: (presence: Partial<Presence>) => {
    const { channel, myPresence } = get();
    const newPresence = { ...myPresence, ...presence };
    set({ myPresence: newPresence });
    
    if (channel) {
      channel.track(newPresence);
    }
  },

  setFocusedIssue: (issueId: string | null) => {
    get().updatePresence({ focusedIssueId: issueId || undefined, isEditing: false, isTyping: false });
  },

  setIsEditing: (isEditing: boolean) => {
    get().updatePresence({ isEditing, lastActivity: Date.now() });
  },

  setIsTyping: (isTyping: boolean) => {
    get().updatePresence({ isTyping, lastActivity: Date.now() });
  },

  updateCursor: (position: { x: number; y: number }) => {
    const { channel, myPresence } = get();
    
    // Use broadcast for cursor (more efficient than presence for high-frequency updates)
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'cursor:update',
        payload: { odId: myPresence.odId, cursor: position },
      });
    }
    
    // Also update local state
    set((state) => ({
      myPresence: { ...state.myPresence, cursor: position },
    }));
  },

  broadcastIssueUpdate: (issueId: string, changes: Record<string, unknown>) => {
    const { channel, myPresence } = get();
    
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'issue:update',
        payload: { issueId, changes, updatedBy: myPresence.odId },
      });
    }
  },
}));
