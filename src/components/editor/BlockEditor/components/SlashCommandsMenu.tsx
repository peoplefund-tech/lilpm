import React from 'react';
import {
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    ListTodo,
    Quote,
    Minus,
    Table as TableIcon,
    Info,
    ChevronRight,
    Play,
    Calculator,
    List as ListIcon,
    Link2 as BookmarkIcon,
    Paperclip,
    Copy,
    FileText,
    Zap,
    Layout,
    Database,
    CodeSquare,
} from 'lucide-react';
import { Paintbrush } from 'lucide-react';

interface SlashCommandsMenuProps {
    editor: any;
    isOpen: boolean;
    onClose: () => void;
}

export function SlashCommandsMenu({ editor, isOpen, onClose }: SlashCommandsMenuProps) {
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
}
