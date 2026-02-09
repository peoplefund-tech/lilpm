import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

// Use TipTap's NodeViewProps directly
const ToggleComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-2 rounded-lg border border-border/50 overflow-hidden',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {/* Toggle Header */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors',
                        isOpen && 'border-b border-border/50'
                    )}
                >
                    <ChevronRight
                        className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200',
                            isOpen && 'rotate-90'
                        )}
                    />
                    <input
                        type="text"
                        value={node.attrs.title || ''}
                        onChange={(e) => updateAttributes({ title: e.target.value })}
                        placeholder="Toggle title..."
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground"
                    />
                </div>

                {/* Toggle Content */}
                <div
                    className={cn(
                        'overflow-hidden transition-all duration-200',
                        isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    )}
                >
                    <div className="px-3 py-2 pl-9">
                        <NodeViewContent className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
                    </div>
                </div>
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const ToggleNode = Node.create({
    name: 'toggle',
    group: 'block',
    content: 'block+',

    addAttributes() {
        return {
            title: {
                default: '',
                parseHTML: element => element.getAttribute('data-toggle-title') || '',
                renderHTML: attributes => ({
                    'data-toggle-title': attributes.title,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="toggle"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'toggle' }, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ToggleComponent);
    },

    addKeyboardShortcuts() {
        return {
            // Mod+Shift+T to insert toggle
            'Mod-Shift-t': () => {
                return this.editor.commands.insertContent({
                    type: this.name,
                    attrs: { title: '' },
                    content: [{ type: 'paragraph' }],
                });
            },
        };
    },
});

export default ToggleNode;
