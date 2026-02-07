import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, AlertOctagon, Lightbulb, ChevronDown } from 'lucide-react';

// Callout types and their configurations
const CALLOUT_CONFIGS = {
    info: {
        icon: Info,
        bgClass: 'bg-blue-50 dark:bg-blue-950/30',
        borderClass: 'border-blue-200 dark:border-blue-800',
        iconClass: 'text-blue-500',
    },
    warning: {
        icon: AlertTriangle,
        bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
        borderClass: 'border-yellow-200 dark:border-yellow-800',
        iconClass: 'text-yellow-500',
    },
    error: {
        icon: AlertOctagon,
        bgClass: 'bg-red-50 dark:bg-red-950/30',
        borderClass: 'border-red-200 dark:border-red-800',
        iconClass: 'text-red-500',
    },
    tip: {
        icon: Lightbulb,
        bgClass: 'bg-green-50 dark:bg-green-950/30',
        borderClass: 'border-green-200 dark:border-green-800',
        iconClass: 'text-green-500',
    },
} as const;

type CalloutType = keyof typeof CALLOUT_CONFIGS;

// Use TipTap's NodeViewProps directly
const CalloutComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const calloutType = node.attrs.type || 'info';
    const config = CALLOUT_CONFIGS[calloutType] || CALLOUT_CONFIGS.info;
    const IconComponent = config.icon;

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-4 p-4 rounded-lg border flex gap-3 relative group',
                    config.bgClass,
                    config.borderClass,
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {/* Icon with type selector */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                        className={cn(
                            'p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
                            config.iconClass
                        )}
                    >
                        <IconComponent className="h-5 w-5" />
                    </button>

                    {/* Type dropdown */}
                    {isTypeDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1 min-w-[120px]">
                            {(Object.keys(CALLOUT_CONFIGS) as CalloutType[]).map((type) => {
                                const typeConfig = CALLOUT_CONFIGS[type];
                                const TypeIcon = typeConfig.icon;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => {
                                            updateAttributes({ type });
                                            setIsTypeDropdownOpen(false);
                                        }}
                                        className={cn(
                                            'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm capitalize hover:bg-accent',
                                            calloutType === type && 'bg-accent'
                                        )}
                                    >
                                        <TypeIcon className={cn('h-4 w-4', typeConfig.iconClass)} />
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <NodeViewContent className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
                </div>
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const CalloutNode = Node.create({
    name: 'callout',
    group: 'block',
    content: 'block+',

    addAttributes() {
        return {
            type: {
                default: 'info',
                parseHTML: element => element.getAttribute('data-callout-type') || 'info',
                renderHTML: attributes => ({
                    'data-callout-type': attributes.type,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="callout"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'callout' }, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CalloutComponent);
    },

    addKeyboardShortcuts() {
        return {
            // Mod+Shift+C to insert callout
            'Mod-Shift-c': () => {
                return this.editor.commands.insertContent({
                    type: this.name,
                    attrs: { type: 'info' },
                    content: [{ type: 'paragraph' }],
                });
            },
        };
    },
});

export default CalloutNode;
