import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import {
    Bot,
    User,
    Loader2,
    FileText,
    CheckCircle,
    Pencil,
    Copy,
    RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { TimelineThinkingBlock } from '../shared/TimelineThinkingBlock';
import { isPRDLikeContent, cleanMessageContent, extractThinkingContent } from '../utils';
import type { LilyMessage } from '@/types';

interface ChatMessageProps {
    message: LilyMessage;
    messages: LilyMessage[];
    isLoading: boolean;
    canvasMode: boolean;
    showCanvasPanel: boolean;
    suggestedIssuesLength: number;
    savedPRDId?: string;
    isSavingThisMessage: boolean;
    onSaveAsPRD: (content: string, title: string, messageId: string) => void;
    onViewPRD: (prdId: string) => void;
    onEditMessage: (content: string, messageId: string) => void;
    onCopyMessage: (content: string) => void;
    onRetryMessage: (content: string, messageIndex: number) => void;
}

export const ChatMessage = memo(function ChatMessage({
    message,
    messages,
    isLoading,
    canvasMode,
    showCanvasPanel,
    suggestedIssuesLength,
    savedPRDId,
    isSavingThisMessage,
    onSaveAsPRD,
    onViewPRD,
    onEditMessage,
    onCopyMessage,
    onRetryMessage,
}: ChatMessageProps) {
    const { t } = useTranslation();

    // Extract thinking content
    const { thinking: extractedThinking, cleanContent: rawCleanContent } = extractThinkingContent(message.content);
    const thinkingContent = message.thinking || extractedThinking;
    const cleanContent = cleanMessageContent(rawCleanContent || message.content, canvasMode, showCanvasPanel);

    // Determine if this is a PRD-like content
    const isPRD = isPRDLikeContent(cleanContent || '');
    const hasIssues = suggestedIssuesLength > 0;
    const shouldShowPRDButton = message.role === 'assistant' && isPRD && !hasIssues && !isLoading;
    const messageIndex = messages.indexOf(message);
    const isLastMessage = messageIndex === messages.length - 1;

    return (
        <div data-message-id={message.id} className="group/message">
            {/* Timeline Thinking Block */}
            {message.role === 'assistant' && thinkingContent && (
                <TimelineThinkingBlock
                    content={thinkingContent}
                    t={t}
                    isStreaming={isLoading && isLastMessage}
                />
            )}

            {/* Message bubble */}
            <div className={cn(
                "flex gap-2",
                message.role === 'user' && "flex-row-reverse"
            )}>
                <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className={cn(
                        "text-xs",
                        message.role === 'assistant' && "bg-primary text-primary-foreground"
                    )}>
                        {message.role === 'assistant' ? (
                            <Bot className="h-3 w-3" />
                        ) : (
                            <User className="h-3 w-3" />
                        )}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 max-w-[85%] sm:max-w-[85%]">
                    {/* Speech Bubble */}
                    <div
                        className={cn(
                            "rounded-lg px-3 py-1.5",
                            message.role === 'user'
                                ? "bg-primary text-primary-foreground text-[13px]"
                                : "bg-muted"
                        )}
                    >
                        {message.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-hidden
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              [&_p]:my-3 [&_p]:leading-7
              [&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1
              [&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1
              [&_li]:leading-7 [&_li]:pl-1
              [&_li_p]:my-1
              [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground
              [&_h4]:text-sm [&_h4]:font-medium [&_h4]:mt-3 [&_h4]:mb-1
              [&_code]:text-xs [&_code]:bg-muted/70 [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono
              [&_pre]:my-4 [&_pre]:bg-zinc-900 [&_pre]:dark:bg-zinc-950 [&_pre]:text-zinc-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border
              [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:text-xs
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:bg-muted/30 [&_blockquote]:py-2 [&_blockquote]:pr-4 [&_blockquote]:rounded-r-lg
              [&_strong]:font-semibold [&_strong]:text-foreground
              [&_em]:italic [&_em]:text-foreground/90
              [&_hr]:my-6 [&_hr]:border-border
              [&_table]:my-4 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden
              [&_thead]:bg-muted/70
              [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-left [&_th]:text-foreground [&_th]:bg-muted/50
              [&_tbody]:divide-y [&_tbody]:divide-border
              [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-muted-foreground
              [&_tr]:transition-colors
              [&_tbody_tr:hover]:bg-muted/30
              [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:font-medium hover:[&_a]:text-primary/80
              [&_img]:rounded-lg [&_img]:my-4
              [&_del]:line-through [&_del]:text-muted-foreground
            ">
                                {isLoading && isLastMessage && thinkingContent && !cleanContent ? (
                                    <span className="text-muted-foreground italic">{t('lily.thinking', 'Thinking...')}</span>
                                ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent || t('lily.generating', 'Generating...')}</ReactMarkdown>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanContent}</p>
                        )}
                        <span className="text-[9px] opacity-60 mt-0.5 block">
                            {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                    </div>

                    {/* User Message Actions */}
                    {message.role === 'user' && (
                        <div className="flex items-center gap-0.5 mt-1 ml-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => onEditMessage(cleanContent, message.id)}
                                title={t('lily.edit', '수정')}
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => onCopyMessage(cleanContent)}
                                title={t('lily.copy', '복사')}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => onRetryMessage(cleanContent, messageIndex)}
                                title={t('lily.retry', '다시 시도')}
                            >
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* PRD Save Button */}
                    {shouldShowPRDButton && (
                        <div className="mt-2">
                            {savedPRDId ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={() => onViewPRD(savedPRDId)}
                                >
                                    <CheckCircle className="h-3 w-3" />
                                    {t('lily.viewSavedPRD', '저장된 PRD 보러 가기')}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 h-7 text-xs"
                                    disabled={isSavingThisMessage}
                                    onClick={() => {
                                        const titleMatch = (cleanContent || '').match(/^#+\s+(.+)$/m);
                                        const title = titleMatch?.[1] || t('lily.untitledPRD', 'Untitled PRD');
                                        onSaveAsPRD(cleanContent || '', title, message.id);
                                    }}
                                >
                                    {isSavingThisMessage ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <FileText className="h-3 w-3" />
                                    )}
                                    {isSavingThisMessage
                                        ? t('lily.savingPRD', '저장 중...')
                                        : t('lily.saveAsPRD', 'PRD로 저장')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default ChatMessage;
