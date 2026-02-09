import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState } from 'react';
import { Play, Settings, Trash2, ExternalLink, Copy, CheckSquare, MessageSquare, Zap } from 'lucide-react';

/**
 * Button Block Extension
 * Interactive buttons that trigger configurable actions
 */

export type ButtonAction =
    | { type: 'openUrl'; url: string }
    | { type: 'copyToClipboard'; text: string }
    | { type: 'insertTemplate'; templateId: string }
    | { type: 'createTask'; defaultTitle?: string }
    | { type: 'sendNotification'; message: string }
    | { type: 'custom'; handler: string };

export interface ButtonBlockOptions {
    onActionExecute?: (action: ButtonAction, blockId: string) => Promise<void>;
}

// React component for button block
const ButtonBlockComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    selected,
    deleteNode,
    extension,
}) => {
    const { label, variant, actionType, actionPayload, icon } = node.attrs;
    const [isEditing, setIsEditing] = useState(!label);
    const [isExecuting, setIsExecuting] = useState(false);

    const executeAction = async () => {
        if (!actionType) return;

        setIsExecuting(true);
        try {
            const action = { type: actionType, ...JSON.parse(actionPayload || '{}') } as ButtonAction;

            // Handle built-in actions
            switch (action.type) {
                case 'openUrl':
                    window.open((action as any).url, '_blank');
                    break;
                case 'copyToClipboard':
                    await navigator.clipboard.writeText((action as any).text || '');
                    break;
                default: {
                    // Delegate to external handler
                    const options = extension.options as ButtonBlockOptions;
                    await options.onActionExecute?.(action, node.attrs.blockId);
                }
            }
        } catch (error) {
            console.error('[ButtonBlock] Action failed:', error);
        } finally {
            setIsExecuting(false);
        }
    };

    const getIcon = () => {
        const iconMap: Record<string, React.ReactNode> = {
            play: <Play className="h-4 w-4" />,
            link: <ExternalLink className="h-4 w-4" />,
            copy: <Copy className="h-4 w-4" />,
            task: <CheckSquare className="h-4 w-4" />,
            notification: <MessageSquare className="h-4 w-4" />,
            default: <Zap className="h-4 w-4" />,
        };
        return iconMap[icon] || iconMap.default;
    };

    const getVariantStyles = () => {
        const variants: Record<string, string> = {
            primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            outline: 'border border-input bg-background hover:bg-accent',
            ghost: 'hover:bg-accent hover:text-accent-foreground',
            destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        };
        return variants[variant] || variants.primary;
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
                                placeholder="Click me"
                                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Action Type</label>
                            <select
                                value={actionType || ''}
                                onChange={(e) => updateAttributes({ actionType: e.target.value })}
                                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">Select action...</option>
                                <option value="openUrl">Open URL</option>
                                <option value="copyToClipboard">Copy to Clipboard</option>
                                <option value="createTask">Create Task</option>
                                <option value="sendNotification">Send Notification</option>
                            </select>
                        </div>

                        {actionType === 'openUrl' && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">URL</label>
                                <input
                                    type="url"
                                    value={JSON.parse(actionPayload || '{}').url || ''}
                                    onChange={(e) => updateAttributes({
                                        actionPayload: JSON.stringify({ url: e.target.value }),
                                        icon: 'link'
                                    })}
                                    placeholder="https://example.com"
                                    className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                                />
                            </div>
                        )}

                        {actionType === 'copyToClipboard' && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Text to Copy</label>
                                <textarea
                                    value={JSON.parse(actionPayload || '{}').text || ''}
                                    onChange={(e) => updateAttributes({
                                        actionPayload: JSON.stringify({ text: e.target.value }),
                                        icon: 'copy'
                                    })}
                                    placeholder="Text to copy..."
                                    className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background resize-none"
                                    rows={2}
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Style</label>
                            <select
                                value={variant || 'primary'}
                                onChange={(e) => updateAttributes({ variant: e.target.value })}
                                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                                <option value="outline">Outline</option>
                                <option value="ghost">Ghost</option>
                                <option value="destructive">Destructive</option>
                            </select>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
                                disabled={!label}
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
            <div className={`inline-flex items-center gap-2 my-2 ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
                <button
                    onClick={executeAction}
                    disabled={isExecuting || !actionType}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${getVariantStyles()} disabled:opacity-50`}
                >
                    {isExecuting ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                        getIcon()
                    )}
                    {label || 'Button'}
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

export const ButtonBlock = Node.create<ButtonBlockOptions>({
    name: 'buttonBlock',

    group: 'block',

    atom: true,

    addOptions() {
        return {
            onActionExecute: undefined,
        };
    },

    addAttributes() {
        return {
            label: { default: '' },
            variant: { default: 'primary' },
            actionType: { default: '' },
            actionPayload: { default: '{}' },
            icon: { default: 'default' },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="button-block"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'button-block' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ButtonBlockComponent);
    },
});

export default ButtonBlock;
