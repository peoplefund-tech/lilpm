/**
 * Slash Commands Extension for Tiptap
 * 
 * Implements Notion-style '/' commands for inserting blocks and formatting.
 * Triggered when user types '/' at the start of a line or after a space.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { createRoot, Root } from 'react-dom/client';
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
    Code,
    Table,
    Image,
    Video,
    FileText,
    Link2,
    Calculator,
    ChevronRight,
    Info,
    Columns,
    Play,
    FileAudio,
    Database,
    LayoutGrid,
    Bookmark,
    FileUp,
    Palette,
    Type,
    AlignLeft,
    Zap,
} from 'lucide-react';

// Define all slash command items (Notion-style)
export interface SlashCommandItem {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    command: (props: { editor: any; range: any }) => void;
    category: 'basic' | 'media' | 'database' | 'advanced' | 'embed';
    keywords?: string[];
}

export const slashCommandItems: SlashCommandItem[] = [
    // Basic Blocks
    {
        title: 'Text',
        description: 'Just start writing with plain text.',
        icon: Type,
        category: 'basic',
        keywords: ['paragraph', 'p', 'text'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setParagraph().run();
        },
    },
    {
        title: 'Heading 1',
        description: 'Big section heading.',
        icon: Heading1,
        category: 'basic',
        keywords: ['h1', 'heading', 'title'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        },
    },
    {
        title: 'Heading 2',
        description: 'Medium section heading.',
        icon: Heading2,
        category: 'basic',
        keywords: ['h2', 'heading', 'subtitle'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        },
    },
    {
        title: 'Heading 3',
        description: 'Small section heading.',
        icon: Heading3,
        category: 'basic',
        keywords: ['h3', 'heading'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
        },
    },
    {
        title: 'Bullet List',
        description: 'Create a simple bullet list.',
        icon: List,
        category: 'basic',
        keywords: ['ul', 'unordered', 'bullets'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
    },
    {
        title: 'Numbered List',
        description: 'Create a numbered list.',
        icon: ListOrdered,
        category: 'basic',
        keywords: ['ol', 'ordered', 'numbered'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
    },
    {
        title: 'To-do List',
        description: 'Track tasks with a to-do list.',
        icon: ListTodo,
        category: 'basic',
        keywords: ['todo', 'task', 'checkbox', 'check'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
    },
    {
        title: 'Toggle',
        description: 'Collapsible content block.',
        icon: ChevronRight,
        category: 'basic',
        keywords: ['collapse', 'expand', 'accordion'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'toggleNode',
                content: [{ type: 'paragraph' }],
            }).run();
        },
    },
    {
        title: 'Quote',
        description: 'Capture a quote.',
        icon: Quote,
        category: 'basic',
        keywords: ['blockquote', 'quotation'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
    },
    {
        title: 'Divider',
        description: 'Visually divide blocks.',
        icon: Minus,
        category: 'basic',
        keywords: ['hr', 'horizontal', 'separator', 'line'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
    },
    {
        title: 'Callout',
        description: 'Highlight important info.',
        icon: Info,
        category: 'basic',
        keywords: ['alert', 'note', 'warning', 'info'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'calloutNode',
                attrs: { emoji: '💡' },
                content: [{ type: 'paragraph' }],
            }).run();
        },
    },
    {
        title: 'Code Block',
        description: 'Display code with syntax highlighting.',
        icon: Code,
        category: 'basic',
        keywords: ['code', 'pre', 'programming'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    // Media
    {
        title: 'Image',
        description: 'Upload or embed an image.',
        icon: Image,
        category: 'media',
        keywords: ['img', 'picture', 'photo'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            const url = window.prompt('Enter image URL');
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        },
    },
    {
        title: 'Video',
        description: 'Embed a video from YouTube or URL.',
        icon: Video,
        category: 'media',
        keywords: ['youtube', 'vimeo', 'movie'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            const url = window.prompt('Enter video URL (YouTube, Vimeo, etc.)');
            if (url) {
                editor.chain().focus().insertContent({
                    type: 'videoNode',
                    attrs: { src: url },
                }).run();
            }
        },
    },
    {
        title: 'Audio',
        description: 'Embed an audio file.',
        icon: FileAudio,
        category: 'media',
        keywords: ['music', 'sound', 'mp3'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            const url = window.prompt('Enter audio URL');
            if (url) {
                editor.chain().focus().insertContent({
                    type: 'audioNode',
                    attrs: { src: url },
                }).run();
            }
        },
    },
    {
        title: 'File',
        description: 'Upload or embed a file.',
        icon: FileUp,
        category: 'media',
        keywords: ['attachment', 'upload', 'document'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'fileNode',
                attrs: { name: 'Untitled', url: '' },
            }).run();
        },
    },
    {
        title: 'Bookmark',
        description: 'Embed a link with preview.',
        icon: Bookmark,
        category: 'media',
        keywords: ['link', 'preview', 'embed'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            const url = window.prompt('Enter URL to bookmark');
            if (url) {
                editor.chain().focus().insertContent({
                    type: 'bookmarkNode',
                    attrs: { url },
                }).run();
            }
        },
    },
    // Database
    {
        title: 'Table',
        description: 'Add a simple table.',
        icon: Table,
        category: 'database',
        keywords: ['grid', 'spreadsheet'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3 }).run();
        },
    },
    {
        title: 'Linked Database',
        description: 'Link an existing database.',
        icon: Database,
        category: 'database',
        keywords: ['db', 'relation'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'linkedDatabase',
                attrs: { databaseId: '', viewType: 'table' },
            }).run();
        },
    },
    // Advanced
    {
        title: 'Columns',
        description: 'Create side-by-side content.',
        icon: Columns,
        category: 'advanced',
        keywords: ['layout', 'grid', 'side'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'columnBlock',
                content: [
                    { type: 'column', content: [{ type: 'paragraph' }] },
                    { type: 'column', content: [{ type: 'paragraph' }] },
                ],
            }).run();
        },
    },
    {
        title: 'Equation',
        description: 'Display mathematical equations.',
        icon: Calculator,
        category: 'advanced',
        keywords: ['math', 'latex', 'formula'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            const formula = window.prompt('Enter LaTeX equation');
            if (formula) {
                editor.chain().focus().insertContent({
                    type: 'equationNode',
                    attrs: { formula },
                }).run();
            }
        },
    },
    {
        title: 'Table of Contents',
        description: 'Generate from headings.',
        icon: AlignLeft,
        category: 'advanced',
        keywords: ['toc', 'contents', 'navigation'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'tableOfContentsNode',
            }).run();
        },
    },
    {
        title: 'Button',
        description: 'Add an interactive button.',
        icon: Zap,
        category: 'advanced',
        keywords: ['action', 'click', 'cta'],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertContent({
                type: 'buttonBlock',
                attrs: { label: 'Click me', url: '#' },
            }).run();
        },
    },
];

// Slash command menu React component
function SlashCommandMenu({
    items,
    selectedIndex,
    onSelect,
}: {
    items: SlashCommandItem[];
    selectedIndex: number;
    onSelect: (index: number) => void;
}) {
    const categories = ['basic', 'media', 'database', 'advanced'] as const;
    const categoryLabels = {
        basic: 'Basic blocks',
        media: 'Media',
        database: 'Database',
        advanced: 'Advanced',
        embed: 'Embeds',
    };

    let currentIndex = 0;

    return (
        <div className="slash-command-menu bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[400px] overflow-y-auto w-[280px]">
            {categories.map((category) => {
                const categoryItems = items.filter((item) => item.category === category);
                if (categoryItems.length === 0) return null;

                return (
                    <div key={category}>
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {categoryLabels[category]}
                        </div>
                        {categoryItems.map((item) => {
                            const itemIndex = items.indexOf(item);
                            const isSelected = itemIndex === selectedIndex;
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.title}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors ${isSelected ? 'bg-accent' : ''
                                        }`}
                                    onClick={() => onSelect(itemIndex)}
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{item.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {item.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                );
            })}
            {items.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No commands found
                </div>
            )}
        </div>
    );
}

// Create the Slash Commands Extension
export const SlashCommands = Extension.create({
    name: 'slashCommands',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                startOfLine: false,
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        const editor = this.editor;
        let popup: TippyInstance | null = null;
        let root: Root | null = null;
        let selectedIndex = 0;
        let filteredItems: SlashCommandItem[] = [...slashCommandItems];
        let query = '';

        const updateMenu = (element: HTMLElement) => {
            if (root) {
                root.render(
                    <SlashCommandMenu
                        items={filteredItems}
                        selectedIndex={selectedIndex}
                        onSelect={(index) => {
                            const item = filteredItems[index];
                            if (item) {
                                // Get the current selection
                                const { from } = editor.state.selection;
                                // Find the slash position
                                const slashPos = from - query.length - 1;
                                const range = { from: slashPos, to: from };
                                item.command({ editor, range });
                                popup?.hide();
                            }
                        }}
                    />
                );
            }
        };

        const showMenu = (coords: { left: number; top: number }) => {
            const element = document.createElement('div');
            element.className = 'slash-command-container';

            popup = tippy(document.body, {
                getReferenceClientRect: () => ({
                    width: 0,
                    height: 0,
                    top: coords.top,
                    bottom: coords.top,
                    left: coords.left,
                    right: coords.left,
                    x: coords.left,
                    y: coords.top,
                    toJSON: () => ({}),
                }),
                appendTo: () => document.body,
                content: element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                animation: 'shift-away',
                theme: 'slash-command',
            });

            root = createRoot(element);
            updateMenu(element);
        };

        const hideMenu = () => {
            popup?.destroy();
            popup = null;
            root?.unmount();
            root = null;
            selectedIndex = 0;
            filteredItems = [...slashCommandItems];
            query = '';
        };

        return [
            new Plugin({
                key: new PluginKey('slashCommands'),
                props: {
                    handleKeyDown(view, event) {
                        // Only handle when popup is visible
                        if (!popup) return false;

                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            selectedIndex = (selectedIndex + 1) % filteredItems.length;
                            updateMenu(popup.popper);
                            return true;
                        }

                        if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
                            updateMenu(popup.popper);
                            return true;
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault();
                            const item = filteredItems[selectedIndex];
                            if (item) {
                                const { from } = editor.state.selection;
                                const slashPos = from - query.length - 1;
                                const range = { from: slashPos, to: from };
                                item.command({ editor, range });
                                hideMenu();
                            }
                            return true;
                        }

                        if (event.key === 'Escape') {
                            event.preventDefault();
                            hideMenu();
                            return true;
                        }

                        return false;
                    },
                },
                view() {
                    return {
                        update(view, prevState) {
                            const { state } = view;
                            const { selection, doc } = state;
                            const { $from, from } = selection;

                            // Get text before cursor
                            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
                            const slashMatch = textBefore.match(/\/([a-zA-Z0-9]*)$/);

                            if (slashMatch) {
                                query = slashMatch[1] || '';

                                // Filter items based on query
                                filteredItems = slashCommandItems.filter((item) => {
                                    const searchText = `${item.title} ${item.description} ${(item.keywords || []).join(' ')}`.toLowerCase();
                                    return searchText.includes(query.toLowerCase());
                                });

                                selectedIndex = 0;

                                if (!popup) {
                                    const coords = view.coordsAtPos(from);
                                    showMenu({ left: coords.left, top: coords.bottom + 5 });
                                } else {
                                    updateMenu(popup.popper);
                                }
                            } else if (popup) {
                                hideMenu();
                            }
                        },
                        destroy() {
                            hideMenu();
                        },
                    };
                },
            }),
        ];
    },
});

export default SlashCommands;
