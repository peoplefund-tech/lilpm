import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface CollaboratorCursor {
    odId: string;
    name: string;
    color: string;
    position: number; // Cursor position in document
    avatarUrl?: string;
    lastUpdate: number;
}

const CURSOR_COLORS = [
    '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
    '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
];

const collaborationCursorPluginKey = new PluginKey('collaborationCursor');

export interface CollaborationCursorOptions {
    prdId: string;
    teamId: string;
    userName: string;
    userId: string;
    userColor?: string;
    avatarUrl?: string;
}

export const CollaborationCursor = Extension.create<CollaborationCursorOptions>({
    name: 'collaborationCursor',

    addOptions() {
        return {
            prdId: '',
            teamId: '',
            userName: 'Anonymous',
            userId: '',
            userColor: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
            avatarUrl: undefined,
        };
    },

    addProseMirrorPlugins() {
        const { prdId, teamId, userName, userId, userColor, avatarUrl } = this.options;

        console.log('[CollaborationCursor] addProseMirrorPlugins called with:', { prdId, teamId, userName, userId });

        if (!prdId || !teamId || !userId) {
            console.log('[CollaborationCursor] Missing required options, returning empty plugins');
            return [];
        }

        console.log('[CollaborationCursor] Creating cursor plugin for prdId:', prdId);

        const cursors: Map<string, CollaboratorCursor> = new Map();
        let channel: ReturnType<typeof supabase.channel> | null = null;

        return [
            new Plugin({
                key: collaborationCursorPluginKey,

                state: {
                    init: () => DecorationSet.empty,

                    apply: (tr, oldState, _oldEditorState, newEditorState) => {
                        // Get cursor decorations based on current collaborator positions
                        const decorations: Decoration[] = [];

                        cursors.forEach((cursor) => {
                            if (cursor.odId === userId) return; // Skip own cursor

                            // Check if cursor position is valid for current document
                            if (cursor.position < 0 || cursor.position > newEditorState.doc.content.size) {
                                return;
                            }

                            // Create inline decoration at cursor position
                            const widget = document.createElement('span');
                            widget.className = 'collaboration-cursor';
                            widget.style.cssText = `
                position: relative;
                border-left: 2px solid ${cursor.color};
                margin-left: -1px;
                margin-right: -1px;
                pointer-events: none;
              `;

                            // Create name label
                            const label = document.createElement('span');
                            label.className = 'collaboration-cursor-label';
                            label.textContent = cursor.name;
                            label.style.cssText = `
                position: absolute;
                bottom: 100%;
                left: -1px;
                background: ${cursor.color};
                color: white;
                padding: 2px 6px;
                border-radius: 3px 3px 3px 0;
                font-size: 11px;
                font-weight: 500;
                white-space: nowrap;
                z-index: 100;
                opacity: 1;
                animation: fadeIn 0.2s ease-out;
              `;
                            widget.appendChild(label);

                            // Add blinking cursor line
                            const cursorLine = document.createElement('span');
                            cursorLine.className = 'collaboration-cursor-caret';
                            cursorLine.style.cssText = `
                display: inline-block;
                width: 2px;
                height: 1.2em;
                background: ${cursor.color};
                animation: blink 1s step-end infinite;
                margin-left: -1px;
              `;
                            widget.appendChild(cursorLine);

                            decorations.push(
                                Decoration.widget(cursor.position, widget, {
                                    side: 0,
                                    key: cursor.odId,
                                })
                            );
                        });

                        return DecorationSet.create(newEditorState.doc, decorations);
                    },
                },

                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },

                view: (view) => {
                    // Subscribe to Supabase Realtime channel
                    const channelName = `prd-cursors:${prdId}`;
                    console.log('[CollaborationCursor] Creating Supabase channel:', channelName);
                    channel = supabase.channel(channelName);

                    channel
                        .on('presence', { event: 'sync' }, () => {
                            const presenceState = channel!.presenceState();
                            console.log('[CollaborationCursor] Presence sync:', presenceState);

                            // Update cursors from presence state
                            cursors.clear();

                            Object.values(presenceState).forEach((presences: any[]) => {
                                presences.forEach((presence) => {
                                    if (presence.user_id !== userId) {
                                        console.log('[CollaborationCursor] Adding cursor for:', presence.user_name, 'at position:', presence.cursor_position);
                                        cursors.set(presence.user_id, {
                                            odId: presence.user_id,
                                            name: presence.user_name,
                                            color: presence.color || CURSOR_COLORS[0],
                                            position: presence.cursor_position || 0,
                                            avatarUrl: presence.avatar_url,
                                            lastUpdate: Date.now(),
                                        });
                                    }
                                });
                            });

                            console.log('[CollaborationCursor] Total other cursors:', cursors.size);
                            // Trigger view update
                            view.dispatch(view.state.tr);
                        })
                        .subscribe(async (status) => {
                            console.log('[CollaborationCursor] Channel status:', status);
                            if (status === 'SUBSCRIBED') {
                                // Track own presence
                                console.log('[CollaborationCursor] Tracking own presence, userId:', userId, 'position:', view.state.selection.from);
                                await channel!.track({
                                    user_id: userId,
                                    user_name: userName,
                                    color: userColor,
                                    cursor_position: view.state.selection.from,
                                    avatar_url: avatarUrl,
                                });
                            }
                        });

                    // Update cursor position on selection change
                    const handleSelectionUpdate = () => {
                        if (channel) {
                            channel.track({
                                user_id: userId,
                                user_name: userName,
                                color: userColor,
                                cursor_position: view.state.selection.from,
                                avatar_url: avatarUrl,
                            });
                        }
                    };

                    // Debounce position updates
                    let updateTimeout: number | null = null;
                    const debouncedUpdate = () => {
                        if (updateTimeout) clearTimeout(updateTimeout);
                        updateTimeout = window.setTimeout(handleSelectionUpdate, 50);
                    };

                    return {
                        update: debouncedUpdate,
                        destroy: () => {
                            if (updateTimeout) clearTimeout(updateTimeout);
                            if (channel) {
                                channel.unsubscribe();
                            }
                        },
                    };
                },
            }),
        ];
    },
});

// CSS to inject for cursor animations
export const collaborationCursorStyles = `
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .collaboration-cursor-label {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
`;
