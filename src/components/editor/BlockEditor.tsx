import React, { useCallback, useEffect, useState, useRef, DragEvent, useMemo } from 'react';
import './DragHandle.css';
import './BlockLink.css';
import './BlockComment.css';
import './SlashCommands.css';
import { BlockPresenceIndicator } from './BlockPresenceIndicator';
import { ResizableImage } from './ResizableImage';
import { ToolbarButton } from './ToolbarButton';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
// CodeBlockLowlight replaced by CodeBlockWithLanguage (has language selector UI)
import Collaboration from '@tiptap/extension-collaboration';
import TiptapCollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Mention from '@tiptap/extension-mention';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
// lowlight is now provided by CodeBlockWithLanguage extension
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import * as Y from 'yjs';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { createRoot, Root } from 'react-dom/client';
import type { Profile } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Link as LinkIcon,
  Highlighter,
  Zap,
  Layout,
  Database,
  Table as TableIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CodeSquare,
  Upload,
  Link2,
  FileText,
  // Notion-style block icons
  Info,
  ChevronRight,
  Play,
  Calculator,
  List as ListIcon,
  Link2 as BookmarkIcon,
  Paperclip,
  Copy,
} from 'lucide-react';
import { Paintbrush, Underline, X } from 'lucide-react';
import {
  CalloutNode, ToggleNode, VideoNode, EquationNode, TableOfContentsNode,
  BookmarkNode, FileNode, UniqueId, getBlockIdAtPos,
  AudioNode, ColumnBlock, Column, PageEmbed, BreadcrumbsNode,
  ButtonBlock, TemplateButton,
  LinkedDatabase, InlineDatabase,
  SlashCommands,
  BlockCommentExtension,
  TrackChangesExtension,
  SyncedBlockNode,
  PageLink,
  ClipboardHandler,
  KeyboardShortcuts,
  PdfNode,
  EmbedNode,
  CodeBlockWithLanguage,
  lowlight,
  DragHandleMenu,
} from './extensions';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// WebSocketCursor is deprecated - TiptapCollaborationCursor + CursorOverlay handle cursor display
import { CursorOverlay } from './CursorOverlay';
import type { RemoteCursor } from '@/hooks/useCloudflareCollaboration';

// lowlight is imported from CodeBlockWithLanguage extension


// ResizableImage is now imported from ./ResizableImage


// Custom TableCell Extension with background color support
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-background-color') || element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      colwidth: {
        default: null,
        parseHTML: element => {
          const colwidth = element.getAttribute('colwidth');
          return colwidth ? colwidth.split(',').map(w => parseInt(w, 10)) : null;
        },
        renderHTML: attributes => {
          if (!attributes.colwidth) return {};
          return {
            colwidth: attributes.colwidth.join(','),
            style: `width: ${attributes.colwidth[0]}px`,
          };
        },
      },
    };
  },
});

interface BlockEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  autoFocus?: boolean;
  // Mention props
  teamMembers?: Profile[];
  onMention?: (userId: string, userName: string) => void;
  // Yjs collaboration props
  yjsDoc?: Y.Doc;
  yjsProvider?: any;
  // Remote cursors from Cloudflare WebSocket or Supabase Presence
  remoteCursors?: Map<string, RemoteCursor>;
  onCursorPositionChange?: (position: number, blockId?: string) => void;
  // Inline comments
  comments?: import('@/types/database').BlockComment[];
  onCommentClick?: (blockId: string, comments: import('@/types/database').BlockComment[]) => void;
  // Track changes
  trackChangesEnabled?: boolean;
  trackChangesUser?: { id: string; name: string; color: string } | null;
  trackChangesUsers?: Map<string, { id: string; name: string; color: string }>;
}

// SlashCommandsMenu is now imported from ./BlockEditor/components
import { SlashCommandsMenu } from './BlockEditor/components';

export function BlockEditor({
  content,
  onChange,
  placeholder = 'Type "/" for commands...',
  editable = true,
  className,
  autoFocus = false,
  teamMembers = [],
  onMention,
  yjsDoc,
  yjsProvider,
  remoteCursors,
  onCursorPositionChange,
  comments = [],
  onCommentClick,
  trackChangesEnabled = false,
  trackChangesUser = null,
  trackChangesUsers = new Map(),
}: BlockEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tableContextMenuOpen, setTableContextMenuOpen] = useState(false);
  const [tableContextMenuPosition, setTableContextMenuPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const mentionCallbackRef = useRef(onMention);
  const teamMembersRef = useRef(teamMembers);

  // Keep refs updated
  useEffect(() => {
    mentionCallbackRef.current = onMention;
    teamMembersRef.current = teamMembers;
  }, [onMention, teamMembers]);

  // Create mention suggestion configuration
  const mentionSuggestion = useCallback(() => ({
    items: ({ query }: { query: string }) => {
      return teamMembersRef.current
        .filter((member) =>
          member.name?.toLowerCase().includes(query.toLowerCase()) ||
          member.email?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5);
    },
    render: () => {
      let component: HTMLDivElement | null = null;
      let popup: TippyInstance[] | null = null;
      let root: Root | null = null;
      let selectedIndex = 0;
      let items: Profile[] = [];

      return {
        onStart: (props: any) => {
          items = props.items;
          selectedIndex = 0;

          component = document.createElement('div');
          root = createRoot(component);

          const renderComponent = () => {
            root?.render(
              <div className="bg-[#1a1a1f] border border-white/10 rounded-xl shadow-lg overflow-hidden max-w-[280px]">
                <div className="max-h-32 overflow-y-auto p-1">
                  {items.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-slate-400">
                      No members found
                    </div>
                  ) : (
                    items.map((item: Profile, index: number) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${index === selectedIndex ? 'bg-white/5' : 'hover:bg-white/5/50'
                          }`}
                        onClick={() => {
                          props.command({ id: item.id, label: item.name || item.email || 'User' });
                        }}
                      >
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary flex-shrink-0">
                          {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-white">{item.name || 'User'}</p>
                          <p className="text-xs text-slate-400 truncate">{item.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          };

          renderComponent();

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate: (props: any) => {
          items = props.items;
          selectedIndex = 0;

          if (root && component) {
            root.render(
              <div className="bg-[#1a1a1f] border border-white/10 rounded-xl shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto p-1">
                  {items.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-slate-400">
                      No members found
                    </div>
                  ) : (
                    items.map((item: Profile, index: number) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${index === selectedIndex ? 'bg-white/5' : 'hover:bg-white/5/50'
                          }`}
                        onClick={() => {
                          props.command({ id: item.id, label: item.name || item.email || 'User' });
                        }}
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary flex-shrink-0">
                          {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-white">{item.name || 'User'}</p>
                          <p className="text-xs text-slate-400 truncate">{item.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          }

          if (popup?.[0]) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown: (props: any) => {
          const renderUpdate = () => {
            if (root && component) {
              root.render(
                <div className="bg-[#1a1a1f] border border-white/10 rounded-xl shadow-lg overflow-hidden max-w-[280px]">
                  <div className="max-h-32 overflow-y-auto p-1">
                    {items.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-slate-400">
                        No members found
                      </div>
                    ) : (
                      items.map((item: Profile, index: number) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${index === selectedIndex ? 'bg-white/5' : 'hover:bg-white/5/50'
                            }`}
                          onClick={() => {
                            props.command({ id: item.id, label: item.name || item.email || 'User' });
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary flex-shrink-0">
                            {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-white">{item.name || 'User'}</p>
                            <p className="text-xs text-slate-400 truncate">{item.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            }
          };

          if (props.event.key === 'ArrowUp') {
            selectedIndex = selectedIndex === 0 ? items.length - 1 : selectedIndex - 1;
            renderUpdate(); // Re-render to show selection
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            selectedIndex = selectedIndex === items.length - 1 ? 0 : selectedIndex + 1;
            renderUpdate(); // Re-render to show selection
            return true;
          }
          if (props.event.key === 'Enter') {
            if (items[selectedIndex]) {
              const item = items[selectedIndex];
              props.command({ id: item.id, label: item.name || item.email || 'User' });
            }
            return true;
          }
          return false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          root?.unmount();
        },
      };
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Placeholder.configure({
        placeholder: ({ node, editor: editorInstance }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`;
          }
          // Show main placeholder only for the first empty paragraph of an empty doc
          if (editorInstance.isEmpty) {
            return placeholder;
          }
          return "Type '/' for commands...";
        },
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
        includeChildren: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      // Color support for /red, /blue, /green commands
      TextStyle,
      Color,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      CustomTableCell,
      ResizableImage.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
      CodeBlockWithLanguage.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-lg bg-[#121215] font-mono text-sm',
        },
      }),
      // Mention extension for @mentions
      ...(teamMembers.length > 0 ? [
        Mention.configure({
          HTMLAttributes: {
            class: 'mention bg-primary/10 text-primary rounded px-1 py-0.5 font-medium',
          },
          suggestion: {
            ...mentionSuggestion(),
            char: '@',
          },
          renderHTML({ options, node }) {
            // Trigger onMention callback when mention is rendered
            const userId = node.attrs.id;
            const userName = node.attrs.label;
            if (mentionCallbackRef.current && userId) {
              // Use setTimeout to avoid calling during render
              setTimeout(() => {
                mentionCallbackRef.current?.(userId, userName);
              }, 0);
            }
            return [
              'span',
              { ...options.HTMLAttributes, 'data-mention-id': userId },
              `@${userName}`,
            ];
          },
        }),
      ] : []),
      // Unique ID extension for block-level addressing
      UniqueId.configure({
        attributeName: 'blockId',
      }),
      // Global drag handle for block reordering
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      // Drag handle click menu (Turn into, Color, Duplicate, Delete)
      DragHandleMenu,
      // Yjs Collaboration extension (real-time document sync)
      ...(yjsDoc ? [
        Collaboration.configure({
          document: yjsDoc,
        }),
      ] : []),
      // Yjs Collaboration Cursor - shows remote users' cursor positions and text selections
      // This is the primary cursor display when using CRDT mode (Cloudflare)
      ...(yjsDoc && yjsProvider?.awareness ? [
        TiptapCollaborationCursor.configure({
          provider: yjsProvider,
          user: yjsProvider.awareness.getLocalState()?.user || {
            name: 'Anonymous',
            color: '#F87171',
          },
        }),
      ] : []),
      // Notion-style block extensions
      CalloutNode,
      ToggleNode,
      VideoNode,
      EquationNode,
      TableOfContentsNode,
      BookmarkNode,
      FileNode,
      // Sprint 1: Core Blocks
      AudioNode,
      ColumnBlock,
      Column,
      PageEmbed,
      BreadcrumbsNode,
      // Sprint 3: Automation
      ButtonBlock,
      TemplateButton,
      // Sprint 4: Database
      LinkedDatabase,
      InlineDatabase,
      // Synced Block visual node
      SyncedBlockNode,
      // PDF embed node
      PdfNode,
      // General embed node (Figma, Google Docs, etc.)
      EmbedNode,
      // Notion-style keyboard shortcuts (Cmd+Shift+1~9)
      KeyboardShortcuts,
      // Page Link ([[ and + triggers)
      PageLink.configure({
        pages: [], // Will be populated by parent component if needed
      }),
      // Enhanced clipboard handling (paste URLs, markdown, images)
      ClipboardHandler,
      // Slash Commands (Notion-style '/' menu)
      SlashCommands,
      // Inline Block Comments (Notion-style comment threads on blocks)
      ...(onCommentClick ? [
        BlockCommentExtension.configure({
          comments: comments.map(c => ({
            id: c.id,
            blockId: c.block_id,
            content: c.content,
            authorId: c.user_id,
            authorName: c.user?.name || 'User',
            authorAvatar: c.user?.avatar_url,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            resolved: c.resolved,
            replies: (c.replies || []).map(r => ({
              id: r.id,
              content: r.content,
              authorId: r.user_id,
              authorName: r.user?.name || 'User',
              authorAvatar: r.user?.avatar_url,
              createdAt: r.created_at,
            })),
          })),
          onCommentClick,
        }),
      ] : []),
      // Track Changes - per-block authorship tracking
      TrackChangesExtension.configure({
        enabled: trackChangesEnabled,
        currentUser: trackChangesUser,
        users: trackChangesUsers,
      }),
    ],
    content: yjsDoc ? undefined : content, // Don't set content when using Yjs (doc is the source of truth)
    editable,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px]',
          'prose-headings:font-semibold prose-headings:tracking-tight',
          'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
          'prose-p:leading-7 prose-p:my-2',
          'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
          'prose-blockquote:border-l-primary prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic',
          'prose-code:bg-[#121215] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-[#121215] prose-pre:p-0',
          'prose-img:rounded-lg',
          'prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-2 prose-th:bg-[#121215]',
          'prose-td:border prose-td:border-white/10 prose-td:p-2',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Report cursor position changes to collaboration providers
  // This sends position updates via both Cloudflare (for awareness) and Supabase (for presence)
  useEffect(() => {
    if (!editor || !onCursorPositionChange) return;

    let timeout: number | null = null;
    const handleSelectionUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          const pos = editor.state.selection.from;
          const blockId = getBlockIdAtPos(editor.state, pos);
          onCursorPositionChange(pos, blockId);
        }
      }, 50);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    // Also report on focus
    editor.on('focus', handleSelectionUpdate);

    return () => {
      if (timeout) clearTimeout(timeout);
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('focus', handleSelectionUpdate);
    };
  }, [editor, onCursorPositionChange]);

  // Follow mode - auto-scroll to the followed user's cursor position
  useEffect(() => {
    if (!editor || !remoteCursors) return;

    // Import store lazily to avoid circular dependencies
    const { useCollaborationStore } = require('@/stores/collaborationStore');
    const unsubscribe = useCollaborationStore.subscribe(
      (state: any) => state.followingUserId,
      (followingUserId: string | null) => {
        // This subscription watches followingUserId changes
      }
    );

    const interval = setInterval(() => {
      const followingUserId = useCollaborationStore.getState().followingUserId;
      if (!followingUserId || !remoteCursors) return;

      const followedCursor = remoteCursors.get(followingUserId);
      if (!followedCursor || !followedCursor.position) return;

      try {
        const docSize = editor.state.doc.content.size;
        const pos = Math.min(Math.max(0, followedCursor.position), docSize);
        const coords = editor.view.coordsAtPos(pos);
        const editorRect = editor.view.dom.getBoundingClientRect();

        // Check if cursor is outside viewport
        const scrollContainer = editor.view.dom.closest('.overflow-y-auto') || window;
        const viewportTop = scrollContainer === window ? window.scrollY : (scrollContainer as HTMLElement).scrollTop;
        const viewportHeight = scrollContainer === window ? window.innerHeight : (scrollContainer as HTMLElement).clientHeight;

        const cursorRelativeY = coords.top;
        if (cursorRelativeY < viewportTop + 100 || cursorRelativeY > viewportTop + viewportHeight - 100) {
          // Smooth scroll to cursor position
          if (scrollContainer === window) {
            window.scrollTo({ top: cursorRelativeY - viewportHeight / 3, behavior: 'smooth' });
          } else {
            (scrollContainer as HTMLElement).scrollTo({
              top: coords.top - editorRect.top - viewportHeight / 3,
              behavior: 'smooth',
            });
          }
        }
      } catch {
        // Position out of bounds
      }
    }, 500); // Check every 500ms

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [editor, remoteCursors]);

  // Restrict drag handle to only show when mouse is in the left margin (first 40px)
  useEffect(() => {
    if (!editor) return;
    const editorDom = editor.view.dom;
    
    const handleMouseMove = (e: MouseEvent) => {
      const dragHandle = document.querySelector('.drag-handle') as HTMLElement;
      if (!dragHandle) return;
      
      const editorRect = editorDom.getBoundingClientRect();
      const mouseXRelative = e.clientX - editorRect.left;
      
      // Only show drag handle when mouse is in the left margin (< 0, i.e. left of content)
      // or within the first 10px of content area
      if (mouseXRelative < 10) {
        dragHandle.style.pointerEvents = 'auto';
        // Don't force visibility - let the library handle it
      } else {
        // Hide the drag handle when mouse is over content
        dragHandle.classList.remove('visible');
        dragHandle.style.opacity = '0';
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [editor]);

  // Ref to track if we're currently updating from remote content
  const lastContentRef = useRef(content);
  const isLocalUpdateRef = useRef(false);

  // Sync editor with external content changes (for real-time collaboration)
  useEffect(() => {
    if (!editor || !content) return;

    // Skip if this is a Yjs-enabled editor (Yjs handles sync internally)
    if (yjsDoc) return;

    // Get current editor content
    const currentEditorContent = editor.getHTML();

    // Only update if:
    // 1. Content prop changed from external source (not our own onChange)
    // 2. Content is different from current editor content
    if (content !== lastContentRef.current && content !== currentEditorContent) {
      console.log('[BlockEditor] External content change detected, updating editor');

      // Save cursor position
      const { from, to } = editor.state.selection;

      // Temporarily disable onChange to prevent loop
      isLocalUpdateRef.current = true;

      // Update editor content
      editor.commands.setContent(content, { emitUpdate: false }); // Don't emit update

      // Restore cursor position (if valid)
      try {
        const docSize = editor.state.doc.content.size;
        const safeFrom = Math.min(from, docSize);
        const safeTo = Math.min(to, docSize);
        editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
      } catch {
        // If cursor position is invalid, just ignore
      }

      isLocalUpdateRef.current = false;
    }

    // Update our tracking ref
    lastContentRef.current = content;
  }, [editor, content, yjsDoc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkPopover(false);
  }, [editor, linkUrl]);

  // Handle file to base64 conversion and insert image
  const handleImageFiles = useCallback(async (files: FileList | File[]) => {
    if (!editor) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    }
  }, [editor]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleImageFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageFiles]);

  // Handle drag events
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageFiles(files);
    }
  }, [handleImageFiles]);

  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState('');

  const addImageFromUrl = useCallback(() => {
    setShowImageUrlInput(true);
  }, []);

  const confirmImageUrl = useCallback(() => {
    if (imageUrlValue && editor) {
      editor.chain().focus().setImage({ src: imageUrlValue }).run();
    }
    setImageUrlValue('');
    setShowImageUrlInput(false);
  }, [editor, imageUrlValue]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        "relative",
        isDragging && "ring-2 ring-primary ring-offset-2 rounded-lg",
        className
      )}
      onDragOver={editable ? handleDragOver : undefined}
      onDragLeave={editable ? handleDragLeave : undefined}
      onDrop={editable ? handleDrop : undefined}
    >
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-10 w-10 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium text-primary">Drop images here</p>
          </div>
        </div>
      )}
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-white/10 mb-4 sticky top-0 bg-[#0d0d0f] z-[5]">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (⌘B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (⌘I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Headings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                <Heading1 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="h-4 w-4 mr-2" /> Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="h-4 w-4 mr-2" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 className="h-4 w-4 mr-2" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                <AlignLeft className="h-4 w-4 mr-2" /> Paragraph
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            title="Task List"
          >
            <ListTodo className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Blocks */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <CodeSquare className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Table - Enhanced with editing controls */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  editor.isActive('table') && "bg-[#121215]"
                )}
                title="Table"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <TableIcon className="h-4 w-4 mr-2" />
                Insert Table
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().addRowBefore().run()}
                disabled={!editor.can().addRowBefore()}
              >
                Add Row Above
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().addRowAfter().run()}
                disabled={!editor.can().addRowAfter()}
              >
                Add Row Below
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteRow().run()}
                disabled={!editor.can().deleteRow()}
              >
                Delete Row
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                disabled={!editor.can().addColumnBefore()}
              >
                Add Column Left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                disabled={!editor.can().addColumnAfter()}
              >
                Add Column Right
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteColumn().run()}
                disabled={!editor.can().deleteColumn()}
              >
                Delete Column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().mergeCells().run()}
                disabled={!editor.can().mergeCells()}
              >
                Merge Cells
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().splitCell().run()}
                disabled={!editor.can().splitCell()}
              >
                Split Cell
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                disabled={!editor.can().toggleHeaderRow()}
              >
                Toggle Header Row
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                disabled={!editor.can().toggleHeaderColumn()}
              >
                Toggle Header Column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Cell Background Color */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Paintbrush className="h-4 w-4 mr-2" />
                    Cell Background
                  </DropdownMenuItem>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
                  >
                    <div className="w-4 h-4 mr-2 border border-white/10 rounded" />
                    None
                  </DropdownMenuItem>
                  {[
                    { name: 'Red', color: '#FEE2E2' },
                    { name: 'Orange', color: '#FFEDD5' },
                    { name: 'Yellow', color: '#FEF3C7' },
                    { name: 'Green', color: '#DCFCE7' },
                    { name: 'Blue', color: '#DBEAFE' },
                    { name: 'Purple', color: '#F3E8FF' },
                    { name: 'Pink', color: '#FCE7F3' },
                    { name: 'Gray', color: '#F3F4F6' },
                  ].map(({ name, color }) => (
                    <DropdownMenuItem
                      key={color}
                      onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', color).run()}
                    >
                      <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: color }} />
                      {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteTable().run()}
                disabled={!editor.can().deleteTable()}
                className="text-red-500"
              >
                Delete Table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Image */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Insert Image"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuItem onClick={triggerFileUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs text-slate-400 mb-1.5">Image from URL</p>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="https://..."
                    value={imageUrlValue}
                    onChange={(e) => setImageUrlValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmImageUrl();
                      }
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                  />
                  <Button onClick={confirmImageUrl} size="sm" className="h-7 px-2 text-xs">
                    Add
                  </Button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Link */}
          <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  editor.isActive('link') && "bg-white/5 text-white"
                )}
                title="Add Link"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setLink();
                    }
                  }}
                />
                <Button onClick={setLink} size="sm">
                  Set
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1" />

          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (⌘Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (⌘⇧Z)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}


      {/* Editor Content with Cursor Overlay and Block-Type Context Menu */}
      <div style={{ position: 'relative' }}>
        {/* BubbleMenu - Enhanced text selection formatting toolbar */}
        {editor && (
          <BubbleMenu
            editor={editor}
          >
            <div
              className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#1a1a1f] p-1.5 shadow-xl"
              style={{ zIndex: 99999, position: 'relative' }}
            >
              {/* Turn Into dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Turn into
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                    <AlignLeft className="h-4 w-4 mr-2" /> Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                    <Heading1 className="h-4 w-4 mr-2" /> Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <Heading2 className="h-4 w-4 mr-2" /> Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                    <Heading3 className="h-4 w-4 mr-2" /> Heading 3
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List className="h-4 w-4 mr-2" /> Bullet List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered className="h-4 w-4 mr-2" /> Numbered List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleTaskList().run()}>
                    <ListTodo className="h-4 w-4 mr-2" /> To-do List
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                    <Quote className="h-4 w-4 mr-2" /> Quote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                    <CodeSquare className="h-4 w-4 mr-2" /> Code Block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-border mx-0.5" />

              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive('bold')}
                title="Bold (⌘B)"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')}
                title="Italic (⌘I)"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive('strike')}
                title="Strikethrough"
              >
                <Strikethrough className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive('code')}
                title="Code"
              >
                <Code className="h-4 w-4" />
              </ToolbarButton>

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Text Color dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Text color">
                    <span className="text-xs font-bold" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>
                    <div className="w-4 h-4 mr-2 border border-white/20 rounded" />
                    Default
                  </DropdownMenuItem>
                  {[
                    { name: 'Red', color: '#EF4444' },
                    { name: 'Orange', color: '#F97316' },
                    { name: 'Yellow', color: '#EAB308' },
                    { name: 'Green', color: '#22C55E' },
                    { name: 'Blue', color: '#3B82F6' },
                    { name: 'Purple', color: '#A855F7' },
                    { name: 'Pink', color: '#EC4899' },
                    { name: 'Gray', color: '#6B7280' },
                  ].map(({ name, color }) => (
                    <DropdownMenuItem key={color} onClick={() => editor.chain().focus().setColor(color).run()}>
                      <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: color }} />
                      {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Highlight Color dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Highlight">
                    <Highlighter className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => editor.chain().focus().unsetHighlight().run()}>
                    <div className="w-4 h-4 mr-2 border border-white/20 rounded" />
                    None
                  </DropdownMenuItem>
                  {[
                    { name: 'Red', color: '#FEE2E2' },
                    { name: 'Orange', color: '#FFEDD5' },
                    { name: 'Yellow', color: '#FEF3C7' },
                    { name: 'Green', color: '#DCFCE7' },
                    { name: 'Blue', color: '#DBEAFE' },
                    { name: 'Purple', color: '#F3E8FF' },
                    { name: 'Pink', color: '#FCE7F3' },
                  ].map(({ name, color }) => (
                    <DropdownMenuItem key={color} onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}>
                      <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: color }} />
                      {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Link button with inline input */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 w-7 p-0", editor.isActive('link') && "bg-white/5")}
                    title="Link"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" side="top">
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Paste link..."
                      defaultValue={editor.getAttributes('link').href || ''}
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value;
                          if (val) {
                            editor.chain().focus().setLink({ href: val }).run();
                          } else {
                            editor.chain().focus().unsetLink().run();
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                        if (input?.value) {
                          editor.chain().focus().setLink({ href: input.value }).run();
                        }
                      }}
                    >
                      Set
                    </Button>
                    {editor.isActive('link') && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => editor.chain().focus().unsetLink().run()}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </BubbleMenu>
        )}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              onContextMenu={() => {
                // Context menu will detect the current block type from editor selection
              }}
            >
              <EditorContent editor={editor} />
              {/* Block Presence Indicators - show which users are editing which blocks */}
              {remoteCursors && remoteCursors.size > 0 && (
                <BlockPresenceIndicator
                  editor={editor}
                  users={Array.from(remoteCursors.values()).map(cursor => ({
                    id: cursor.id,
                    name: cursor.name,
                    color: cursor.color,
                    avatar: cursor.avatar,
                    blockId: cursor.blockId,
                  }))}
                />
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            {/* Text Formatting — only for text-based blocks (not images, code blocks, etc.) */}
            {!editor?.isActive('image') && !editor?.isActive('video') && !editor?.isActive('horizontalRule') && (
              <>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  disabled={!editor?.can().toggleBold()}
                >
                  <Bold className="h-4 w-4 mr-2" />
                  Bold
                  <span className="ml-auto text-xs text-slate-400">⌘B</span>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  disabled={!editor?.can().toggleItalic()}
                >
                  <Italic className="h-4 w-4 mr-2" />
                  Italic
                  <span className="ml-auto text-xs text-slate-400">⌘I</span>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  disabled={!editor?.can().toggleStrike()}
                >
                  <Strikethrough className="h-4 w-4 mr-2" />
                  Strikethrough
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                  disabled={!editor?.can().toggleCode()}
                >
                  <Code className="h-4 w-4 mr-2" />
                  Inline Code
                  <span className="ml-auto text-xs text-slate-400">⌘E</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Turn Into — only for paragraph/heading/list blocks (not tables, images, code) */}
            {!editor?.isActive('table') && !editor?.isActive('image') && !editor?.isActive('codeBlock') && (
              <>
                <ContextMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
                  <AlignLeft className="h-4 w-4 mr-2" />
                  Text
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                  <Heading1 className="h-4 w-4 mr-2" />
                  Heading 1
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 className="h-4 w-4 mr-2" />
                  Heading 2
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
                  <Heading3 className="h-4 w-4 mr-2" />
                  Heading 3
                </ContextMenuItem>
                <ContextMenuSeparator />

                {/* List Actions */}
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  <List className="h-4 w-4 mr-2" />
                  Bullet List
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Numbered List
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleTaskList().run()}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  To-do List
                </ContextMenuItem>
                <ContextMenuSeparator />

                {/* Block Actions */}
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote className="h-4 w-4 mr-2" />
                  Quote
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
                  <CodeSquare className="h-4 w-4 mr-2" />
                  Code Block
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Code Block specific actions */}
            {editor?.isActive('codeBlock') && (
              <>
                <ContextMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
                  <AlignLeft className="h-4 w-4 mr-2" />
                  Turn into Text
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Image specific actions */}
            {editor?.isActive('image') && (
              <>
                <ContextMenuItem onClick={() => {
                  const attrs = editor?.getAttributes('image');
                  if (attrs?.src) {
                    window.open(attrs.src, '_blank');
                  }
                }}>
                  Open Original
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Table Operations — only when cursor is inside a table */}
            {editor?.can().deleteRow() && (
              <>
                <ContextMenuItem onClick={() => editor?.chain().focus().addRowBefore().run()}>
                  Add Row Above
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().addRowAfter().run()}>
                  Add Row Below
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().addColumnBefore().run()}>
                  Add Column Left
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().addColumnAfter().run()}>
                  Add Column Right
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => editor?.chain().focus().deleteRow().run()} className="text-red-500">
                  Delete Row
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().deleteColumn().run()} className="text-red-500">
                  Delete Column
                </ContextMenuItem>
                <ContextMenuItem onClick={() => editor?.chain().focus().deleteTable().run()} className="text-red-500">
                  Delete Table
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Clipboard & Delete — always shown */}
            <ContextMenuItem
              onClick={() => {
                const { from, to } = editor?.state.selection || {};
                if (from !== undefined && to !== undefined) {
                  const text = editor?.state.doc.textBetween(from, to, '\n');
                  navigator.clipboard.writeText(text || '');
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
              <span className="ml-auto text-xs text-slate-400">⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const { $from, $to } = editor?.state.selection || {};
                if ($from && $to) {
                  const slice = editor?.state.doc.slice($from.pos, $to.pos);
                  if (slice) {
                    editor?.chain().focus().insertContentAt($to.pos, slice.content.toJSON()).run();
                  }
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
              <span className="ml-auto text-xs text-slate-400">⌘D</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().deleteSelection().run()}
              className="text-red-500"
            >
              Delete
              <span className="ml-auto text-xs text-slate-400">⌫</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <CursorOverlay editor={editor} cursors={remoteCursors || new Map()} />
      </div>

      {/* Editor Styles */}
      <style>{`
        .ProseMirror {
          outline: none;
        }
        
        /* Placeholder for completely empty editor */
        .ProseMirror.is-editor-empty > p:first-child::before,
        .ProseMirror > p.is-editor-empty:first-child::before,
        .ProseMirror p.is-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          opacity: 0.5;
        }
        
        /* Also support the placeholder on the editor root element */
        .ProseMirror.is-editor-empty::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          opacity: 0.5;
        }

        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }

        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .ProseMirror ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-top: 0.25rem;
        }

        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }

        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.6;
        }

        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
        }

        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }

        .ProseMirror table th {
          font-weight: bold;
          text-align: left;
          background-color: hsl(var(--muted));
        }

        .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: hsl(var(--primary) / 0.1);
          pointer-events: none;
        }

        .ProseMirror pre {
          background: hsl(var(--muted));
          border-radius: 0.5rem;
          font-family: 'JetBrains Mono', monospace;
          padding: 1rem;
        }

        .ProseMirror pre code {
          background: none;
          padding: 0;
          font-size: 0.875rem;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }

        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
        }

        .ProseMirror hr {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 1.5rem 0;
        }

        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--primary));
          margin: 1rem 0;
          padding-left: 1rem;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}

