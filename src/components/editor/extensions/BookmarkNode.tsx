import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Link2, ExternalLink, Globe, Loader2, X } from 'lucide-react';

interface BookmarkData {
    title: string;
    description: string;
    image: string | null;
    favicon: string | null;
    url: string;
}

// Use TipTap's NodeViewProps directly
const BookmarkComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { url, title, description, image, favicon } = node.attrs;

    const fetchMetadata = async (inputUrl: string) => {
        setIsLoading(true);
        setError(null);

        try {
            // Use a CORS proxy or backend service for metadata
            // For now, we'll simulate with basic data
            const formattedUrl = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;
            const domain = new URL(formattedUrl).hostname;

            // In production, you'd call an API to fetch Open Graph data
            // For now, set basic info
            updateAttributes({
                url: formattedUrl,
                title: title || domain,
                description: description || 'Click to visit this link',
                favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            });
        } catch (err) {
            setError('Invalid URL');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-4 rounded-lg border overflow-hidden',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {!url ? (
                    // URL Input
                    <div className="p-6 bg-muted/50 text-center">
                        <Link2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                        <div className="max-w-md mx-auto">
                            <input
                                type="url"
                                placeholder="Paste a link to create bookmark..."
                                className="w-full px-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const target = e.target as HTMLInputElement;
                                        if (target.value) {
                                            fetchMetadata(target.value);
                                        }
                                    }
                                }}
                                onBlur={(e) => {
                                    if (e.target.value) {
                                        fetchMetadata(e.target.value);
                                    }
                                }}
                            />
                            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
                        </div>
                    </div>
                ) : (
                    // Bookmark Card
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex hover:bg-muted/30 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Content */}
                        <div className="flex-1 p-4 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                {favicon ? (
                                    <img src={favicon} alt="" className="h-4 w-4" />
                                ) : (
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-xs text-muted-foreground truncate">
                                    {new URL(url).hostname}
                                </span>
                            </div>
                            <h4 className="font-medium text-sm truncate">{title || 'Untitled'}</h4>
                            {description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
                            )}
                        </div>

                        {/* Image Preview */}
                        {image && (
                            <div className="w-32 h-24 flex-shrink-0 bg-muted">
                                <img
                                    src={image}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                        )}

                        {/* External Link Icon */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </a>
                )}

                {isLoading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const BookmarkNode = Node.create({
    name: 'bookmark',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url: {
                default: '',
                parseHTML: element => element.getAttribute('data-url') || '',
                renderHTML: attributes => ({ 'data-url': attributes.url }),
            },
            title: {
                default: '',
                parseHTML: element => element.getAttribute('data-title') || '',
                renderHTML: attributes => ({ 'data-title': attributes.title }),
            },
            description: {
                default: '',
                parseHTML: element => element.getAttribute('data-description') || '',
                renderHTML: attributes => ({ 'data-description': attributes.description }),
            },
            image: {
                default: null,
                parseHTML: element => element.getAttribute('data-image'),
                renderHTML: attributes => ({ 'data-image': attributes.image }),
            },
            favicon: {
                default: null,
                parseHTML: element => element.getAttribute('data-favicon'),
                renderHTML: attributes => ({ 'data-favicon': attributes.favicon }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="bookmark"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'bookmark' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(BookmarkComponent);
    },
});

export default BookmarkNode;
