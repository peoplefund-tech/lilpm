import React, { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineThinkingBlockProps {
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string, defaultValue?: any) => string;
    isStreaming?: boolean;
}

// Timeline ThinkingBlock component - renders OUTSIDE speech bubble like Claude/Gemini
export function TimelineThinkingBlock({ content, t, isStreaming = false }: TimelineThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

    if (!content.trim()) return null;

    return (
        <div className="flex gap-2 py-1.5">
            {/* Timeline icon with connector */}
            <div className="flex flex-col items-center">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors",
                    isStreaming
                        ? "border-violet-500 bg-violet-500/20"
                        : "border-violet-500/50 bg-violet-500/10"
                )}>
                    <Brain className={cn(
                        "h-3 w-3 text-violet-500",
                        isStreaming && "animate-pulse"
                    )} />
                </div>
                {/* Connector line */}
                <div className="w-0.5 flex-1 bg-gradient-to-b from-violet-500/30 to-transparent min-h-[8px]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-1.5">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity group"
                >
                    <span className="font-medium text-violet-600 dark:text-violet-400">
                        {isStreaming ? t('lily.thinking', 'Thinking...') : t('lily.thoughtProcess', 'Thought process')}
                    </span>
                    {isStreaming ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-violet-500" />
                    ) : (
                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    )}
                </button>

                <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    isExpanded ? "max-h-[300px] opacity-100 mt-1.5" : "max-h-0 opacity-0"
                )}>
                    <div className="text-xs text-muted-foreground/80 whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-violet-500/20 bg-violet-500/5 rounded-r-md py-1.5 pr-2">
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
}
