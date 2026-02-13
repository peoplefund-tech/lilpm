import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Check,
  CheckCircle,
  X,
  Trash2,
  MessageSquare,
  Plus,
  Clock,
  BarChart3,
  Square,
  Pin,
  Code,
  Copy,
  Paperclip,
  Eye,
  Save,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  PanelRightClose,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useLilyStore } from '@/stores';
import { useTeamStore } from '@/stores/teamStore';
import { useIssueStore } from '@/stores';
import { useMCPStore } from '@/stores/mcpStore';
import { ApiKeyRequiredModal } from './panels/ApiKeyRequiredModal';
import { ConversationItem } from './chat/ConversationItem';
import { ChatMessage } from './chat/ChatMessage';
import { cn } from '@/lib/utils';
import type { AIProvider } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plug, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAISettings } from '@/hooks/useAISettings';
import { prdService } from '@/features/prd';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ShareConversationModal } from './panels/ShareConversationModal';
import {
  UploadedFile,
  FILE_TYPE_MAP,
  ProjectContext,
  MIN_HISTORY_WIDTH,
  MAX_HISTORY_WIDTH,
  DEFAULT_HISTORY_WIDTH,
} from './types';
import { getFileTypeIcon } from './utils';

import { ko, enUS } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LilyChatProps {
  projectContext?: ProjectContext;
}

export function LilyChat({ projectContext }: LilyChatProps) {
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
    reorderConversation,
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

  // PRD saving state - per message
  const [savedPRDMap, setSavedPRDMap] = useState<Record<string, string>>({}); // messageId -> prdId
  const [savingPRDForMessage, setSavingPRDForMessage] = useState<string | null>(null); // messageId being saved

  // Share conversation modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareConversationData, setShareConversationData] = useState<{ id: string; title: string | null } | null>(null);

  // Panel detail view states (for issue detail / PRD viewer in right panel)
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  const [selectedPRDContent, setSelectedPRDContent] = useState<{ title: string; content: string } | null>(null);

  // Drag-and-drop sensors for conversation reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for conversation reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const convIds = conversations.map(c => c.id);
      const oldIndex = convIds.indexOf(active.id as string);
      const newIndex = convIds.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderConversation(active.id as string, newIndex);
      }
    }
  }, [conversations, reorderConversation]);

  // Handle share conversation
  const handleShareConversation = useCallback((conv: { id: string; title: string | null }) => {
    setShareConversationData(conv);
    setShareModalOpen(true);
  }, []);

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

  // Show initial greeting when coming from project page with AI context
  const hasShownGreeting = useRef(false);
  useEffect(() => {
    if (projectContext && projectContext.projectId && projectContext.type && messages.length === 0 && !hasShownGreeting.current) {
      hasShownGreeting.current = true;
      const typeName = projectContext.type === 'issue' ? '이슈' : 'PRD';
      const greeting = `안녕하세요! **${projectContext.projectName || '프로젝트'}** 프로젝트에 들어갈 ${typeName}를 함께 작성해 드리겠습니다. 어떤 ${typeName}를 만들어 드릴까요?`;

      // Directly add assistant greeting message via store
      useLilyStore.setState((state) => ({
        messages: [
          ...state.messages,
          {
            id: `greeting-${Date.now()}`,
            role: 'assistant' as const,
            content: greeting,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    }
  }, [projectContext, messages.length]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Save message content as a new PRD (background save)
  const saveAsPRD = useCallback(async (content: string, title: string, messageId: string) => {
    if (!currentTeam) {
      toast.error(t('lily.noTeamSelected', '팀을 선택해주세요'));
      return;
    }

    setSavingPRDForMessage(messageId);

    try {
      // Extract first paragraph as overview
      const overviewMatch = content.match(/^(?!#)(.+?)(?:\n|$)/m);
      const overview = overviewMatch?.[1]?.trim() || '';

      // Create PRD with title and overview
      const prd = await prdService.createPRD(currentTeam.id, {
        title,
        overview,
      });

      // Update PRD with full content
      if (prd) {
        await prdService.updatePRD(currentTeam.id, prd.id, { content });
        toast.success(t('lily.prdCreated', 'PRD가 생성되었습니다'));
        // Store the PRD id for this message (enables "View PRD" button)
        setSavedPRDMap(prev => ({ ...prev, [messageId]: prd.id }));
        // Show PRD content in right panel
        setSelectedPRDContent({ title, content });
      }
    } catch (error) {
      console.error('Failed to save as PRD:', error);
      toast.error(t('lily.prdCreateFailed', 'PRD 생성에 실패했습니다'));
    } finally {
      setSavingPRDForMessage(null);
    }
  }, [currentTeam, t]);

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

  // User message action callbacks
  const handleEditMessage = useCallback((messageContent: string, messageId: string) => {
    // Put the message content back in the input for editing
    setInput(messageContent);
    // Focus the input
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 100);
  }, []);

  const handleCopyMessage = useCallback(async (messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast.success(t('lily.copied', '복사되었습니다'));
    } catch {
      toast.error(t('lily.copyFailed', '복사에 실패했습니다'));
    }
  }, [t]);

  const handleRetryMessage = useCallback(async (messageContent: string, messageIndex: number) => {
    // Remove this message and all following messages, then resend
    const messagesToKeep = messages.slice(0, messageIndex);
    // Clear and resend
    clearChat();
    // Restore previous messages
    for (const msg of messagesToKeep) {
      // Just set the input and send
    }
    // Send the message again
    await sendMessage(messageContent, {
      teamId: currentTeam?.id,
      mcpConnectors: connectors,
      canvasMode: canvasMode,
    });
  }, [messages, clearChat, sendMessage, currentTeam?.id, connectors, canvasMode]);

  // Scroll navigation
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToMessage = useCallback((direction: 'prev' | 'next') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const messageElements = Array.from(container.querySelectorAll('[data-message-id]'));
    const containerRect = container.getBoundingClientRect();
    const containerTop = container.scrollTop;

    // Find the currently visible message
    let currentIndex = 0;
    for (let i = 0; i < messageElements.length; i++) {
      const el = messageElements[i] as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.top >= containerRect.top && rect.top <= containerRect.bottom) {
        currentIndex = i;
        break;
      }
    }

    const targetIndex = direction === 'prev'
      ? Math.max(0, currentIndex - 1)
      : Math.min(messageElements.length - 1, currentIndex + 1);

    const targetElement = messageElements[targetIndex] as HTMLElement;
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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
        onClose={() => {
          setShowApiKeyModal(false);
          navigate('/');
        }}
        saveApiKey={saveApiKey}
      />

      {/* Share Conversation Modal */}
      {shareConversationData && (
        <ShareConversationModal
          open={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setShareConversationData(null);
          }}
          conversationId={shareConversationData.id}
          conversationTitle={shareConversationData.title || undefined}
        />
      )}

      <div className="flex h-full bg-[#0d0d0f]">
        {/* Sidebar - Hidden on desktop (moved to main Sidebar), shown on mobile when toggled */}
        <div
          className={cn(
            "relative border-r border-white/10 flex flex-col transition-all duration-200 fixed inset-y-0 left-0 z-40 bg-[#0d0d0f] md:hidden",
            showHistory ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ width: historyWidth }}
        >
          <div className="h-12 flex items-center px-3 border-b border-white/10">
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
                <p className="text-center text-slate-400 text-sm py-4">
                  {t('lily.noHistory')}
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={conversations.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <>
                      {/* Pinned Conversations */}
                      {conversations.filter(c => pinnedConversations.includes(c.id)).length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-slate-400 px-2 mb-1 flex items-center gap-1">
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
                              onShare={() => handleShareConversation(conv)}
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
                            <p className="text-xs font-medium text-slate-400 px-2 mb-1">
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
                              onShare={() => handleShareConversation(conv)}
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
                  </SortableContext>
                </DndContext>
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
          <div className="h-12 flex items-center justify-between px-3 sm:px-4 border-b border-white/10">
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
                <p className="text-xs text-slate-400 hidden sm:block">{t('lily.subtitle')}</p>
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
                        selectedProvider === provider && "bg-white/5"
                      )}
                    >
                      <span>{AI_PROVIDER_LABELS[provider].icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{AI_PROVIDER_LABELS[provider].name}</p>
                        <p className="text-xs text-slate-400">{AI_PROVIDER_LABELS[provider].description}</p>
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
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
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
                  <div className="mt-8 p-4 bg-white/5 rounded-lg max-w-md mx-auto">
                    <p className="text-xs text-slate-400 mb-2">{t('lily.currentModel', 'Current AI Model')}</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">{AI_PROVIDER_LABELS[selectedProvider].icon}</span>
                      <span className="font-medium">{AI_PROVIDER_LABELS[selectedProvider].name}</span>
                      <span className="text-slate-400">-</span>
                      <span className="text-sm text-slate-400">{AI_PROVIDER_LABELS[selectedProvider].description}</span>
                    </div>
                  </div>
                </div>
              )}


              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  messages={messages}
                  isLoading={isLoading}
                  canvasMode={canvasMode}
                  showCanvasPanel={showCanvasPanel}
                  suggestedIssuesLength={suggestedIssues.length}
                  savedPRDId={savedPRDMap[message.id]}
                  isSavingThisMessage={savingPRDForMessage === message.id}
                  onSaveAsPRD={saveAsPRD}
                  onViewPRD={(prdId) => navigate(`/prd/${prdId}`)}
                  onEditMessage={handleEditMessage}
                  onCopyMessage={handleCopyMessage}
                  onRetryMessage={handleRetryMessage}
                />
              ))}

              {isLoading && (
                <div className="flex gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-[#121215] rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-slate-400">{t('lily.thinking')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Issues - Now shown in right panel, not here */}
              {/* SuggestedIssuesList moved to right panel */}
            </div>
          </ScrollArea>

          {/* Floating Navigation Buttons */}
          {messages.length >= 1 && (
            <div className="absolute right-6 bottom-24 flex flex-row gap-1.5 z-10">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full shadow-md bg-[#0d0d0f]/90 backdrop-blur-sm border"
                onClick={scrollToTop}
                title={t('lily.scrollToTop', '맨 위로')}
              >
                <ChevronsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full shadow-md bg-[#0d0d0f]/90 backdrop-blur-sm border"
                onClick={() => scrollToMessage('prev')}
                title={t('lily.prevMessage', '이전 대화')}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full shadow-md bg-[#0d0d0f]/90 backdrop-blur-sm border"
                onClick={() => scrollToMessage('next')}
                title={t('lily.nextMessage', '다음 대화')}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/10 p-3 sm:p-4">
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
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer"
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
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
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
                  <div className="flex flex-wrap gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="relative group flex items-center gap-2 px-2 py-1 bg-[#0d0d0f] rounded-xl border"
                      >
                        {file.preview ? (
                          <img src={file.preview} alt={file.file.name} className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center bg-[#121215] rounded">
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
            <p className="text-center text-xs text-slate-400 mt-2 hidden sm:block">
              {AI_PROVIDER_LABELS[selectedProvider].icon} {t('lily.usingModel', 'Using')} {AI_PROVIDER_LABELS[selectedProvider].name}
            </p>
          </div>
        </div>

        {/* Unified Right Panel - Shows for canvas mode OR suggested issues OR PRD viewer */}
        {(canvasMode || suggestedIssues.length > 0 || selectedPRDContent || (showArtifact && artifact)) ? (
          <div className="w-[500px] border-l border-white/10 flex flex-col bg-[#0d0d0f]">
            {/* Artifact Header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                {showCanvasPanel ? (
                  <>
                    <Code className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">{t('lily.canvas', 'Canvas')}</span>
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </>
                ) : artifact && (
                  <>
                    {artifact.type === 'prd' && <FileText className="h-4 w-4 text-blue-500" />}
                    {artifact.type === 'issue' && <Ticket className="h-4 w-4 text-green-500" />}
                    {artifact.type === 'code' && <Code className="h-4 w-4 text-amber-500" />}
                    {artifact.type === 'document' && <FileText className="h-4 w-4 text-purple-500" />}
                    <span className="font-medium text-sm truncate">{artifact.title}</span>
                    {artifact.isGenerating && (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                  </>
                )}
              </div>
              {/* Tab Selector for Code/Issues when both exist */}
              {(canvasMode && suggestedIssues.length > 0) && (
                <div className="flex gap-1 rounded-xl border border-white/10 ml-2">
                  <Button
                    variant={showCanvasPanel ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowCanvasPanel(true)}
                  >
                    <Code className="h-3 w-3 mr-1" />
                    Code
                  </Button>
                  <Button
                    variant={!showCanvasPanel ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowCanvasPanel(false)}
                  >
                    <Ticket className="h-3 w-3 mr-1" />
                    Issues ({suggestedIssues.length})
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1">
                {showCanvasPanel && (
                  <div className="flex rounded-xl border border-white/10 mr-2">
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
                        <pre className="bg-[#121215] p-4 rounded-lg text-sm overflow-x-auto font-mono">
                          <code className="text-green-400">{canvasCode}</code>
                        </pre>
                      ) : (
                        <div className="text-center py-16 text-slate-400">
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
                        <div className="text-center py-16 text-slate-400">
                          <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-sm">{t('lily.previewWaiting', 'No code to preview')}</p>
                        </div>
                      )}
                    </div>
                  )
                ) : suggestedIssues.length > 0 && !showCanvasPanel ? (
                  /* Issues Panel Content - Detail or List View */
                  selectedIssueIndex !== null && suggestedIssues[selectedIssueIndex] ? (
                    /* Issue Detail View */
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setSelectedIssueIndex(null)}
                        >
                          <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                          {t('common.back', 'Back')}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold text-base">
                          {suggestedIssues[selectedIssueIndex].title || 'Untitled Issue'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded font-medium",
                            suggestedIssues[selectedIssueIndex].priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                            suggestedIssues[selectedIssueIndex].priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                            suggestedIssues[selectedIssueIndex].priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                            suggestedIssues[selectedIssueIndex].priority === 'low' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                            !suggestedIssues[selectedIssueIndex].priority && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {t(`priority.${suggestedIssues[selectedIssueIndex].priority || 'none'}`)}
                          </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                            {suggestedIssues[selectedIssueIndex].description || t('issues.noDescription', 'No description')}
                          </p>
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={async () => {
                              if (currentTeam && selectedIssueIndex !== null) {
                                const issue = suggestedIssues[selectedIssueIndex];
                                try {
                                  await createIssue(currentTeam.id, {
                                    title: issue.title || 'Untitled Issue',
                                    description: issue.description,
                                    priority: issue.priority || 'medium',
                                    status: 'backlog',
                                  });
                                  acceptSuggestedIssue(selectedIssueIndex);
                                  setSelectedIssueIndex(null);
                                  toast.success(t('issues.issueCreated'));
                                } catch (error) {
                                  toast.error(t('common.error'));
                                }
                              }
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {t('lily.createIssue', 'Create Issue')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedIssueIndex !== null) {
                                rejectSuggestedIssue(selectedIssueIndex);
                                setSelectedIssueIndex(null);
                              }
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {t('lily.reject', 'Reject')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Issue List View */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-green-500" />
                          {t('lily.suggestedIssues', 'Suggested Issues')} ({suggestedIssues.length})
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
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
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('lily.acceptAll', 'Accept All')}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {suggestedIssues.map((issue, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg bg-[#1a1a1f] hover:bg-white/5/5 transition-colors cursor-pointer"
                            onClick={() => setSelectedIssueIndex(index)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{issue.title || 'Untitled Issue'}</h4>
                                {issue.description && (
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{issue.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                    issue.priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                    issue.priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                    issue.priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                    issue.priority === 'low' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                    !issue.priority && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                  )}>
                                    {issue.priority || 'none'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={async () => {
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
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => rejectSuggestedIssue(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : selectedPRDContent ? (
                  /* PRD Viewer Panel */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setSelectedPRDContent(null)}
                      >
                        <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                        {t('common.close', 'Close')}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-500" />
                        <h3 className="font-semibold text-base">{selectedPRDContent.title}</h3>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_p]:my-3 [&_p]:leading-7
                        [&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc
                        [&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal
                        [&_li]:leading-7
                        [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                        [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedPRDContent.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : artifact?.type === 'code' ? (
                  <pre className="bg-[#121215] p-4 rounded-lg text-sm overflow-x-auto">
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
                  [&_code]:text-xs [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-xl
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
            <div className="border-t border-white/10 p-3">
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
