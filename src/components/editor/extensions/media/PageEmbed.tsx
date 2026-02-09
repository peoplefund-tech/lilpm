import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';

/**
 * PageEmbed Extension
 * Embeds a sub-page as a block within the editor
 */

interface EmbeddedPage {
    id: string;
    title: string;
    type: 'prd' | 'issue';
    emoji?: string;
}

// React component for page embed
const PageEmbedComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    selected,
    deleteNode,
}) => {
    const { pageId, pageType, pageTitle, pageEmoji } = node.attrs;
    const [isLoading, setIsLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(!pageId);

    const handlePageSelect = async (page: EmbeddedPage) => {
        updateAttributes({
            pageId: page.id,
            pageType: page.type,
            pageTitle: page.title,
            pageEmoji: page.emoji || '📄',
        });
        setShowPicker(false);
    };

    const navigateToPage = () => {
        if (!pageId || !pageType) return;
        const path = pageType === 'prd' ? `/prd/${pageId}` : `/issues/${pageId}`;
        window.location.href = path;
    };

    if (showPicker || !pageId) {
        return (
            <NodeViewWrapper>
                <div
                    className={`p-4 rounded-lg border-2 border-dashed ${selected ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                        }`}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Embed a Page</span>
                    </div>

                    <input
                        type="text"
                        placeholder="Search for a page to embed..."
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                deleteNode();
                            }
                        }}
                    />

                    <p className="text-xs text-muted-foreground mt-2">
                        Type to search PRDs or Issues, or paste a page link
                    </p>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper>
            <div
                className={`group relative flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${selected ? 'ring-2 ring-primary' : 'border-border'
                    }`}
                onClick={navigateToPage}
            >
                {/* Page icon/emoji */}
                <div className="flex-shrink-0 h-10 w-10 rounded-md bg-muted flex items-center justify-center text-lg">
                    {pageEmoji || '📄'}
                </div>

                {/* Page info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-medium">
                            {pageType === 'prd' ? 'PRD' : 'Issue'}
                        </span>
                    </div>
                    <h4 className="font-medium truncate">{pageTitle || 'Untitled'}</h4>
                </div>

                {/* Open link icon */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
        </NodeViewWrapper>
    );
};

export const PageEmbed = Node.create({
    name: 'pageEmbed',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            pageId: {
                default: null,
            },
            pageType: {
                default: 'prd', // 'prd' | 'issue'
            },
            pageTitle: {
                default: null,
            },
            pageEmoji: {
                default: '📄',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="page-embed"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-embed' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(PageEmbedComponent);
    },
});

export default PageEmbed;
