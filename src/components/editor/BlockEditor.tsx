import React, { useCallback, useEffect, useState, useRef, DragEvent, useMemo } from 'react';
import './DragHandle.css';
import './CollaborationCursor.css';
import './BlockLink.css';
import './SlashCommands.css';
import { BlockPresenceIndicator } from './BlockPresenceIndicator';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Collaboration from '@tiptap/extension-collaboration';
import TiptapCollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Mention from '@tiptap/extension-mention';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { common, createLowlight } from 'lowlight';
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
import { Paintbrush } from 'lucide-react';
import {
  CalloutNode, ToggleNode, VideoNode, EquationNode, TableOfContentsNode,
  BookmarkNode, FileNode, UniqueId, getBlockIdAtPos,
  AudioNode, ColumnBlock, Column, PageEmbed, BreadcrumbsNode,
  ButtonBlock, TemplateButton,
  LinkedDatabase, InlineDatabase,
  SlashCommands,
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
import { WebSocketCursor, webSocketCursorStyles } from './WebSocketCursor';
import { CursorOverlay } from './CursorOverlay';
import type { RemoteCursor } from '@/hooks/useCloudflareCollaboration';

const lowlight = createLowlight(common);

// Resizable Image Component
const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const [widthInput, setWidthInput] = useState(node.attrs.width?.toString() || '');
  const imageRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = imageRef.current?.offsetWidth || 0;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = direction === 'right' ? e.clientX - startX.current : startX.current - e.clientX;
      const newWidth = Math.max(50, startWidth.current + diff);
      updateAttributes({ width: newWidth });
      setWidthInput(newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWidthInput(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 50) {
      updateAttributes({ width: numValue });
    }
  };

  return (
    <NodeViewWrapper className="relative inline-block my-2 group">
      <div className={cn(
        "relative inline-block",
        selected && "ring-2 ring-cyan-500 rounded-lg",
        isResizing && "select-none",
        !selected && "hover:ring-2 hover:ring-cyan-400/60 rounded-lg transition-all"
      )}>
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{ width: node.attrs.width ? `${node.attrs.width}px` : 'auto' }}
          className="rounded-lg max-w-full"
          draggable={false}
        />

        {/* Resize handles - visible on hover (not just selected) */}
        <>
          {/* Left handle */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-cyan-500/50 rounded-l-lg transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            )}
            onMouseDown={(e) => handleMouseDown(e, 'left')}
          />
          {/* Right handle */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-cyan-500/50 rounded-r-lg transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            )}
            onMouseDown={(e) => handleMouseDown(e, 'right')}
          />

          {/* Width input at bottom center */}
          <div className={cn(
            "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1 z-10 transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5 shadow-sm">
              <input
                type="number"
                value={widthInput}
                onChange={handleWidthChange}
                className="w-14 text-xs text-center bg-transparent border-none focus:outline-none"
                placeholder="Width"
                min="50"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          </div>
        </>
      </div>
    </NodeViewWrapper>
  );
};

// Custom Resizable Image Extension
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}px` };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

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
  // Remote cursors from Cloudflare WebSocket
  remoteCursors?: Map<string, RemoteCursor>;
  onCursorPositionChange?: (position: number) => void;
}

// Toolbar Button Component
const ToolbarButton = ({
  onClick,
  active,
  disabled,
  children,
  title
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "h-8 w-8 p-0",
      active && "bg-accent text-accent-foreground"
    )}
  >
    {children}
  </Button>
);

// Slash Commands Menu
const SlashCommandsMenu = ({
  editor,
  isOpen,
  onClose
}: {
  editor: any;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const commands = [
    {
      icon: <Heading1 className="h-4 w-4" />,
      label: 'Heading 1',
      description: 'Large section heading',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    {
      icon: <Heading2 className="h-4 w-4" />,
      label: 'Heading 2',
      description: 'Medium section heading',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      icon: <Heading3 className="h-4 w-4" />,
      label: 'Heading 3',
      description: 'Small section heading',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    {
      icon: <List className="h-4 w-4" />,
      label: 'Bullet List',
      description: 'Create a simple bullet list',
      action: () => editor.chain().focus().toggleBulletList().run()
    },
    {
      icon: <ListOrdered className="h-4 w-4" />,
      label: 'Numbered List',
      description: 'Create a numbered list',
      action: () => editor.chain().focus().toggleOrderedList().run()
    },
    {
      icon: <ListTodo className="h-4 w-4" />,
      label: 'Task List',
      description: 'Create a todo list with checkboxes',
      action: () => editor.chain().focus().toggleTaskList().run()
    },
    {
      icon: <Quote className="h-4 w-4" />,
      label: 'Quote',
      description: 'Capture a quote',
      action: () => editor.chain().focus().toggleBlockquote().run()
    },
    {
      icon: <CodeSquare className="h-4 w-4" />,
      label: 'Code Block',
      description: 'Add a code snippet',
      action: () => editor.chain().focus().toggleCodeBlock().run()
    },
    {
      icon: <Minus className="h-4 w-4" />,
      label: 'Divider',
      description: 'Visual divider line',
      action: () => editor.chain().focus().setHorizontalRule().run()
    },
    {
      icon: <TableIcon className="h-4 w-4" />,
      label: 'Table',
      description: 'Insert a table',
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
    // Notion-style blocks
    {
      icon: <Info className="h-4 w-4" />,
      label: 'Callout',
      description: 'Info, warning, or tip box',
      action: () => editor.chain().focus().insertContent({ type: 'callout', attrs: { type: 'info' }, content: [{ type: 'paragraph' }] }).run()
    },
    {
      icon: <ChevronRight className="h-4 w-4" />,
      label: 'Toggle',
      description: 'Collapsible content section',
      action: () => editor.chain().focus().insertContent({ type: 'toggle', attrs: { title: '' }, content: [{ type: 'paragraph' }] }).run()
    },
    {
      icon: <Play className="h-4 w-4" />,
      label: 'Video',
      description: 'Embed YouTube or Vimeo video',
      action: () => editor.chain().focus().insertContent({ type: 'video', attrs: { src: '', caption: '' } }).run()
    },
    {
      icon: <Calculator className="h-4 w-4" />,
      label: 'Equation',
      description: 'LaTeX math equation',
      action: () => editor.chain().focus().insertContent({ type: 'equation', attrs: { latex: '', display: true } }).run()
    },
    {
      icon: <ListIcon className="h-4 w-4" />,
      label: 'Table of Contents',
      description: 'Auto-generated from headings',
      action: () => editor.chain().focus().insertContent({ type: 'tableOfContents' }).run()
    },
    {
      icon: <BookmarkIcon className="h-4 w-4" />,
      label: 'Bookmark',
      description: 'Add a web link preview',
      action: () => editor.chain().focus().insertContent({ type: 'bookmark', attrs: { url: '', title: '', description: '' } }).run()
    },
    {
      icon: <Paperclip className="h-4 w-4" />,
      label: 'File',
      description: 'Attach a file',
      action: () => editor.chain().focus().insertContent({ type: 'file', attrs: { fileName: '', fileSize: 0, fileType: '', fileUrl: '' } }).run()
    },
    // Color commands
    {
      icon: <Paintbrush className="h-4 w-4" />,
      label: 'Red',
      description: 'Red text color',
      action: () => editor.chain().focus().setColor('#ef4444').run()
    },
    {
      icon: <Paintbrush className="h-4 w-4" />,
      label: 'Blue',
      description: 'Blue text color',
      action: () => editor.chain().focus().setColor('#3b82f6').run()
    },
    {
      icon: <Paintbrush className="h-4 w-4" />,
      label: 'Green',
      description: 'Green text color',
      action: () => editor.chain().focus().setColor('#22c55e').run()
    },
    {
      icon: <Paintbrush className="h-4 w-4" />,
      label: 'Yellow highlight',
      description: 'Yellow background',
      action: () => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()
    },
    // Turn commands
    {
      icon: <Heading1 className="h-4 w-4" />,
      label: 'Turn to H1',
      description: 'Convert to heading 1',
      action: () => editor.chain().focus().setParagraph().toggleHeading({ level: 1 }).run()
    },
    {
      icon: <List className="h-4 w-4" />,
      label: 'Turn to bullet',
      description: 'Convert to bullet list',
      action: () => editor.chain().focus().toggleBulletList().run()
    },
    {
      icon: <ListTodo className="h-4 w-4" />,
      label: 'Turn to todo',
      description: 'Convert to task list',
      action: () => editor.chain().focus().toggleTaskList().run()
    },
    // Block manipulation
    {
      icon: <Copy className="h-4 w-4" />,
      label: 'Duplicate',
      description: 'Duplicate current block (Cmd+D)',
      action: () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        editor.chain().focus().insertContentAt(to, '\n' + text).run();
      }
    },
    // Sprint 1: New blocks
    {
      icon: <Play className="h-4 w-4" />,
      label: 'Audio',
      description: 'Embed audio file',
      action: () => editor.chain().focus().insertContent({ type: 'audio' }).run()
    },
    {
      icon: <ListIcon className="h-4 w-4" />,
      label: '2 Columns',
      description: 'Create two columns',
      action: () => editor.chain().focus().insertContent({
        type: 'columnBlock',
        attrs: { columnCount: 2 },
        content: [
          { type: 'column', content: [{ type: 'paragraph' }] },
          { type: 'column', content: [{ type: 'paragraph' }] },
        ]
      }).run()
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: 'Page',
      description: 'Embed a page',
      action: () => editor.chain().focus().insertContent({ type: 'pageEmbed' }).run()
    },
    {
      icon: <ChevronRight className="h-4 w-4" />,
      label: 'Breadcrumbs',
      description: 'Show page path',
      action: () => editor.chain().focus().insertContent({ type: 'breadcrumbs' }).run()
    },
    // Sprint 3: Automation
    {
      icon: <Zap className="h-4 w-4" />,
      label: 'Button',
      description: 'Interactive button with actions',
      action: () => editor.chain().focus().insertContent({ type: 'buttonBlock' }).run()
    },
    {
      icon: <Layout className="h-4 w-4" />,
      label: 'Template',
      description: 'Insert content template',
      action: () => editor.chain().focus().insertContent({ type: 'templateButton' }).run()
    },
    // Sprint 4: Database
    {
      icon: <Database className="h-4 w-4" />,
      label: 'Database',
      description: 'Create inline database',
      action: () => editor.chain().focus().insertContent({ type: 'inlineDatabase' }).run()
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-1 w-64">
      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
        Basic blocks
      </div>
      {commands.map((cmd, i) => (
        <button
          key={i}
          onClick={() => {
            cmd.action();
            onClose();
          }}
          className="flex items-center gap-3 w-full px-2 py-1.5 rounded hover:bg-accent text-left"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
            {cmd.icon}
          </div>
          <div>
            <div className="text-sm font-medium">{cmd.label}</div>
            <div className="text-xs text-muted-foreground">{cmd.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

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
              <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden max-w-[280px]">
                <div className="max-h-32 overflow-y-auto p-1">
                  {items.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No members found
                    </div>
                  ) : (
                    items.map((item: Profile, index: number) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                          }`}
                        onClick={() => {
                          props.command({ id: item.id, label: item.name || item.email || 'User' });
                        }}
                      >
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary flex-shrink-0">
                          {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">{item.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.email}</p>
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
              <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto p-1">
                  {items.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No members found
                    </div>
                  ) : (
                    items.map((item: Profile, index: number) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                          }`}
                        onClick={() => {
                          props.command({ id: item.id, label: item.name || item.email || 'User' });
                        }}
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary flex-shrink-0">
                          {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">{item.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.email}</p>
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
                <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden max-w-[280px]">
                  <div className="max-h-32 overflow-y-auto p-1">
                    {items.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No members found
                      </div>
                    ) : (
                      items.map((item: Profile, index: number) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                            }`}
                          onClick={() => {
                            props.command({ id: item.id, label: item.name || item.email || 'User' });
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary flex-shrink-0">
                            {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{item.name || 'User'}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.email}</p>
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
        placeholder,
        emptyEditorClass: 'is-editor-empty',
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
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-lg bg-muted p-4 font-mono text-sm',
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
      // Yjs Collaboration extension (real-time document sync)
      ...(yjsDoc ? [
        Collaboration.configure({
          document: yjsDoc,
        }),
      ] : []),
      // Yjs Collaboration Cursor for real-time text cursor with user names
      ...(yjsDoc && yjsProvider?.awareness ? [
        TiptapCollaborationCursor.configure({
          provider: yjsProvider,
          user: yjsProvider.awareness.getLocalState()?.user || {
            name: 'Anonymous',
            color: '#F87171',
          },
        }),
      ] : []),
      // WebSocket-based cursor (via Cloudflare Durable Objects)
      ...(remoteCursors ? [
        WebSocketCursor.configure({
          cursors: remoteCursors,
          onSelectionChange: onCursorPositionChange,
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
      // Slash Commands (Notion-style '/' menu)
      SlashCommands,
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
          'prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic',
          'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-muted prose-pre:p-0',
          'prose-img:rounded-lg',
          'prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
          'prose-td:border prose-td:border-border prose-td:p-2',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

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

  const addImageFromUrl = useCallback(() => {
    const url = window.prompt('Enter image URL');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

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
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border mb-4 sticky top-0 bg-background z-10">
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
                  editor.isActive('table') && "bg-muted"
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
                    <div className="w-4 h-4 mr-2 border border-border rounded" />
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
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={triggerFileUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addImageFromUrl}>
                <Link2 className="h-4 w-4 mr-2" />
                Image from URL
              </DropdownMenuItem>
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
                  editor.isActive('link') && "bg-accent text-accent-foreground"
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
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              onContextMenu={(e) => {
                // Store info about what was right-clicked for context menu
                const target = e.target as HTMLElement;
                // Let the context menu handle all cases now
              }}
            >
              <EditorContent editor={editor} />
              {/* Block Presence Indicators - show avatars next to blocks being edited */}
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
            {/* Text Formatting */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleBold().run()}
              disabled={!editor?.can().toggleBold()}
            >
              <Bold className="h-4 w-4 mr-2" />
              Bold
              <span className="ml-auto text-xs text-muted-foreground">⌘B</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              disabled={!editor?.can().toggleItalic()}
            >
              <Italic className="h-4 w-4 mr-2" />
              Italic
              <span className="ml-auto text-xs text-muted-foreground">⌘I</span>
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
              <span className="ml-auto text-xs text-muted-foreground">⌘E</span>
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* Turn Into */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().setParagraph().run()}
            >
              <AlignLeft className="h-4 w-4 mr-2" />
              Text
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="h-4 w-4 mr-2" />
              Heading 1
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="h-4 w-4 mr-2" />
              Heading 2
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="h-4 w-4 mr-2" />
              Heading 3
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* List Actions */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4 mr-2" />
              Bullet List
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4 mr-2" />
              Numbered List
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListTodo className="h-4 w-4 mr-2" />
              To-do List
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* Block Actions */}
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4 mr-2" />
              Quote
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <CodeSquare className="h-4 w-4 mr-2" />
              Code Block
            </ContextMenuItem>
            <ContextMenuSeparator />

            {/* Table Operations (if in table) */}
            {editor?.can().deleteRow() && (
              <>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addRowBefore().run()}
                >
                  Add Row Above
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                >
                  Add Row Below
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addColumnBefore().run()}
                >
                  Add Column Left
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                >
                  Add Column Right
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                  className="text-red-500"
                >
                  Delete Row
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                  className="text-red-500"
                >
                  Delete Column
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            {/* Clipboard & Delete */}
            <ContextMenuItem
              onClick={() => {
                // Copy block content
                const { from, to } = editor?.state.selection || {};
                if (from !== undefined && to !== undefined) {
                  const text = editor?.state.doc.textBetween(from, to, '\n');
                  navigator.clipboard.writeText(text || '');
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
              <span className="ml-auto text-xs text-muted-foreground">⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                // Duplicate current block
                const { $from, $to } = editor?.state.selection || {};
                if ($from && $to) {
                  const nodeAfter = $to.nodeAfter;
                  const nodeBefore = $from.nodeBefore;
                  const content = editor?.state.doc.slice($from.pos, $to.pos);
                  if (content) {
                    editor?.chain().focus().insertContentAt($to.pos, content.content.toJSON()).run();
                  }
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
              <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => editor?.chain().focus().deleteSelection().run()}
              className="text-red-500"
            >
              Delete
              <span className="ml-auto text-xs text-muted-foreground">⌫</span>
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
        
        .ProseMirror p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
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

