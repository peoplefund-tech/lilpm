import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Ticket,
  ChevronDown,
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
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plug, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const MIN_HISTORY_WIDTH = 200;
const MAX_HISTORY_WIDTH = 400;
const DEFAULT_HISTORY_WIDTH = 256; // 16rem = 256px

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
    analyzeProject,
  } = useLilyStore();
  
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
      {/* Sidebar - Conversation History with Resize Handle */}
      <div 
        className={cn(
          "relative border-r border-border flex flex-col transition-all duration-200 fixed md:relative inset-y-0 left-0 z-40 bg-background",
          showHistory ? "translate-x-0" : "-translate-x-full md:translate-x-0"
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
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent",
                    currentConversationId === conv.id && "bg-accent"
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {conv.title || t('lily.untitledConversation', 'Untitled')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
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

            {/* MCP Connect */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plug className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('lily.connect', 'Connect')}</span>
                  {getActiveConnectors().length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {getActiveConnectors().length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
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
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
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
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={t('lily.placeholder')}
              className="min-h-[44px] max-h-[200px] resize-none text-sm"
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
    </div>
  );
}
