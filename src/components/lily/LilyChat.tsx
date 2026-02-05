import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Paperclip,
  Image,
  File,
  FileCode,
  FileSpreadsheet,
  Film,
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
import { ApiKeyRequiredModal } from './ApiKeyRequiredModal';
import { cn } from '@/lib/utils';
import type { AIProvider, Issue } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS, Locale } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plug, ExternalLink, Eye, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAISettings } from '@/hooks/useAISettings';

const MIN_HISTORY_WIDTH = 200;
const MAX_HISTORY_WIDTH = 400;
const DEFAULT_HISTORY_WIDTH = 256; // 16rem = 256px

// Timeline ThinkingBlock component - renders OUTSIDE speech bubble like Claude/Gemini
function TimelineThinkingBlock({ content, t, isStreaming = false }: { content: string; t: (key: string, options?: any) => string; isStreaming?: boolean }) {
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

// ConversationItem component for the sidebar
interface ConversationItemProps {
  conv: { id: string; title: string | null; updatedAt: string };
  isPinned: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editingTitle: string;
  dateLocale: Locale;
  t: (key: string, options?: any) => string;
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

// File upload types
interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  base64?: string;
  type: 'image' | 'video' | 'pdf' | 'document' | 'code' | 'spreadsheet' | 'other';
}

// Allowed file types and their categories
const FILE_TYPE_MAP: Record<string, UploadedFile['type']> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'text/plain': 'code',
  'text/javascript': 'code',
  'text/typescript': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/json': 'code',
  'application/xml': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-c': 'code',
  'text/x-cpp': 'code',
};

// Get file type icon
function getFileTypeIcon(type: UploadedFile['type']) {
  switch (type) {
    case 'image': return <Image className="h-4 w-4" />;
    case 'video': return <Film className="h-4 w-4" />;
    case 'pdf': return <FileText className="h-4 w-4" />;
    case 'document': return <FileText className="h-4 w-4" />;
    case 'spreadsheet': return <FileSpreadsheet className="h-4 w-4" />;
    case 'code': return <FileCode className="h-4 w-4" />;
    default: return <File className="h-4 w-4" />;
  }
}

export function LilyChat() {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // For Korean IME
  const [historyWidth, setHistoryWidth] = useState(DEFAULT_HISTORY_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // API Key validation
  const { hasAnyApiKey, isLoading: isLoadingApiKeys, saveApiKey, loadSettings } = useAISettings();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Show API key modal if no keys are set
  useEffect(() => {
    if (!isLoadingApiKeys && !hasAnyApiKey) {
      setShowApiKeyModal(true);
    }
  }, [isLoadingApiKeys, hasAnyApiKey]);

  // Load pinned conversations from localStorage
  useEffect(() => {
    const pinned = JSON.parse(localStorage.getItem('pinnedConversations') || '[]');
    setPinnedConversations(pinned);
  }, [conversations]);

  const { currentTeam } = useTeamStore();
  const { createIssue } = useIssueStore();
  const { connectors, toggleConnector, getActiveConnectors, initializePresetConnectors } = useMCPStore();
  const navigate = useNavigate();

  // Canvas mode state
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasViewMode, setCanvasViewMode] = useState<'code' | 'preview'>('code');
  const [canvasCode, setCanvasCode] = useState('');
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false); // Only show panel when code detected

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

  // Track previous loading state for auto-preview
  const prevIsLoading = useRef(isLoading);

  // Extract canvas code from latest assistant message when in canvas mode
  useEffect(() => {
    if (!canvasMode || messages.length === 0) return;

    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return;

    const content = lastAssistantMessage.content;

    // Try to extract code blocks from the message (including partial blocks during streaming)
    // Match ```jsx, ```tsx, ```javascript, ```typescript, etc.
    const codeBlockMatch = content.match(/```(?:jsx?|tsx?|javascript|typescript|html|css|react)?\n([\s\S]*?)(?:```|$)/);

    if (codeBlockMatch) {
      const extractedCode = codeBlockMatch[1].trim();
      if (extractedCode) {
        setCanvasCode(extractedCode);
        setCanvasError(null);
        // Open the canvas panel when code is detected
        if (!showCanvasPanel) {
          setShowCanvasPanel(true);
          setCanvasViewMode('code'); // Start in code view to show generation
        }
      }
    }

    // Auto-switch to preview when generation completes
    if (prevIsLoading.current && !isLoading && canvasCode) {
      // Delay preview switch slightly to ensure code is fully rendered
      setTimeout(() => {
        setCanvasViewMode('preview');
      }, 500);
    }
    prevIsLoading.current = isLoading;
  }, [messages, canvasMode, showCanvasPanel, isLoading, canvasCode]);

  // Reset canvas panel when canvas mode is turned off
  useEffect(() => {
    if (!canvasMode) {
      setShowCanvasPanel(false);
      setCanvasCode('');
    }
  }, [canvasMode]);

  // File upload handlers
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const type = FILE_TYPE_MAP[file.type] || 'other';
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Read file as base64 for API submission
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just the base64 content
          const base64Content = result.split(',')[1] || result;
          resolve(base64Content);
        };
        reader.readAsDataURL(file);
      });

      // Create preview URL for images
      let preview: string | undefined;
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }

      newFiles.push({
        id,
        file,
        preview,
        base64,
        type,
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      uploadedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const message = input.trim();
    const files = uploadedFiles.map(f => ({
      name: f.file.name,
      type: f.file.type,
      size: f.file.size,
      base64: f.base64,
      category: f.type,
    }));

    setInput('');
    setUploadedFiles([]);

    await sendMessage(message, {
      teamId: currentTeam?.id,
      mcpConnectors: connectors,
      canvasMode: canvasMode,
      files: files.length > 0 ? files : undefined,
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
    <>
      {/* API Key Required Modal */}
      <ApiKeyRequiredModal
        open={showApiKeyModal}
        onKeysSaved={() => {
          setShowApiKeyModal(false);
          loadSettings();
        }}
        saveApiKey={saveApiKey}
      />

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

                  {/* PRD and Tickets generation buttons */}
                  <div className="mt-4 flex gap-2 justify-center">
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => generatePRD()}
                    >
                      <FileText className="h-4 w-4" />
                      {t('lily.createPRD', 'PRD 생성하기')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => currentTeam && generateTickets(currentTeam.id)}
                      disabled={!currentTeam}
                    >
                      <Ticket className="h-4 w-4" />
                      {t('lily.createTickets', '티켓 생성하기')}
                    </Button>
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

              {messages.map((message) => {
                // Extract thinking content from message
                let thinkingContent = message.thinking || '';
                let cleanContent = message.content;

                // Extract thinking from content if present
                const thinkingMatch = cleanContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
                if (thinkingMatch) {
                  thinkingContent = thinkingMatch[1];
                  cleanContent = cleanContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
                }

                // Remove [CANVAS:...] blocks and template text
                cleanContent = cleanContent
                  .replace(/\[CANVAS:[^\]]*\][\s\S]*?(?=\n\n|$)/g, '')
                  .replace(/\/\/ Write a [^\n]*\n?/g, '')
                  .trim();

                // Only remove code blocks from chat when canvas mode is ON
                // This allows code blocks to display normally when not in canvas mode
                if (canvasMode && showCanvasPanel) {
                  cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '').trim();
                }

                return (
                  <div key={message.id}>
                    {/* Timeline Thinking Block - OUTSIDE the speech bubble */}
                    {message.role === 'assistant' && thinkingContent && (
                      <TimelineThinkingBlock content={thinkingContent} t={t} />
                    )}

                    {/* Message bubble - Gemini-style compact design */}
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
                      <div
                        className={cn(
                          "rounded-lg px-3 py-1.5 max-w-[85%]",
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent || t('lily.generating', 'Generating...')}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanContent}</p>
                        )}
                        <span className="text-[9px] opacity-60 mt-0.5 block">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">{t('lily.thinking')}</span>
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
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-11 w-11 flex-shrink-0",
                      getActiveConnectors().length > 0 && "border-green-500 bg-green-500/10"
                    )}
                  >
                    <Plug className={cn(
                      "h-4 w-4",
                      getActiveConnectors().length > 0 && "text-green-500"
                    )} />
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

              {/* File Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.html,.css,.json,.xml"
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title={t('lily.uploadFile', 'Upload file')}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              {/* Canvas Toggle Button */}
              <Button
                variant={canvasMode ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-11 w-11 flex-shrink-0 relative",
                  canvasMode && "bg-amber-500 hover:bg-amber-600"
                )}
                onClick={() => setCanvasMode(!canvasMode)}
                title={canvasMode ? t('lily.canvasOn', 'Canvas Mode ON') : t('lily.canvasOff', 'Canvas Mode OFF')}
              >
                <Code className="h-4 w-4" />
                {canvasMode && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                )}
              </Button>

              <div className="flex-1 flex flex-col gap-2">
                {/* Uploaded files preview */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg border border-border">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="relative group flex items-center gap-2 px-2 py-1 bg-background rounded-md border"
                      >
                        {file.preview ? (
                          <img src={file.preview} alt={file.file.name} className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center bg-muted rounded">
                            {getFileTypeIcon(file.type)}
                          </div>
                        )}
                        <span className="text-xs max-w-[100px] truncate">{file.file.name}</span>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder={uploadedFiles.length > 0 ? t('lily.describeFiles', 'Describe what you want to do with the files...') : t('lily.placeholder')}
                  className="min-h-[44px] max-h-[200px] resize-none text-sm"
                  rows={1}
                />
              </div>
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

        {/* Artifact Panel - Real-time Preview (only show when code detected or artifact exists) */}
        {(showArtifact && artifact) || showCanvasPanel ? (
          <div className="w-[450px] border-l border-border flex flex-col bg-background">
            {/* Artifact Header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2">
                {showCanvasPanel ? (
                  <>
                    <Code className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">{t('lily.canvas', 'Canvas')}</span>
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </>
                ) : artifact && (
                  <>
                    {artifact.type === 'prd' && <FileText className="h-4 w-4 text-blue-500" />}
                    {artifact.type === 'issue' && <Ticket className="h-4 w-4 text-green-500" />}
                    {artifact.type === 'code' && <Code className="h-4 w-4 text-amber-500" />}
                    {artifact.type === 'document' && <FileText className="h-4 w-4 text-purple-500" />}
                    <span className="font-medium text-sm truncate">{artifact.title}</span>
                    {artifact.isGenerating && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {showCanvasPanel && (
                  <div className="flex rounded-md border border-border mr-2">
                    <Button
                      variant={canvasViewMode === 'code' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 rounded-r-none text-xs"
                      onClick={() => setCanvasViewMode('code')}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      Code
                    </Button>
                    <Button
                      variant={canvasViewMode === 'preview' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 rounded-l-none text-xs"
                      onClick={() => setCanvasViewMode('preview')}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const contentToCopy = showCanvasPanel ? canvasCode : artifact?.content;
                    if (contentToCopy) {
                      navigator.clipboard.writeText(contentToCopy);
                      toast.success(t('common.copied', 'Copied!'));
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (showCanvasPanel) {
                      setCanvasMode(false);
                      setShowCanvasPanel(false);
                      setCanvasCode('');
                      setCanvasError(null);
                    } else {
                      toggleArtifactPanel();
                    }
                  }}
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Canvas/Artifact Content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {showCanvasPanel ? (
                  canvasViewMode === 'code' ? (
                    <div className="space-y-2">
                      {canvasCode ? (
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono">
                          <code className="text-green-400">{canvasCode}</code>
                        </pre>
                      ) : (
                        <div className="text-center py-16 text-muted-foreground">
                          <Code className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-sm">{t('lily.canvasWaiting', 'Waiting for code generation...')}</p>
                          <p className="text-xs mt-2 max-w-[250px] mx-auto">
                            {t('lily.canvasHint', 'Ask Lily AI to create something and it will appear here')}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {canvasError ? (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
                          <p className="font-medium mb-1">{t('lily.previewError', 'Preview Error')}</p>
                          <p className="text-xs opacity-80">{canvasError}</p>
                        </div>
                      ) : canvasCode ? (
                        <div className="border rounded-lg bg-white dark:bg-zinc-900 overflow-hidden min-h-[300px]">
                          <iframe
                            srcDoc={(() => {
                              // Check if the code is a complete HTML document
                              const isCompleteHTML = canvasCode.trim().toLowerCase().startsWith('<!doctype') ||
                                canvasCode.trim().toLowerCase().startsWith('<html');

                              if (isCompleteHTML) {
                                // Render complete HTML document directly
                                return canvasCode;
                              } else {
                                // Wrap component code in HTML shell
                                return `
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <meta charset="utf-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1">
                                    <script src="https://cdn.tailwindcss.com"></script>
                                    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
                                    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
                                    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                                    <style>
                                      body { 
                                        font-family: system-ui, -apple-system, sans-serif;
                                        padding: 1rem;
                                        margin: 0;
                                        background: #fafafa;
                                      }
                                    </style>
                                  </head>
                                  <body>
                                    <div id="root"></div>
                                    <script type="text/babel">
                                      try {
                                        ${canvasCode}
                                        
                                        // Try to find and render the component
                                        const componentMatch = \`${canvasCode}\`.match(/(?:function|const|class)\\s+(\\w+)/);
                                        if (componentMatch) {
                                          const ComponentName = eval(componentMatch[1]);
                                          ReactDOM.createRoot(document.getElementById('root')).render(
                                            React.createElement(ComponentName)
                                          );
                                        }
                                      } catch (e) {
                                        document.getElementById('root').innerHTML = 
                                          '<div style="color: red; padding: 1rem; font-family: monospace;">' + 
                                          '<strong>Error:</strong> ' + e.message + 
                                          '</div>';
                                      }
                                    </script>
                                  </body>
                                </html>
                              `;
                              }
                            })()}
                            className="w-full h-[500px] border-0"
                            sandbox="allow-scripts allow-same-origin"
                            title="Canvas Preview"
                          />
                        </div>
                      ) : (
                        <div className="text-center py-16 text-muted-foreground">
                          <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-sm">{t('lily.previewWaiting', 'No code to preview')}</p>
                        </div>
                      )}
                    </div>
                  )
                ) : artifact?.type === 'code' ? (
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{artifact.content}</code>
                  </pre>
                ) : artifact && (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                  [&_p]:my-3 [&_p]:leading-7
                  [&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc
                  [&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal
                  [&_li]:leading-7
                  [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                  [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                  [&_code]:text-xs [&_code]:bg-muted/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md
                  [&_pre]:my-4 [&_pre]:bg-zinc-900 [&_pre]:p-4 [&_pre]:rounded-lg
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0
                  [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:italic
                ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Artifact Footer */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                {showCanvasPanel ? (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (canvasCode) {
                          navigator.clipboard.writeText(canvasCode);
                          toast.success(t('common.copied', 'Code copied!'));
                        }
                      }}
                      disabled={!canvasCode}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      {t('common.copyCode', 'Copy Code')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Save as component
                        toast.info(t('lily.savingComponent', 'Saving component...'));
                      }}
                      disabled={!canvasCode}
                    >
                      <Save className="h-3 w-3 mr-2" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    {artifact?.type === 'prd' && (
                      <Button size="sm" className="flex-1" onClick={() => {
                        toast.success(t('lily.prdSaved', 'PRD saved!'));
                      }}>
                        {t('common.save', 'Save PRD')}
                      </Button>
                    )}
                    {artifact?.type === 'issue' && (
                      <Button size="sm" className="flex-1" onClick={() => {
                        toast.success(t('lily.issueCreated', 'Issue created!'));
                      }}>
                        {t('issues.create', 'Create Issue')}
                      </Button>
                    )}
                    {artifact?.type === 'code' && (
                      <Button size="sm" className="flex-1" onClick={() => {
                        navigator.clipboard.writeText(artifact.content);
                        toast.success(t('common.copied', 'Code copied!'));
                      }}>
                        {t('common.copyCode', 'Copy Code')}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
