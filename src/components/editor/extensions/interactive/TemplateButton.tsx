import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState } from 'react';
import { Plus, FileText, ListTodo, Table2, Columns, Calendar, Trash2, Settings } from 'lucide-react';

/**
 * Template Button Extension
 * Inserts predefined content templates on click
 */

export interface ContentTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    content: any[]; // TipTap JSON content
}

// Built-in templates
export const builtInTemplates: ContentTemplate[] = [
    {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Structure for meeting documentation',
        icon: 'calendar',
        content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '📅 Meeting Notes' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }, { type: 'text', marks: [{ type: 'bold' }], text: new Date().toLocaleDateString() }] },
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Attendees' }] },
            {
                type: 'bulletList', content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '@' }] }] },
                ]
            },
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Agenda' }] },
            {
                type: 'orderedList', content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Topic 1' }] }] },
                ]
            },
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action Items' }] },
            {
                type: 'taskList', content: [
                    { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Action item' }] }] },
                ]
            },
        ],
    },
    {
        id: 'todo-list',
        name: 'To-Do List',
        description: 'Quick task checklist',
        icon: 'listTodo',
        content: [
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '✅ To-Do' }] },
            {
                type: 'taskList', content: [
                    { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1' }] }] },
                    { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 2' }] }] },
                    { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 3' }] }] },
                ]
            },
        ],
    },
    {
        id: 'table-2x3',
        name: 'Table 2x3',
        description: 'Simple 2-column, 3-row table',
        icon: 'table',
        content: [
            {
                type: 'table',
                content: [
                    {
                        type: 'tableRow', content: [
                            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 1' }] }] },
                            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 2' }] }] },
                        ]
                    },
                    {
                        type: 'tableRow', content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
                        ]
                    },
                    {
                        type: 'tableRow', content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] },
                        ]
                    },
                ],
            },
        ],
    },
    {
        id: 'pros-cons',
        name: 'Pros & Cons',
        description: 'Two-column comparison layout',
        icon: 'columns',
        content: [
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '⚖️ Pros & Cons' }] },
            {
                type: 'columnBlock',
                attrs: { columnCount: 2 },
                content: [
                    {
                        type: 'column', content: [
                            { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: '✅ Pros' }] },
                            {
                                type: 'bulletList', content: [
                                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro 1' }] }] },
                                ]
                            },
                        ]
                    },
                    {
                        type: 'column', content: [
                            { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: '❌ Cons' }] },
                            {
                                type: 'bulletList', content: [
                                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Con 1' }] }] },
                                ]
                            },
                        ]
                    },
                ],
            },
        ],
    },
    {
        id: 'callout-info',
        name: 'Info Callout',
        description: 'Highlighted information box',
        icon: 'file',
        content: [
            {
                type: 'callout',
                attrs: { emoji: 'ℹ️', backgroundColor: '#e8f4fd' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Add your important information here...' }] }],
            },
        ],
    },
];

export interface TemplateButtonOptions {
    templates?: ContentTemplate[];
    onTemplateInsert?: (templateId: string) => void;
}

// React component for template button
const TemplateButtonComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    selected,
    deleteNode,
    editor,
    extension,
}) => {
    const { label, selectedTemplateId } = node.attrs;
    const [isEditing, setIsEditing] = useState(!selectedTemplateId);
    const [isInserting, setIsInserting] = useState(false);

    const options = extension.options as TemplateButtonOptions;
    const allTemplates = [...builtInTemplates, ...(options.templates || [])];
    const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId);

    const insertTemplate = async () => {
        if (!selectedTemplate) return;

        setIsInserting(true);
        try {
            // Get the position after this node
            const pos = editor.state.selection.to;

            // Insert the template content
            editor.chain().focus().insertContentAt(pos, selectedTemplate.content).run();

            options.onTemplateInsert?.(selectedTemplate.id);
        } catch (error) {
            console.error('[TemplateButton] Insert failed:', error);
        } finally {
            setIsInserting(false);
        }
    };

    const getIcon = (iconName: string) => {
        const icons: Record<string, React.ReactNode> = {
            calendar: <Calendar className="h-4 w-4" />,
            listTodo: <ListTodo className="h-4 w-4" />,
            table: <Table2 className="h-4 w-4" />,
            columns: <Columns className="h-4 w-4" />,
            file: <FileText className="h-4 w-4" />,
        };
        return icons[iconName] || <Plus className="h-4 w-4" />;
    };

    if (isEditing) {
        return (
            <NodeViewWrapper>
                <div className={`p-4 rounded-lg border-2 border-dashed ${selected ? 'border-primary' : 'border-border'} bg-muted/30`}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Button Label</label>
                            <input
                                type="text"
                                value={label || ''}
                                onChange={(e) => updateAttributes({ label: e.target.value })}
                                placeholder="Insert Template"
                                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Template</label>
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                {allTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => updateAttributes({ selectedTemplateId: template.id })}
                                        className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${selectedTemplateId === template.id
                                                ? 'bg-primary/10 border border-primary'
                                                : 'hover:bg-accent border border-transparent'
                                            }`}
                                    >
                                        <div className="p-1.5 rounded bg-muted">
                                            {getIcon(template.icon)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{template.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{template.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
                                disabled={!selectedTemplateId}
                            >
                                Done
                            </button>
                            <button
                                onClick={deleteNode}
                                className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper>
            <div className={`inline-flex items-center gap-2 my-2 group ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
                <button
                    onClick={insertTemplate}
                    disabled={isInserting || !selectedTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                    {isInserting ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <Plus className="h-4 w-4" />
                            {selectedTemplate && getIcon(selectedTemplate.icon)}
                        </>
                    )}
                    {label || selectedTemplate?.name || 'Insert Template'}
                </button>

                <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
            </div>
        </NodeViewWrapper>
    );
};

export const TemplateButton = Node.create<TemplateButtonOptions>({
    name: 'templateButton',

    group: 'block',

    atom: true,

    addOptions() {
        return {
            templates: [],
            onTemplateInsert: undefined,
        };
    },

    addAttributes() {
        return {
            label: { default: '' },
            selectedTemplateId: { default: '' },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="template-button"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'template-button' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TemplateButtonComponent);
    },
});

export default TemplateButton;
