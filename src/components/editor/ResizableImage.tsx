import React, { useState, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { cn } from '@/lib/utils';

/**
 * Resizable Image Component for TipTap editor
 * Allows users to resize images by dragging handles or entering width directly
 */
export const ResizableImageComponent = ({ node, updateAttributes, selected }: NodeViewProps) => {
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
                selected && "ring-2 ring-cyan-500 rounded-lg",
                isResizing && "select-none",
                !selected && "hover:ring-2 hover:ring-cyan-400/60 rounded-lg transition-all"
            )}>
                <img
                    ref={imageRef}
                    src={node.attrs.src}
                    alt={node.attrs.alt || ''}
                    style={{ width: node.attrs.width ? `${node.attrs.width}px` : 'auto' }}
                    className="rounded-lg max-w-full"
                    draggable={false}
                />

                {/* Resize handles - visible on hover (not just selected) */}
                <>
                    {/* Left handle */}
                    <div
                        className={cn(
                            "absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-cyan-500/50 rounded-l-lg transition-opacity",
                            selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                        )}
                        onMouseDown={(e) => handleMouseDown(e, 'left')}
                    />
                    {/* Right handle */}
                    <div
                        className={cn(
                            "absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-cyan-500/50 rounded-r-lg transition-opacity",
                            selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                        )}
                        onMouseDown={(e) => handleMouseDown(e, 'right')}
                    />

                    {/* Width input at bottom center */}
                    <div className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1 z-10 transition-opacity",
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
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
            </div>
        </NodeViewWrapper>
    );
};

/**
 * Custom Resizable Image Extension for TipTap
 * Extends the base Image extension with resizing capabilities
 */
export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute('width'),
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { width: attributes.width };
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageComponent);
    },
});

export default ResizableImage;
