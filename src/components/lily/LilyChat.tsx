import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Ticket,
  ChevronDown,
  ChevronRight,
  Loader2,
  Bot,
  User,
  Check,
  X,
  Trash2,
  MessageSquare,
  Plus,
  Clock,
  BarChart3,
  Square,
  Settings,
  Link,
  Pin,
  PinOff,
  Pencil,
  MoreHorizontal,
  GripVertical,
  Brain,
  PanelRightClose,
  PanelRightOpen,
  Code,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useLilyStore } from '@/stores/lilyStore';
import { useTeamStore } from '@/stores/teamStore';
import { useIssueStore } from '@/stores/issueStore';
import { useMCPStore } from '@/stores/mcpStore';
import { SuggestedIssuesList } from './SuggestedIssueCard';
import { cn } from '@/lib/utils';
import type { AIProvider, Issue } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS, Locale } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plug, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const MIN_HISTORY_WIDTH = 200;
const MAX_HISTORY_WIDTH = 400;
const DEFAULT_HISTORY_WIDTH = 256; // 16rem = 256px

// ThinkingBlock component for Chain of Thought
function ThinkingBlock({ content, t }: { content: string; t: (key: string, fallback?: string) => string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!content.trim()) return null;
  
  return (
    <div className="border border-border/50 rounded-md bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Brain className="h-3 w-3 text-violet-500" />
        <span className="font-medium">{t('lily.chainOfThought', 'Thinking Process')}</span>
        {!isExpanded && (
          <span className="text-muted-foreground/70 truncate flex-1 text-left">
            {content.slice(0, 50)}...
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/30">
          {content}
        </div>
      )}
    </div>
  );
}

// ConversationItem component for the sidebar
interface ConversationItemProps {
  conv: { id: string; title: string | null; updatedAt: string };
  isPinned: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editingTitle: string;
  dateLocale: Locale;
  t: (key: string, fallback?: string) => string;
  onSelect: () => void;
  onDelete: () => void;
  onPin: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditingTitleChange: (value: string) => void;
}

function ConversationItem({
  conv,
  isPinned,
  isSelected,
  isEditing,
  editingTitle,
  dateLocale,
  t,
  onSelect,
  onDelete,
  onPin,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingTitleChange,
}: ConversationItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
    >
      {isPinned && <Pin className="h-3 w-3 flex-shrink-0 text-primary" />}
      {!isPinned && <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingTitle}
            onChange={(e) => onEditingTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onBlur={onSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm bg-background border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <p className="text-sm truncate">
            {conv.title || t('lily.untitledConversation', 'Untitled')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: dateLocale })}
        </p>
      </div>
      
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          title={t('common.rename', 'Rename')}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          title={isPinned ? t('lily.unpin', 'Unpin') : t('lily.pin', 'Pin')}
        >
          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={t('common.delete', 'Delete')}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function LilyChat() {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // For Korean IME
  const [historyWidth, setHistoryWidth] = useState(DEFAULT_HISTORY_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  // Handle history panel resize
  const handleHistoryResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = historyWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, startWidth + deltaX));
      setHistoryWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [historyWidth]);

  const AI_PROVIDER_LABELS: Record<AIProvider, { name: string; description: string; icon: string }> = {
    auto: { name: t('lily.auto'), description: t('lily.autoDesc', 'Best available model'), icon: '✨' },
    anthropic: { name: t('lily.claude'), description: 'Anthropic Claude Sonnet', icon: '🟣' },
    openai: { name: t('lily.gpt4'), description: 'OpenAI GPT-4o', icon: '🟢' },
    gemini: { name: t('lily.gemini'), description: 'Google Gemini Pro', icon: '🔵' },
  };
  
  const { 
    messages, 
    isLoading, 
    suggestedIssues,
    selectedProvider,
    conversations,
    currentConversationId,
    artifact,
    showArtifact,
    sendMessage, 
    stopGeneration,
    generatePRD,
    generateTickets,
    acceptSuggestedIssue,
    rejectSuggestedIssue,
    setProvider,
    clearChat,
    loadConversations,
    loadConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    pinConversation,
    analyzeProject,
    toggleArtifactPanel,
  } = useLilyStore();

  // State for editing conversation titles
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pinnedConversations, setPinnedConversations] = useState<string[]>([]);

  // Load pinned conversations from localStorage
  useEffect(() => {
    const pinned = JSON.parse(localStorage.getItem('pinnedConversations') || '[]');
    setPinnedConversations(pinned);
  }, [conversations]);
  
  const { currentTeam } = useTeamStore();
  const { createIssue } = useIssueStore();
  const { connectors, toggleConnector, getActiveConnectors, initializePresetConnectors } = useMCPStore();
  const navigate = useNavigate();

  // Initialize MCP connectors
  useEffect(() => {
    initializePresetConnectors();
  }, [initializePresetConnectors]);

  // Get recently connected MCPs (enabled ones first, sorted by most recent)
  const sortedConnectors = [...connectors].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return 0;
  });

  // Load conversations on mount
  useEffect(() => {
    if (currentTeam?.id) {
      loadConversations(currentTeam.id);
    }
  }, [currentTeam?.id, loadConversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput('');
    await sendMessage(message, { 
      teamId: currentTeam?.id,
      mcpConnectors: connectors,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore Enter during Korean IME composition to prevent partial character submission
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGeneratePRD = async () => {
    await generatePRD();
  };

  const handleGenerateTickets = async () => {
    if (currentTeam) {
      await generateTickets(currentTeam.id);
    }
  };

  const handleNewConversation = async () => {
    if (currentTeam) {
      await createConversation(currentTeam.id);
    } else {
      clearChat();
    }
    setShowHistory(false);
  };

  const handleSelectConversation = async (conversationId: string) => {
    await loadConversation(conversationId);
    setShowHistory(false);
  };

  const handleAnalyzeProject = async () => {
    if (currentTeam) {
      await analyzeProject(currentTeam.id);
    }
  };

  const quickSuggestions = [
    t('lily.suggestion1', 'Plan a new feature'),
    t('lily.suggestion2', 'Write user stories'),
    t('lily.suggestion3', 'Discuss tech specs'),
    t('lily.suggestion4', 'Analyze a bug'),
  ];

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Hidden on desktop (moved to main Sidebar), shown on mobile when toggled */}
      <div 
        className={cn(
          "relative border-r border-border flex flex-col transition-all duration-200 fixed inset-y-0 left-0 z-40 bg-background md:hidden",
          showHistory ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: historyWidth }}
      >
        <div className="h-12 flex items-center px-3 border-b border-border">
          <Button 
            onClick={handleNewConversation} 
            className="w-full gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('lily.newConversation')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                {t('lily.noHistory')}
              </p>
            ) : (
              <>
                {/* Pinned Conversations */}
                {conversations.filter(c => pinnedConversations.includes(c.id)).length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground px-2 mb-1 flex items-center gap-1">
                      <Pin className="h-3 w-3" />
                      {t('lily.pinned', 'Pinned')}
                    </p>
                    {conversations.filter(c => pinnedConversations.includes(c.id)).map((conv) => (
                      <ConversationItem 
                        key={conv.id}
                        conv={conv}
                        isPinned={true}
                        isSelected={currentConversationId === conv.id}
                        isEditing={editingConvId === conv.id}
                        editingTitle={editingTitle}
                        dateLocale={dateLocale}
                        t={t}
                        onSelect={() => handleSelectConversation(conv.id)}
                        onDelete={() => deleteConversation(conv.id)}
                        onPin={() => {
                          pinConversation(conv.id, false);
                          setPinnedConversations(prev => prev.filter(id => id !== conv.id));
                        }}
                        onStartEdit={() => {
                          setEditingConvId(conv.id);
                          setEditingTitle(conv.title || '');
                        }}
                        onSaveEdit={() => {
                          if (editingTitle.trim()) {
                            updateConversationTitle(conv.id, editingTitle.trim());
                          }
                          setEditingConvId(null);
                        }}
                        onCancelEdit={() => setEditingConvId(null)}
                        onEditingTitleChange={setEditingTitle}
                      />
                    ))}
                  </div>
                )}
                
                {/* Recent Conversations */}
                {conversations.filter(c => !pinnedConversations.includes(c.id)).length > 0 && (
                  <div>
                    {pinnedConversations.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                        {t('lily.recent', 'Recent')}
                      </p>
                    )}
                    {conversations.filter(c => !pinnedConversations.includes(c.id)).map((conv) => (
                      <ConversationItem 
                        key={conv.id}
                        conv={conv}
                        isPinned={false}
                        isSelected={currentConversationId === conv.id}
                        isEditing={editingConvId === conv.id}
                        editingTitle={editingTitle}
                        dateLocale={dateLocale}
                        t={t}
                        onSelect={() => handleSelectConversation(conv.id)}
                        onDelete={() => deleteConversation(conv.id)}
                        onPin={() => {
                          pinConversation(conv.id, true);
                          setPinnedConversations(prev => [...prev, conv.id]);
                        }}
                        onStartEdit={() => {
                          setEditingConvId(conv.id);
                          setEditingTitle(conv.title || '');
                        }}
                        onSaveEdit={() => {
                          if (editingTitle.trim()) {
                            updateConversationTitle(conv.id, editingTitle.trim());
                          }
                          setEditingConvId(null);
                        }}
                        onCancelEdit={() => setEditingConvId(null)}
                        onEditingTitleChange={setEditingTitle}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Resize Handle */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hidden md:block",
            "hover:bg-primary/50 transition-colors",
            isResizing && "bg-primary/50"
          )}
          onMouseDown={handleHistoryResize}
        />
      </div>

      {/* Mobile Overlay */}
      {showHistory && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - matches sidebar h-12 */}
        <div className="h-12 flex items-center justify-between px-3 sm:px-4 border-b border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setShowHistory(!showHistory)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{t('lily.title')}</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">{t('lily.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Model Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span>{AI_PROVIDER_LABELS[selectedProvider].icon}</span>
                  <span className="hidden sm:inline">{AI_PROVIDER_LABELS[selectedProvider].name}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('lily.selectModel')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((provider) => (
                  <DropdownMenuItem
                    key={provider}
                    onClick={() => setProvider(provider)}
                    className={cn(
                      "flex items-center gap-2",
                      selectedProvider === provider && "bg-accent"
                    )}
                  >
                    <span>{AI_PROVIDER_LABELS[provider].icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{AI_PROVIDER_LABELS[provider].name}</p>
                      <p className="text-xs text-muted-foreground">{AI_PROVIDER_LABELS[provider].description}</p>
                    </div>
                    {selectedProvider === provider && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Actions */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 hidden sm:flex"
              onClick={handleAnalyzeProject}
              disabled={isLoading}
            >
              <BarChart3 className="h-3 w-3" />
              {t('lily.analyzeProject', 'Analyze')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 hidden sm:flex"
              onClick={handleGeneratePRD}
              disabled={messages.length === 0 || isLoading}
            >
              <FileText className="h-3 w-3" />
              {t('lily.generatePRD', 'PRD')}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 hidden sm:flex"
              onClick={handleGenerateTickets}
              disabled={messages.length === 0 || isLoading}
            >
              <Ticket className="h-3 w-3" />
              {t('lily.generateTickets', 'Tickets')}
            </Button>

            {/* Clear Chat */}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearChat}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('lily.askLily', 'Ask Lily')}</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  {t('lily.welcomeMessage', 'Discuss project ideas, feature requirements, or technical questions to automatically generate PRDs and development tickets.')}
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {quickSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>

                {/* Model Info */}
                <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-md mx-auto">
                  <p className="text-xs text-muted-foreground mb-2">{t('lily.currentModel', 'Current AI Model')}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">{AI_PROVIDER_LABELS[selectedProvider].icon}</span>
                    <span className="font-medium">{AI_PROVIDER_LABELS[selectedProvider].name}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-sm text-muted-foreground">{AI_PROVIDER_LABELS[selectedProvider].description}</span>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={cn(
                    message.role === 'assistant' && "bg-primary text-primary-foreground"
                  )}>
                    {message.role === 'assistant' ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div className="space-y-2">
                      {/* Chain of Thought UI */}
                      {message.thinking && (
                        <ThinkingBlock content={message.thinking} t={t} />
                      )}
                      {/* Parse thinking from content if present */}
                      {message.content.includes('<thinking>') ? (
                        <>
                          <ThinkingBlock 
                            content={message.content.match(/<thinking>([\s\S]*?)<\/thinking>/)?.[1] || ''} 
                            t={t} 
                          />
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>
                              {message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()}
                            </ReactMarkdown>
                          </div>
                        </>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <span className="text-[10px] opacity-70 mt-1 block">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">{t('lily.thinking')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Issues - Enhanced */}
            {suggestedIssues.length > 0 && (
              <SuggestedIssuesList
                issues={suggestedIssues}
                onAcceptIssue={async (index, issue) => {
                  if (currentTeam) {
                    try {
                      await createIssue(currentTeam.id, {
                        title: issue.title || 'Untitled Issue',
                        description: issue.description,
                        priority: issue.priority || 'medium',
                        status: 'backlog',
                      });
                      acceptSuggestedIssue(index);
                      toast.success(t('issues.issueCreated'));
                    } catch (error) {
                      toast.error(t('common.error'));
                    }
                  }
                }}
                onRejectIssue={rejectSuggestedIssue}
                onAcceptAll={async () => {
                  if (currentTeam) {
                    for (let i = suggestedIssues.length - 1; i >= 0; i--) {
                      const issue = suggestedIssues[i];
                      try {
                        await createIssue(currentTeam.id, {
                          title: issue.title || 'Untitled Issue',
                          description: issue.description,
                          priority: issue.priority || 'medium',
                          status: 'backlog',
                        });
                        acceptSuggestedIssue(i);
                      } catch (error) {
                        console.error('Failed to create issue:', error);
                      }
                    }
                    toast.success(t('lily.allIssuesCreated', 'All issues created'));
                  }
                }}
              />
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3 sm:p-4">
          <div className="flex gap-2 items-end">
            {/* MCP Connect Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 flex-shrink-0">
                  <Plug className="h-4 w-4" />
                  {getActiveConnectors().length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                      {getActiveConnectors().length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Plug className="h-4 w-4" />
                  {t('lily.mcpConnections', 'MCPs')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-60 overflow-y-auto">
                  {sortedConnectors.slice(0, 8).map((connector) => (
                    <div
                      key={connector.id}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleConnector(connector.id);
                        toast.success(connector.enabled 
                          ? `${connector.name} disconnected` 
                          : `${connector.name} connected`
                        );
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{connector.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{connector.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            {connector.description}
                          </p>
                        </div>
                      </div>
                      <Switch 
                        checked={connector.enabled} 
                        onCheckedChange={() => {
                          toggleConnector(connector.id);
                          toast.success(connector.enabled 
                            ? `${connector.name} disconnected` 
                            : `${connector.name} connected`
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/settings/mcp')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{t('lily.viewAllMcp', 'View all MCPs')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={t('lily.placeholder')}
              className="min-h-[44px] max-h-[200px] resize-none text-sm flex-1"
              rows={1}
            />
            {isLoading ? (
              <Button 
                onClick={stopGeneration}
                variant="destructive"
                size="icon"
                className="h-11 w-11 flex-shrink-0"
                title={t('lily.stop', 'Stop')}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSend} 
                disabled={!input.trim()}
                size="icon"
                className="h-11 w-11 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 hidden sm:block">
            {AI_PROVIDER_LABELS[selectedProvider].icon} {t('lily.usingModel', 'Using')} {AI_PROVIDER_LABELS[selectedProvider].name}
          </p>
        </div>
      </div>

      {/* Artifact Panel - Real-time Preview */}
      {showArtifact && artifact && (
        <div className="w-96 border-l border-border flex flex-col bg-background">
          {/* Artifact Header */}
          <div className="h-12 flex items-center justify-between px-4 border-b border-border">
            <div className="flex items-center gap-2">
              {artifact.type === 'prd' && <FileText className="h-4 w-4 text-blue-500" />}
              {artifact.type === 'issue' && <Ticket className="h-4 w-4 text-green-500" />}
              {artifact.type === 'code' && <Code className="h-4 w-4 text-amber-500" />}
              {artifact.type === 'document' && <FileText className="h-4 w-4 text-purple-500" />}
              <span className="font-medium text-sm truncate">{artifact.title}</span>
              {artifact.isGenerating && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  navigator.clipboard.writeText(artifact.content);
                  toast.success(t('common.copied', 'Copied!'));
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleArtifactPanel}
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Artifact Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {artifact.type === 'code' ? (
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{artifact.content}</code>
                </pre>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{artifact.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Artifact Footer */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              {artifact.type === 'prd' && (
                <Button size="sm" className="flex-1" onClick={() => {
                  toast.success(t('lily.prdSaved', 'PRD saved!'));
                }}>
                  {t('common.save', 'Save PRD')}
                </Button>
              )}
              {artifact.type === 'issue' && (
                <Button size="sm" className="flex-1" onClick={() => {
                  toast.success(t('lily.issueCreated', 'Issue created!'));
                }}>
                  {t('issues.create', 'Create Issue')}
                </Button>
              )}
              {artifact.type === 'code' && (
                <Button size="sm" className="flex-1" onClick={() => {
                  navigator.clipboard.writeText(artifact.content);
                  toast.success(t('common.copied', 'Code copied!'));
                }}>
                  {t('common.copyCode', 'Copy Code')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
