import React, { useState, useEffect } from 'react';
import { Brain, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineThinkingBlockProps {
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string, defaultValue?: any) => string;
    isStreaming?: boolean;
}

// Timeline ThinkingBlock component - renders OUTSIDE speech bubble like Claude/Gemini
export function TimelineThinkingBlock({ content, t, isStreaming = false }: TimelineThinkingBlockProps) {
    // Auto-expand during streaming, collapsed after completion
    const [isExpanded, setIsExpanded] = useState(isStreaming);

    // Update expansion state based on streaming
    useEffect(() => {
        if (isStreaming) {
            setIsExpanded(true);
        }
    }, [isStreaming]);

    if (!content.trim()) return null;

    return (
        <div className="mb-2">
            {/* Thinking Header - Gemini/Claude style */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 group hover:opacity-80 transition-opacity"
            >
                <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                    isStreaming
                        ? "bg-violet-500/20 border border-violet-500"
                        : "bg-violet-500/10 border border-violet-500/50"
                )}>
                    {isStreaming ? (
                        <Loader2 className="h-2.5 w-2.5 text-violet-500 animate-spin" />
                    ) : (
                        <Brain className="h-2.5 w-2.5 text-violet-500" />
                    )}
                </div>
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                    {isStreaming ? t('lily.thinking', 'Thinking...') : t('lily.thoughtProcess', 'Thought process')}
                </span>
                <ChevronDown className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform duration-200",
                    isExpanded ? "rotate-0" : "-rotate-90"
                )} />
            </button>

            {/* Thinking Content - Dark panel like Gemini */}
            <div className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                isExpanded ? "max-h-[400px] opacity-100 mt-2" : "max-h-0 opacity-0"
            )}>
                <div className="relative rounded-lg bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 overflow-hidden">
                    {/* Content with scroll */}
                    <div className="p-3 max-h-[350px] overflow-y-auto">
                        <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {content}
                            {isStreaming && <span className="animate-pulse text-violet-400">|</span>}
                        </pre>
                    </div>

                    {/* Fade gradient at bottom when content overflows */}
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-900 dark:from-zinc-950 to-transparent pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
