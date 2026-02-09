import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calculator } from 'lucide-react';

// We'll use KaTeX for LaTeX rendering
// Users need to install katex: npm install katex @types/katex
// And import CSS: import 'katex/dist/katex.min.css';

// Use TipTap's NodeViewProps directly
const EquationComponent: React.FC<any> = ({ node, updateAttributes, selected }) => {
    const [isEditing, setIsEditing] = useState(!node.attrs.latex);
    const [inputValue, setInputValue] = useState(node.attrs.latex || '');
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isEditing && outputRef.current && node.attrs.latex) {
            // Dynamically import and render KaTeX
            import('katex').then((katex) => {
                try {
                    katex.default.render(node.attrs.latex, outputRef.current!, {
                        displayMode: node.attrs.display,
                        throwOnError: false,
                    });
                } catch (error) {
                    if (outputRef.current) {
                        outputRef.current.textContent = 'Invalid LaTeX';
                    }
                }
            }).catch(() => {
                // KaTeX not installed, show plaintext
                if (outputRef.current) {
                    outputRef.current.textContent = node.attrs.latex;
                }
            });
        }
    }, [isEditing, node.attrs.latex, node.attrs.display]);

    const handleSave = () => {
        updateAttributes({ latex: inputValue });
        setIsEditing(false);
    };

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-2 rounded-lg overflow-hidden',
                    node.attrs.display ? 'block' : 'inline-block',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {isEditing ? (
                    <div className="p-3 bg-muted/50 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calculator className="h-3 w-3" />
                            <span>LaTeX Equation</span>
                            <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={node.attrs.display}
                                    onChange={(e) => updateAttributes({ display: e.target.checked })}
                                    className="h-3 w-3"
                                />
                                Block mode
                            </label>
                        </div>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSave();
                                }
                            }}
                            placeholder="Enter LaTeX equation (e.g., E = mc^2)"
                            autoFocus
                            className="w-full px-3 py-2 rounded border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                                Save
                            </button>
                            {node.attrs.latex && (
                                <button
                                    onClick={() => {
                                        setInputValue(node.attrs.latex);
                                        setIsEditing(false);
                                    }}
                                    className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => setIsEditing(true)}
                        className={cn(
                            'cursor-pointer hover:bg-muted/30 rounded transition-colors',
                            node.attrs.display ? 'p-4 text-center' : 'px-1'
                        )}
                    >
                        <div ref={outputRef} className="[&_.katex]:text-base" />
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const EquationNode = Node.create({
    name: 'equation',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            latex: {
                default: '',
                parseHTML: element => element.getAttribute('data-latex') || '',
                renderHTML: attributes => ({
                    'data-latex': attributes.latex,
                }),
            },
            display: {
                default: true,
                parseHTML: element => element.getAttribute('data-display') === 'true',
                renderHTML: attributes => ({
                    'data-display': attributes.display ? 'true' : 'false',
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="equation"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'equation' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(EquationComponent);
    },

    addKeyboardShortcuts() {
        return {
            // Mod+Shift+E to insert equation
            'Mod-Shift-e': () => {
                return this.editor.commands.insertContent({
                    type: this.name,
                    attrs: { latex: '', display: true },
                });
            },
        };
    },
});

export default EquationNode;
