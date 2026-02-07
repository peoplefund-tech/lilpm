import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { List, RefreshCw } from 'lucide-react';

interface TocHeading {
    level: number;
    text: string;
    id: string;
}

// Use TipTap's NodeViewProps directly
const TocComponent: React.FC<any> = ({ editor, selected }) => {
    const [headings, setHeadings] = useState<TocHeading[]>([]);

    const extractHeadings = () => {
        const items: TocHeading[] = [];

        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
                const level = node.attrs.level;
                const text = node.textContent;
                const id = `heading-${pos}`;
                items.push({ level, text, id });
            }
        });

        setHeadings(items);
    };

    useEffect(() => {
        extractHeadings();
        // Re-extract when document changes
        const handleUpdate = () => extractHeadings();
        // Note: In a real implementation, you'd subscribe to editor updates
        return () => { };
    }, [editor.state.doc]);

    const getLevelPadding = (level: number) => {
        return `${(level - 1) * 16}px`;
    };

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-4 p-4 rounded-lg border bg-muted/30',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <List className="h-4 w-4" />
                        Table of Contents
                    </div>
                    <button
                        onClick={extractHeadings}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>

                {headings.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                        Add headings to your document to see them here.
                    </p>
                ) : (
                    <nav className="space-y-1">
                        {headings.map((heading, index) => (
                            <a
                                key={`${heading.id}-${index}`}
                                href={`#${heading.id}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    // Scroll to heading in editor
                                    const element = document.getElementById(heading.id);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }}
                                className={cn(
                                    'block py-1 text-sm hover:text-primary transition-colors',
                                    heading.level === 1 && 'font-semibold',
                                    heading.level === 2 && 'text-muted-foreground',
                                    heading.level >= 3 && 'text-muted-foreground/80 text-xs'
                                )}
                                style={{ paddingLeft: getLevelPadding(heading.level) }}
                            >
                                {heading.text || `Heading ${heading.level}`}
                            </a>
                        ))}
                    </nav>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const TableOfContentsNode = Node.create({
    name: 'tableOfContents',
    group: 'block',
    atom: true,

    parseHTML() {
        return [
            {
                tag: 'div[data-type="toc"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'toc' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TocComponent);
    },
});

export default TableOfContentsNode;
