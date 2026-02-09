import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

/**
 * Column Layout Extension
 * Enables side-by-side block layouts (2-column, 3-column)
 */

// Column wrapper node
export const ColumnBlock = Node.create({
    name: 'columnBlock',

    group: 'block',

    content: 'column+',

    defining: true,

    addAttributes() {
        return {
            columnCount: {
                default: 2,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="column-block"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column-block',
                class: 'column-block',
                style: `display: grid; grid-template-columns: repeat(${HTMLAttributes.columnCount || 2}, 1fr); gap: 16px;`,
            }),
            0,
        ];
    },
});

// Individual column node
export const Column = Node.create({
    name: 'column',

    group: 'column',

    content: 'block+',

    defining: true,

    parseHTML() {
        return [
            {
                tag: 'div[data-type="column"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column',
                class: 'column',
                style: 'min-height: 40px; padding: 8px; border: 1px dashed transparent; border-radius: 4px;',
            }),
            0,
        ];
    },
});

// React component for column block with controls
const ColumnBlockComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    deleteNode,
    selected,
    editor,
}) => {
    const columnCount = node.attrs.columnCount || 2;

    const addColumn = () => {
        if (columnCount < 4) {
            updateAttributes({ columnCount: columnCount + 1 });
            // Add new column content
            editor.chain().focus().insertContentAt(
                editor.state.selection.to,
                { type: 'column', content: [{ type: 'paragraph' }] }
            ).run();
        }
    };

    const removeColumn = () => {
        if (columnCount > 2) {
            updateAttributes({ columnCount: columnCount - 1 });
        }
    };

    return (
        <NodeViewWrapper>
            <div
                className={`relative group my-4 ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}
            >
                {/* Column controls */}
                <div className="absolute -top-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-popover border rounded-md shadow-sm p-1 z-10">
                    <button
                        onClick={() => updateAttributes({ columnCount: 2 })}
                        className={`px-2 py-1 text-xs rounded ${columnCount === 2 ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        2 cols
                    </button>
                    <button
                        onClick={() => updateAttributes({ columnCount: 3 })}
                        className={`px-2 py-1 text-xs rounded ${columnCount === 3 ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        3 cols
                    </button>
                    <button
                        onClick={() => updateAttributes({ columnCount: 4 })}
                        className={`px-2 py-1 text-xs rounded ${columnCount === 4 ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        4 cols
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <button
                        onClick={deleteNode}
                        className="p-1 hover:bg-destructive/10 text-destructive rounded"
                        title="Remove columns"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>

                {/* Columns grid */}
                <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
                    data-node-view-content
                />
            </div>
        </NodeViewWrapper>
    );
};

// NodeView version of ColumnBlock
export const ColumnBlockNodeView = Node.create({
    name: 'columnBlock',

    group: 'block',

    content: 'column+',

    defining: true,

    addAttributes() {
        return {
            columnCount: {
                default: 2,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="column-block"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column-block',
                class: 'column-block',
            }),
            0,
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ColumnBlockComponent);
    },
});

/**
 * CSS for column layout (add to editor styles)
 */
export const columnLayoutCSS = `
.column-block {
  display: grid;
  gap: 16px;
  margin: 16px 0;
}

.column-block[data-column-count="2"] {
  grid-template-columns: repeat(2, 1fr);
}

.column-block[data-column-count="3"] {
  grid-template-columns: repeat(3, 1fr);
}

.column-block[data-column-count="4"] {
  grid-template-columns: repeat(4, 1fr);
}

.column {
  min-height: 40px;
  padding: 8px;
  border-radius: 4px;
  border: 1px dashed transparent;
  transition: border-color 0.15s ease;
}

.column:hover {
  border-color: hsl(var(--border));
}

.column:focus-within {
  border-color: hsl(var(--primary) / 0.5);
}

/* Responsive: stack on mobile */
@media (max-width: 640px) {
  .column-block {
    grid-template-columns: 1fr !important;
  }
}
`;

export default { ColumnBlock, Column, ColumnBlockNodeView };
