import { create } from 'zustand';

// TODO: Migrate to collab-server WebSocket at ws://localhost:3001
// Realtime collaboration is currently disabled during EKS migration
// This store maintains the interface but all operations are no-ops

export interface Presence {
  odId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  textCursor?: { line: number; column: number; selection?: string };
  focusedIssueId?: string;
  isEditing?: boolean;
  isTyping?: boolean;
  lastActivity?: number;
  color: string;
  currentPath?: string;
}

interface CollaborationStore {
  isConnected: boolean;
  roomId: string | null;
  channel: unknown | null; // TODO: Replace with WebSocket type when migrating to collab-server
  users: Presence[];
  sidebarPresenceUsers: Presence[]; // Separate state for sidebar presence (won't conflict with room users)
  myPresence: Partial<Presence>;
  showCursors: boolean;

  // Follow mode (Figma-style)
  followingUserId: string | null; // userId we're currently following
  followUser: (userId: string) => void;
  stopFollowing: () => void;

  // Actions
  joinRoom: (roomId: string, userInfo: { id: string; name: string; avatarUrl?: string }) => Promise<void>;
  leaveRoom: () => void;
  updatePresence: (presence: Partial<Presence>) => void;
  setFocusedIssue: (issueId: string | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  setCurrentPath: (path: string) => void;
  updateCursor: (position: { x: number; y: number }) => void;
  broadcastIssueUpdate: (issueId: string, changes: Record<string, unknown>) => void;
  toggleShowCursors: () => void;
  // Cursor visibility to specific members
  cursorVisibleTo: string[]; // Array of user IDs who can see my cursor
  setCursorVisibleTo: (userIds: string[]) => void;
  // Text cursor for editor collaboration
  updateTextCursor: (position: { line: number; column: number; selection?: string }) => void;
  // Set users directly (for sidebar presence - uses separate state)
  setUsers: (users: Presence[]) => void;
  setSidebarPresenceUsers: (users: Presence[]) => void;
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
  sidebarPresenceUsers: [],
  myPresence: {
    color: getRandomColor(),
  },
  showCursors: localStorage.getItem('showCursors') === 'true', // default false
  followingUserId: null,
  cursorVisibleTo: JSON.parse(localStorage.getItem('cursorVisibleTo') || '[]'),

  // TODO: Implement WebSocket connection to collab-server at ws://localhost:3001
  joinRoom: async (roomId: string, userInfo: { id: string; name: string; avatarUrl?: string }) => {
    // No-op during migration - realtime disabled
    const myPresence: Presence = {
      odId: userInfo.id,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      color: get().myPresence.color || getRandomColor(),
    };

    set({ isConnected: false, roomId, myPresence });

    // TODO: Connect to collab-server WebSocket
    // const ws = new WebSocket(`ws://localhost:3001/collab/room/${roomId}`);
    // ws.onmessage = (event) => {
    //   const message = JSON.parse(event.data);
    //   // Handle presence sync, join, leave events
    //   // Handle cursor updates and issue broadcasts
    // };
  },

  leaveRoom: () => {
    // TODO: Disconnect WebSocket when implemented
    set({ isConnected: false, roomId: null, channel: null, users: [] });
  },

  updatePresence: (presence: Partial<Presence>) => {
    const { myPresence } = get();
    const newPresence = { ...myPresence, ...presence };
    set({ myPresence: newPresence });

    // TODO: Send presence update via WebSocket
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

  setCurrentPath: (path: string) => {
    get().updatePresence({ currentPath: path });
  },

  updateCursor: (position: { x: number; y: number }) => {
    // TODO: Send cursor update via WebSocket broadcast
    set((state) => ({
      myPresence: { ...state.myPresence, cursor: position },
    }));
  },

  broadcastIssueUpdate: (issueId: string, changes: Record<string, unknown>) => {
    // TODO: Send issue update via WebSocket broadcast
    // For now, emit local event only
    window.dispatchEvent(new CustomEvent('realtime:issue:update', {
      detail: { issueId, changes, updatedBy: get().myPresence.odId }
    }));
  },

  // Follow mode - Figma-style "follow" another user's viewport
  followUser: (userId: string) => {
    set({ followingUserId: userId });
  },

  stopFollowing: () => {
    set({ followingUserId: null });
  },

  toggleShowCursors: () => {
    set((state) => {
      const newValue = !state.showCursors;
      localStorage.setItem('showCursors', String(newValue));
      return { showCursors: newValue };
    });
  },

  setCursorVisibleTo: (userIds: string[]) => {
    localStorage.setItem('cursorVisibleTo', JSON.stringify(userIds));
    set({ cursorVisibleTo: userIds });
  },

  updateTextCursor: (position: { line: number; column: number; selection?: string }) => {
    // TODO: Send text cursor update via WebSocket broadcast
    get().updatePresence({ textCursor: position });
  },

  setUsers: (users: Presence[]) => {
    set({ users });
  },

  setSidebarPresenceUsers: (users: Presence[]) => {
    set({ sidebarPresenceUsers: users });
  },
}));
