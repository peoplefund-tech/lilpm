import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { cn } from '@/lib/utils';
import { Play, ExternalLink } from 'lucide-react';

// Extract video ID from various URL formats
const extractVideoId = (url: string): { provider: 'youtube' | 'vimeo' | null; id: string | null } => {
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
        /youtube\.com\/shorts\/([^&\s?]+)/,
    ];

    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match) {
            return { provider: 'youtube', id: match[1] };
        }
    }

    // Vimeo patterns
    const vimeoPattern = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoPattern);
    if (vimeoMatch) {
        return { provider: 'vimeo', id: vimeoMatch[1] };
    }

    return { provider: null, id: null };
};

// Use TipTap's NodeViewProps directly
const VideoComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const { src, caption } = node.attrs;
    const { provider, id } = extractVideoId(src || '');

    const embedUrl = provider === 'youtube'
        ? `https://www.youtube.com/embed/${id}`
        : provider === 'vimeo'
            ? `https://player.vimeo.com/video/${id}`
            : null;

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-4 rounded-lg overflow-hidden border',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {!src ? (
                    // URL Input
                    <div className="p-8 bg-muted/50 text-center">
                        <Play className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                        <input
                            type="url"
                            placeholder="Paste YouTube or Vimeo URL..."
                            className="w-full max-w-md mx-auto block px-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    updateAttributes({ src: target.value });
                                }
                            }}
                            onBlur={(e) => {
                                if (e.target.value) {
                                    updateAttributes({ src: e.target.value });
                                }
                            }}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Supports YouTube and Vimeo videos
                        </p>
                    </div>
                ) : embedUrl ? (
                    // Embedded Video
                    <div>
                        <div className="relative aspect-video bg-black">
                            <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                        <div className="p-2 bg-muted/30 flex items-center justify-between">
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => updateAttributes({ caption: e.target.value })}
                                placeholder="Add a caption..."
                                className="flex-1 bg-transparent text-xs text-muted-foreground focus:outline-none"
                            />
                            <a
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                ) : (
                    // Invalid URL
                    <div className="p-4 bg-destructive/10 text-destructive text-sm text-center">
                        Invalid video URL. Please use YouTube or Vimeo links.
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const VideoNode = Node.create({
    name: 'video',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            src: {
                default: '',
                parseHTML: element => element.getAttribute('data-video-src') || '',
                renderHTML: attributes => ({
                    'data-video-src': attributes.src,
                }),
            },
            caption: {
                default: '',
                parseHTML: element => element.getAttribute('data-video-caption') || '',
                renderHTML: attributes => ({
                    'data-video-caption': attributes.caption,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="video"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'video' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoComponent);
    },
});

export default VideoNode;
