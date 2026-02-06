import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppLayout } from '@/components/layout';
import { prdService, type PRDWithRelations } from '@/lib/services/prdService';
import { BlockEditor } from '@/components/editor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollaborationStore } from '@/stores/collaborationStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  MoreHorizontal,
  History,
  Download,
  Copy,
  Sparkles,
  Check,
  Pencil,
  Eye,
  Clock,
  Users,
  MessageSquare,
  PanelRightOpen,
  PanelRightClose,
  Send,
  Bot,
  User,
  Undo2,
  Redo2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  X,
  Cloud,
  CloudOff,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { userAISettingsService } from '@/lib/services/conversationService';
import { useAuthStore } from '@/stores/authStore';
import type { AIProvider } from '@/types';

// Timeline Thinking Block Component (like Gemini/Claude)
const TimelineThinkingBlock = ({ content, isExpanded = false }: { content: string; isExpanded?: boolean }) => {
  const [expanded, setExpanded] = useState(isExpanded);

  if (!content) return null;

  return (
    <div className="flex gap-2 mb-3">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-amber-500" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-amber-600 hover:text-amber-500 font-medium mb-1"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Thinking...
        </button>
        {expanded && (
          <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 mt-1">
            {content}
          </div>
        )}
      </div>
    </div>
  );
};

// Version history entry
interface VersionEntry {
  id: string;
  content: string;
  timestamp: Date;
  description: string;
}

// AI suggestion
interface AISuggestion {
  id: string;
  originalContent: string;
  suggestedContent: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
}

// AI Message in panel
interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestion?: AISuggestion;
}

type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';

const statusConfig: Record<PRDStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: <Pencil className="h-3 w-3" /> },
  review: { label: 'In Review', color: 'bg-yellow-500/20 text-yellow-600', icon: <Eye className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-600', icon: <Check className="h-3 w-3" /> },
  archived: { label: 'Archived', color: 'bg-gray-500/20 text-gray-600', icon: <Clock className="h-3 w-3" /> },
};

// Default PRD template content
const DEFAULT_PRD_TEMPLATE = `
<h2>Overview</h2>
<p>Describe what this product/feature is about and its main purpose.</p>

<h2>Goals</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Define the primary goal</li>
  <li data-type="taskItem" data-checked="false">Add secondary goals</li>
</ul>

<h2>User Stories</h2>
<p><strong>As a</strong> [user type], <strong>I want to</strong> [action], <strong>so that</strong> [benefit].</p>

<h2>Requirements</h2>
<h3>Functional Requirements</h3>
<ul>
  <li>Requirement 1</li>
  <li>Requirement 2</li>
</ul>

<h3>Non-Functional Requirements</h3>
<ul>
  <li>Performance: The system should...</li>
  <li>Security: The system must...</li>
</ul>

<h2>Technical Specifications</h2>
<p>Describe the technical approach, architecture decisions, and implementation details.</p>

<h2>Timeline & Milestones</h2>
<table>
  <tr>
    <th>Phase</th>
    <th>Description</th>
    <th>Timeline</th>
  </tr>
  <tr>
    <td>Phase 1</td>
    <td>Initial development</td>
    <td>Week 1-2</td>
  </tr>
  <tr>
    <td>Phase 2</td>
    <td>Testing & refinement</td>
    <td>Week 3</td>
  </tr>
</table>

<h2>Success Metrics</h2>
<ul>
  <li>Metric 1: Define how success will be measured</li>
  <li>Metric 2: Add KPIs</li>
</ul>

<h2>Open Questions</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false">Question that needs to be resolved</li>
</ul>
`;

export function PRDDetailPage() {
  const { prdId } = useParams<{ prdId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { users } = useCollaborationStore();
  const { user } = useAuthStore();

  // Get users viewing this PRD
  const viewers = users.filter(u => u.currentPath === window.location.pathname && u.odId !== user?.id);

  const [prd, setPrd] = useState<PRDWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedTitle, setSavedTitle] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [savedStatus, setSavedStatus] = useState<PRDStatus>('draft');

  // Individual save states for UI feedback (matching Issue pattern)
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  // Editable fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<PRDStatus>('draft');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // AI Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<AISuggestion | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic');
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);

  // Provider display names
  const PROVIDER_LABELS: Record<AIProvider, string> = {
    auto: '✨ Auto',
    anthropic: '🟣 Claude',
    openai: '🟢 GPT-4o',
    gemini: '🔵 Gemini',
  };

  // Fetch available AI providers on mount
  useEffect(() => {
    async function fetchProviders() {
      if (user) {
        try {
          const providers = await userAISettingsService.getAvailableProviders();
          setAvailableProviders(providers.length > 0 ? providers : ['anthropic']); // Fallback to anthropic
          // Set default provider
          const settings = await userAISettingsService.getSettings();
          if (settings?.default_provider && providers.includes(settings.default_provider)) {
            setSelectedProvider(settings.default_provider);
          } else if (providers.length > 0) {
            setSelectedProvider(providers[0]);
          }
        } catch (error) {
          console.error('Failed to fetch AI providers:', error);
          setAvailableProviders(['anthropic']); // Fallback
        }
      }
    }
    fetchProviders();
  }, [user]);

  // Version history for undo
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Add to version history
  const addToHistory = useCallback((newContent: string, description: string) => {
    setVersionHistory(prev => {
      // Remove any versions after current index (if we've undone some)
      const truncated = prev.slice(0, currentVersionIndex + 1);
      const newVersion: VersionEntry = {
        id: Date.now().toString(),
        content: newContent,
        timestamp: new Date(),
        description,
      };
      return [...truncated, newVersion];
    });
    setCurrentVersionIndex(prev => prev + 1);
  }, [currentVersionIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (currentVersionIndex > 0) {
      const prevVersion = versionHistory[currentVersionIndex - 1];
      setContent(prevVersion.content);
      setCurrentVersionIndex(prev => prev - 1);
      toast.success(`Undone: ${versionHistory[currentVersionIndex].description}`);
    }
  }, [currentVersionIndex, versionHistory]);

  // Redo
  const handleRedo = useCallback(() => {
    if (currentVersionIndex < versionHistory.length - 1) {
      const nextVersion = versionHistory[currentVersionIndex + 1];
      setContent(nextVersion.content);
      setCurrentVersionIndex(prev => prev + 1);
      toast.success(`Redone: ${nextVersion.description}`);
    }
  }, [currentVersionIndex, versionHistory]);

  // Scroll AI messages to bottom
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // Auto-save content (matching Issue pattern)
  const { debouncedSave: debouncedSaveContent, setInitialValue: setInitialContent } = useAutoSave({
    onSave: async (value) => {
      if (!prdId) return;
      setIsSavingContent(true);
      try {
        await prdService.updatePRD(prdId, { content: value });
        setLastSaved(new Date());
        setContentSaved(true);
        setTimeout(() => setContentSaved(false), 2000);
      } catch (error) {
        console.error('Failed to auto-save:', error);
      } finally {
        setIsSavingContent(false);
      }
    },
    delay: 2000,
  });

  // Auto-save title (matching Issue pattern)
  const { debouncedSave: debouncedSaveTitle, setInitialValue: setInitialTitle } = useAutoSave({
    onSave: async (value) => {
      if (!prdId || !value.trim()) return;
      setIsSavingTitle(true);
      try {
        await prdService.updatePRD(prdId, { title: value.trim() });
        setLastSaved(new Date());
        setTitleSaved(true);
        setTimeout(() => setTitleSaved(false), 2000);
      } catch (error) {
        console.error('Failed to auto-save title:', error);
      } finally {
        setIsSavingTitle(false);
      }
    },
    delay: 1500,
  });

  useEffect(() => {
    const loadPRD = async () => {
      if (!prdId) return;

      setIsLoading(true);
      try {
        const data = await prdService.getPRD(prdId);
        if (data) {
          setPrd(data);
          setTitle(data.title);
          setSavedTitle(data.title);
          setInitialTitle(data.title);
          // Use content if available, otherwise use overview for backwards compatibility, or template
          const initialContent = data.content || data.overview || DEFAULT_PRD_TEMPLATE;
          setContent(initialContent);
          setSavedContent(initialContent);
          setInitialContent(initialContent);
          setStatus(data.status as PRDStatus);
          setSavedStatus(data.status as PRDStatus);
          setLastSaved(new Date(data.updated_at));
          setHasChanges(false);
        }
      } catch (error) {
        console.error('Failed to load PRD:', error);
        toast.error(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPRD();
  }, [prdId, t]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(value !== savedTitle || content !== savedContent || status !== savedStatus);
    debouncedSaveTitle(value);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(title !== savedTitle || value !== savedContent || status !== savedStatus);
    debouncedSaveContent(value);
  };

  const handleStatusChange = async (newStatus: PRDStatus) => {
    if (!prdId) return;
    setStatus(newStatus);
    try {
      await prdService.updateStatus(prdId, newStatus);
      setLastSaved(new Date());
      toast.success(t('prd.statusUpdated', 'Status updated'));
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleExportMarkdown = () => {
    // Convert HTML to simple text for now
    const text = content.replace(/<[^>]*>/g, '');
    const blob = new Blob([`# ${title}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard');
  };

  // Handle AI message send with streaming
  const handleAISend = async () => {
    if (!aiInput.trim() || isAILoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: aiInput.trim(),
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, userMessage]);
    const userQuery = aiInput.trim();
    setAiInput('');
    setIsAILoading(true);

    // Create initial assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    setAiMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lily-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a PRD editing assistant. The user wants to modify their PRD document.
              
Current PRD content (HTML format):
${content}

When the user asks for changes, respond with a JSON block like this:
[PRD_EDIT]
{
  "description": "Brief description of the change",
  "newContent": "<full HTML content of the modified PRD>"
}
[/PRD_EDIT]

Always preserve the HTML structure and formatting. Make the requested changes while keeping the rest intact.
If the user asks a question, answer it helpfully without the PRD_EDIT block.
Respond in the same language as the user's message.`
            },
            ...aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userQuery }
          ],
          provider: selectedProvider,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content ||
                  parsed.delta?.text ||
                  parsed.content ||
                  parsed.text ||
                  '';
                if (delta) {
                  fullContent += delta;
                  setAiMessages(prev => prev.map(m =>
                    m.id === assistantMessageId ? { ...m, content: fullContent } : m
                  ));
                }
              } catch {
                // Not JSON, might be raw text
                if (line.trim() && !line.startsWith(':')) {
                  fullContent += data;
                  setAiMessages(prev => prev.map(m =>
                    m.id === assistantMessageId ? { ...m, content: fullContent } : m
                  ));
                }
              }
            }
          }
        }
      }

      // Parse PRD edit suggestion from final content
      const editMatch = fullContent.match(/\[PRD_EDIT\]([\s\S]*?)\[\/PRD_EDIT\]/);
      let suggestion: AISuggestion | undefined;
      let cleanContent = fullContent;

      if (editMatch) {
        try {
          const editData = JSON.parse(editMatch[1]);
          suggestion = {
            id: Date.now().toString(),
            originalContent: content,
            suggestedContent: editData.newContent,
            description: editData.description,
            status: 'pending',
          };
          setPendingSuggestion(suggestion);
          cleanContent = fullContent.replace(/\[PRD_EDIT\][\s\S]*?\[\/PRD_EDIT\]/, '').trim();
          cleanContent = cleanContent || `I suggest the following change: ${editData.description}`;
        } catch (e) {
          console.error('Failed to parse PRD edit:', e);
        }
      }

      // Update final message with suggestion
      setAiMessages(prev => prev.map(m =>
        m.id === assistantMessageId ? { ...m, content: cleanContent, suggestion } : m
      ));
    } catch (error) {
      console.error('AI request failed:', error);
      setAiMessages(prev => prev.map(m =>
        m.id === assistantMessageId ? {
          ...m,
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
        } : m
      ));
    } finally {
      setIsAILoading(false);
    }
  };

  // Accept AI suggestion
  const handleAcceptSuggestion = (suggestion: AISuggestion) => {
    addToHistory(content, 'Before AI edit');
    setContent(suggestion.suggestedContent);
    addToHistory(suggestion.suggestedContent, suggestion.description);
    setPendingSuggestion(null);

    // Update message status
    setAiMessages(prev => prev.map(msg =>
      msg.suggestion?.id === suggestion.id
        ? { ...msg, suggestion: { ...msg.suggestion, status: 'accepted' as const } }
        : msg
    ));

    toast.success('Change applied! Use Undo to revert.');
    setHasChanges(true);
  };

  // Reject AI suggestion
  const handleRejectSuggestion = (suggestion: AISuggestion) => {
    setPendingSuggestion(null);

    // Update message status
    setAiMessages(prev => prev.map(msg =>
      msg.suggestion?.id === suggestion.id
        ? { ...msg, suggestion: { ...msg.suggestion, status: 'rejected' as const } }
        : msg
    ));

    toast.info('Suggestion rejected');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!prd) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{t('prd.notFound', 'PRD not found')}</p>
          <Button onClick={() => navigate('/prd')}>{t('prd.backToList', 'Back to PRDs')}</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/prd')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">PRDs</span>
                <span className="text-muted-foreground">/</span>
                {prd.project && (
                  <>
                    <span className="text-muted-foreground">{prd.project.name}</span>
                    <span className="text-muted-foreground">/</span>
                  </>
                )}
                <span className="font-medium truncate max-w-[200px]">{title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Presence Avatars */}
              {viewers.length > 0 && (
                <div className="flex items-center mr-4">
                  <span className="text-xs text-muted-foreground mr-2 hidden sm:inline-block">
                    Viewers:
                  </span>
                  <div className="flex -space-x-2">
                    {viewers.map(viewer => (
                      <Tooltip key={viewer.odId}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs text-white font-medium shadow-sm transition-transform hover:z-10 hover:scale-110 cursor-help"
                            style={{ backgroundColor: viewer.color }}
                          >
                            {viewer.avatarUrl ? (
                              <img src={viewer.avatarUrl} alt={viewer.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              viewer.name.charAt(0).toUpperCase()
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{viewer.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Status Indicator (Google Docs style - matching Issue pattern) */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                {(isSavingTitle || isSavingContent) ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (titleSaved || contentSaved) ? (
                  <div className="flex items-center gap-1 text-green-500">
                    <Cloud className="h-3 w-3" />
                    <span>Saved</span>
                  </div>
                ) : lastSaved ? (
                  <span className="text-muted-foreground">
                    Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                  </span>
                ) : null}
              </div>

              {/* Status dropdown */}
              <Select value={status} onValueChange={(v) => handleStatusChange(v as PRDStatus)}>
                <SelectTrigger className="w-[140px] h-8">
                  <div className="flex items-center gap-1.5 truncate">
                    {statusConfig[status].icon}
                    <span className="truncate">{statusConfig[status].label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleUndo}
                  disabled={currentVersionIndex <= 0}
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRedo}
                  disabled={currentVersionIndex >= versionHistory.length - 1}
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>

              {/* AI Panel toggle */}
              <Button
                variant={showAIPanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Assistant</span>
                {showAIPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowVersionHistory(!showVersionHistory)}>
                    <History className="h-4 w-4 mr-2" />
                    Version History ({versionHistory.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main Content with optional AI Panel */}
        <div className="flex-1 overflow-hidden flex">
          {/* Editor Section */}
          <div className={cn(
            "flex-1 overflow-y-auto transition-all duration-300",
            showAIPanel ? "w-[60%]" : "w-full"
          )}>
            <div className="w-full p-6 sm:p-8 lg:p-12">
              {/* Title */}
              <div className="mb-8">
                {isEditingTitle ? (
                  <Input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    placeholder={t('prd.titlePlaceholder', 'Untitled PRD')}
                    className="text-3xl sm:text-4xl font-bold border-none px-0 focus-visible:ring-0 h-auto py-2 bg-transparent"
                  />
                ) : (
                  <h1
                    className="text-3xl sm:text-4xl font-bold cursor-text hover:bg-muted/30 rounded px-2 py-2 -mx-2 transition-colors group flex items-center gap-3"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {title || t('prd.titlePlaceholder', 'Untitled PRD')}
                    <Pencil className="h-5 w-5 opacity-0 group-hover:opacity-30 transition-opacity" />
                  </h1>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>Created {format(new Date(prd.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {prd.project && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      <span>{prd.project.name}</span>
                    </div>
                  )}
                  <Badge className={statusConfig[status].color}>
                    {statusConfig[status].icon}
                    <span className="ml-1">{statusConfig[status].label}</span>
                  </Badge>
                </div>
              </div>

              {/* Editor */}
              <div className="prose prose-sm dark:prose-invert max-w-none pb-20">
                <BlockEditor
                  content={content}
                  onChange={handleContentChange}
                  editable={true}
                />
              </div>
            </div>
          </div>

          {/* AI Panel */}
          {showAIPanel && (
            <div className="w-[40%] bg-muted/30 border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
              <div className="h-14 border-b px-4 flex items-center justify-between shrink-0 bg-background/50">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Assistant
                </h3>

                {/* AI Provider Selector */}
                <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as AIProvider)}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map(p => (
                      <SelectItem key={p} value={p}>
                        {PROVIDER_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {aiMessages.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Bot className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Ask me to help write, review, or improve your PRD.</p>
                      <p className="text-xs mt-2">Try: "Create a user story for login"</p>
                    </div>
                  ) : (
                    aiMessages.map((msg) => (
                      <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={cn(
                          "flex-1 rounded-lg p-3 text-sm",
                          msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {msg.role === 'assistant' ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            msg.content
                          )}

                          {/* AI Suggestion Actions */}
                          {msg.suggestion && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-xs opacity-70">Suggested Change</span>
                                {msg.suggestion.status === 'accepted' ? (
                                  <Badge variant="secondary" className="bg-green-500/20 text-green-700 hover:bg-green-500/20">Accepted</Badge>
                                ) : msg.suggestion.status === 'rejected' ? (
                                  <Badge variant="secondary" className="bg-red-500/20 text-red-700 hover:bg-red-500/20">Rejected</Badge>
                                ) : null}
                              </div>
                              <div className="text-xs bg-background/50 p-2 rounded mb-2 font-mono">
                                {msg.suggestion.description}
                              </div>
                              {msg.suggestion.status === 'pending' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white border-none"
                                    onClick={() => handleAcceptSuggestion(msg.suggestion!)}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Apply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs flex-1"
                                    onClick={() => handleRejectSuggestion(msg.suggestion!)}
                                  >
                                    <X className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={aiMessagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-background/50">
                <div className="relative">
                  <Textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAISend();
                      }
                    }}
                    placeholder={t('prd.aiPlaceholder', 'Ask AI to help...')}
                    className="pr-10 min-h-[80px] resize-none"
                    disabled={isAILoading}
                  />
                  <Button
                    size="icon"
                    className="absolute bottom-2 right-2 h-8 w-8"
                    onClick={handleAISend}
                    disabled={!aiInput.trim() || isAILoading}
                  >
                    {isAILoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground flex justify-between">
                  <span>Using: {PROVIDER_LABELS[selectedProvider]}</span>
                  <span>Shift + Enter for new line</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Version History Drawer */}
      {showVersionHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-xl transform transition-transform duration-300 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              Version History
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setShowVersionHistory(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {versionHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No history yet. Make some changes!
                </div>
              ) : (
                versionHistory.slice().reverse().map((version) => (
                  <div key={version.id} className="border rounded-lg p-3 text-sm hover:bg-muted/50 transition-colors">
                    <div className="font-medium mb-1">{version.description}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(version.timestamp, 'MMM d, h:mm a')}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => {
                        setContent(version.content);
                        addToHistory(content, `Reverted to version from ${format(version.timestamp, 'h:mm a')}`);
                        toast.success('Restored previous version');
                      }}
                    >
                      <Undo2 className="h-3 w-3 mr-1" /> Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </AppLayout>
  );
}
