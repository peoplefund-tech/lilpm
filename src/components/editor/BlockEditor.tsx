import React, { useCallback, useEffect, useState, useRef, DragEvent } from 'react';
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
import { common, createLowlight } from 'lowlight';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CollaborationCursor as LegacyCollaborationCursor, collaborationCursorStyles } from './CollaborationCursor';

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
        selected && "ring-2 ring-primary rounded-lg",
        isResizing && "select-none"
      )}>
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{ width: node.attrs.width ? `${node.attrs.width}px` : 'auto' }}
          className="rounded-lg max-w-full"
          draggable={false}
        />

        {/* Resize handles */}
        {selected && (
          <>
            {/* Left handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg"
              onMouseDown={(e) => handleMouseDown(e, 'left')}
            />
            {/* Right handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-lg"
              onMouseDown={(e) => handleMouseDown(e, 'right')}
            />

            {/* Width input at bottom center */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
        )}
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
  // Yjs collaboration props (works with YPartyKitProvider or any awareness-based provider)
  yjsDoc?: Y.Doc;
  yjsProvider?: {
    awareness: any;
  };
  // Legacy collaboration props (cursor only, no doc sync)
  collaboration?: {
    prdId: string;
    teamId: string;
    userName: string;
    userId: string;
    userColor?: string;
    avatarUrl?: string;
  };
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
  collaboration,
}: BlockEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
          if (props.event.key === 'ArrowUp') {
            selectedIndex = selectedIndex === 0 ? items.length - 1 : selectedIndex - 1;
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            selectedIndex = selectedIndex === items.length - 1 ? 0 : selectedIndex + 1;
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
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
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
      // Yjs Collaboration extension (real-time document sync)
      ...(yjsDoc ? [
        Collaboration.configure({
          document: yjsDoc,
        }),
      ] : []),
      // Yjs Collaboration Cursor (shows other users' cursors with name tooltip)
      ...(yjsDoc && yjsProvider?.awareness ? [
        TiptapCollaborationCursor.configure({
          provider: yjsProvider,
          user: yjsProvider.awareness.getLocalState()?.user || {
            name: collaboration?.userName || 'Anonymous',
            color: collaboration?.userColor || '#F87171',
          },
        }),
      ] : []),
      // Legacy collaboration (cursor only, no doc sync) - for backward compatibility
      ...(collaboration && !yjsDoc ? [
        LegacyCollaborationCursor.configure({
          prdId: collaboration.prdId,
          teamId: collaboration.teamId,
          userName: collaboration.userName,
          userId: collaboration.userId,
          userColor: collaboration.userColor,
          avatarUrl: collaboration.avatarUrl,
        }),
      ] : []),
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

          {/* Table */}
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert Table"
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>

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


      {/* Editor Content */}
      <EditorContent editor={editor} />

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

