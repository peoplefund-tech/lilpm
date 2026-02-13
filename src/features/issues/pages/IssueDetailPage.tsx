import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppLayout } from '@/components/layout';
import { useIssueStore } from '@/stores';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import { issueService, commentService, activityService } from '@/lib/services';
import { teamMemberService } from '@/lib/services/teamService';
import { cycleService } from '@/lib/services/cycleService';
import { prdService } from '@/features/prd';
import { BlockEditor } from '@/components/editor';
import { CommentPanel } from '@/components/editor/CommentPanel';
import { blockCommentService } from '@/lib/services/blockCommentService';
import type { BlockComment as BlockCommentType } from '@/types/database';
import { IssueFocusIndicator, EditingIndicator, TypingIndicator } from '@/components/collaboration';
import { useIssueFocus, useRealtimeIssueUpdates } from '@/hooks/useRealtimeCollaboration';
import { useSupabaseCollaboration } from '@/hooks/collaboration/useSupabaseCollaboration';
import { useCloudflareCollaboration } from '@/hooks/collaboration/useCloudflareCollaboration';
import type { RemoteCursor } from '@/hooks/collaboration/useCloudflareCollaboration';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Archive,
  Copy,
  ExternalLink,
  Calendar as CalendarIcon,
  User,
  Tag,
  MessageSquare,
  Activity,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  XCircle,
  Timer,
  Check,
  Sparkles,
  PanelRightOpen,
  PanelRightClose,
  Bot,
  X,
  Cloud,
  CloudOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { userAISettingsService } from '@/lib/services/conversationService';
import type { Issue, IssueStatus, IssuePriority, CommentWithUser, ActivityWithUser, Profile, IssueType, Cycle } from '@/types/database';
import type { AIProvider } from '@/types';
import { StatusIcon, PriorityIcon } from '@/components/issues';
import { IssueTypeIcon, issueTypeConfig, allIssueTypes } from '@/components/issues';
import { TimelineThinkingBlock } from '@/components/issues';


// TimelineThinkingBlock is now imported from @/components/issues/TimelineThinkingBlock


export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const { broadcastIssueUpdate, setIsEditing: setCollabIsEditing, setIsTyping } = useCollaborationStore();

  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
    { value: 'backlog', label: t('status.backlog') },
    { value: 'todo', label: t('status.todo') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'in_review', label: t('status.in_review') },
    { value: 'blocked', label: t('status.blocked') },
    { value: 'done', label: t('status.done') },
    { value: 'cancelled', label: t('status.cancelled') },
  ];

  const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = [
    { value: 'urgent', label: t('priority.urgent') },
    { value: 'high', label: t('priority.high') },
    { value: 'medium', label: t('priority.medium') },
    { value: 'low', label: t('priority.low') },
    { value: 'none', label: t('priority.none') },
  ];

  const [issue, setIssue] = useState<Issue | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const [descriptionSaved, setDescriptionSaved] = useState(false);

  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showMobileProperties, setShowMobileProperties] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [prds, setPrds] = useState<{ id: string; title: string; project_id?: string }[]>([]);

  // Inline comments state
  const [blockComments, setBlockComments] = useState<BlockCommentType[]>([]);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);

  // AI Assistant Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
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
          setAvailableProviders(providers.length > 0 ? providers : ['anthropic']);
          const settings = await userAISettingsService.getSettings();
          if (settings?.default_provider && providers.includes(settings.default_provider)) {
            setSelectedProvider(settings.default_provider);
          } else if (providers.length > 0) {
            setSelectedProvider(providers[0]);
          }
        } catch (error) {
          console.error('Failed to fetch AI providers:', error);
          setAvailableProviders(['anthropic']);
        }
      }
    }
    fetchProviders();
  }, [user]);

  // Track focus for collaboration
  useIssueFocus(issueId || null);

  // Generate user color
  const getUserColor = (userId: string) => {
    const colors = ['#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE', '#60A5FA', '#A78BFA', '#F472B6'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Yjs CRDT Real-time Collaboration for issue descriptions
  const {
    yjsDoc,
    provider: yjsProvider,
    isSynced: isYjsSynced,
    remoteCursors: yjsRemoteCursors,
    updateCursorPosition: yjsUpdateCursorPosition,
  } = useCloudflareCollaboration({
    documentId: issueId || '',
    documentType: 'issue',
    teamId: currentTeam?.id || '',
    userId: user?.id || '',
    userName: user?.name || user?.email?.split('@')[0] || 'Anonymous',
    userColor: user?.id ? getUserColor(user.id) : undefined,
    avatarUrl: user?.avatarUrl,
    enabled: !!(issueId && currentTeam?.id && user?.id && !isLoading && isEditingDescription),
  });

  // Supabase Realtime for presence only (who's online on this issue)
  const {
    isConnected: isSupabaseCollabConnected,
    presenceUsers,
    updateCursorPosition: supabaseUpdateCursorPosition,
  } = useSupabaseCollaboration({
    entityType: 'issue',
    entityId: issueId || '',
    userId: user?.id || '',
    userName: user?.name || user?.email?.split('@')[0] || 'Anonymous',
    userColor: user?.id ? getUserColor(user.id) : undefined,
    avatarUrl: user?.avatarUrl,
    enabled: !!(issueId && user?.id && !isLoading),
  });

  // Combine cursors from Cloudflare (CRDT) and Supabase (Presence)
  const remoteCursors = useMemo(() => {
    const combined = new Map<string, RemoteCursor>(yjsRemoteCursors || []);
    presenceUsers.forEach((u) => {
      if (!combined.has(u.id)) {
        combined.set(u.id, {
          odId: u.id,
          id: u.id,
          name: u.name,
          color: u.color,
          avatar: u.avatar,
          position: u.cursorPosition || 0,
          blockId: u.blockId,
          lastUpdate: u.lastSeen || Date.now(),
        });
      }
    });
    return combined;
  }, [yjsRemoteCursors, presenceUsers]);

  // Auto-save for title
  const { debouncedSave: debouncedSaveTitle, setInitialValue: setInitialTitle } = useAutoSave({
    onSave: async (value) => {
      if (!issue || value === issue.title) return;
      setIsSavingTitle(true);
      try {
        await handleUpdateIssue({ title: value });
        setTitleSaved(true);
        setTimeout(() => setTitleSaved(false), 2000);
      } finally {
        setIsSavingTitle(false);
      }
    },
    delay: 1500,
  });

  // Auto-save for description
  const { debouncedSave: debouncedSaveDescription, setInitialValue: setInitialDescription } = useAutoSave({
    onSave: async (value) => {
      if (!issue) return;
      const currentDesc = issue.description || '';
      if (value === currentDesc) return;
      setIsSavingDescription(true);
      try {
        await handleUpdateIssue({ description: value || null });
        setDescriptionSaved(true);
        setTimeout(() => setDescriptionSaved(false), 2000);
      } finally {
        setIsSavingDescription(false);
      }
    },
    delay: 1500,
  });

  // Load issue data
  const loadIssue = useCallback(async () => {
    if (!issueId) return;

    setIsLoading(true);
    try {
      const issueData = await issueService.getIssue(issueId);
      setIssue(issueData);
      setEditTitle(issueData.title);
      setEditDescription(issueData.description || '');
      setInitialTitle(issueData.title);
      setInitialDescription(issueData.description || '');
    } catch (error) {
      console.error('Failed to load issue:', error);
      toast.error(t('issues.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [issueId, setInitialTitle, setInitialDescription, t]);

  // Load comments and activities
  const loadCommentsAndActivities = useCallback(async () => {
    if (!issueId) return;

    try {
      const [commentsData, activitiesData] = await Promise.all([
        commentService.getComments(issueId),
        activityService.getActivities(issueId),
      ]);
      setComments(commentsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Failed to load comments/activities:', error);
    }
  }, [issueId]);

  // Load team members for assignee selection
  const loadMembers = useCallback(async () => {
    if (!currentTeam?.id) return;

    try {
      const membersData = await teamMemberService.getMembers(currentTeam.id);
      setMembers(membersData.map(m => m.profile));
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }, [currentTeam?.id]);

  // Load team cycles for sprint selection
  const loadCycles = useCallback(async () => {
    if (!currentTeam?.id) return;

    try {
      const cyclesData = await cycleService.getCycles(currentTeam.id);
      setCycles(cyclesData);
    } catch (error) {
      console.error('Failed to load cycles:', error);
    }
  }, [currentTeam?.id]);

  // Load PRDs for linking
  const loadPrds = useCallback(async () => {
    if (!currentTeam?.id) return;

    try {
      const prdsData = await prdService.getPRDs(currentTeam.id);
      setPrds(prdsData.map(p => ({ id: p.id, title: p.title, project_id: p.project_id })));
    } catch (error) {
      console.error('Failed to load PRDs:', error);
    }
  }, [currentTeam?.id]);

  useEffect(() => {
    loadIssue();
    loadCommentsAndActivities();
    loadMembers();
    loadCycles();
    loadPrds();
  }, [loadIssue, loadCommentsAndActivities, loadMembers, loadCycles, loadPrds]);

  // Inline block comments
  const loadBlockComments = useCallback(async () => {
    if (!issueId) return;
    try {
      const comments = await blockCommentService.getComments(issueId, 'issue');
      setBlockComments(comments);
    } catch (error) {
      console.error('Failed to load block comments:', error);
    }
  }, [issueId]);

  useEffect(() => { loadBlockComments(); }, [loadBlockComments]);

  useEffect(() => {
    if (!issueId) return;
    return blockCommentService.subscribeToComments(issueId, 'issue', loadBlockComments);
  }, [issueId, loadBlockComments]);

  const handleCommentClick = useCallback((blockId: string) => {
    setActiveCommentBlockId(blockId);
    setCommentPanelOpen(true);
  }, []);

  const handleAddBlockComment = useCallback(async (blockId: string, content: string) => {
    if (!issueId) return;
    await blockCommentService.addComment(issueId, 'issue', blockId, content);
    await loadBlockComments();
  }, [issueId, loadBlockComments]);

  const handleResolveBlockComment = useCallback(async (commentId: string) => {
    await blockCommentService.resolveComment(commentId);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleAddBlockReply = useCallback(async (commentId: string, content: string) => {
    await blockCommentService.addReply(commentId, content);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleToggleBlockReaction = useCallback(async (commentId: string, emoji: string) => {
    await blockCommentService.toggleReaction(commentId, emoji);
    await loadBlockComments();
  }, [loadBlockComments]);

  // Listen for real-time updates
  useRealtimeIssueUpdates((updatedIssueId, changes) => {
    if (updatedIssueId === issueId) {
      setIssue(prev => prev ? { ...prev, ...changes } as Issue : null);
    }
  });

  const handleUpdateIssue = async (updates: Partial<Issue>) => {
    if (!issue) return;

    try {
      const updated = await issueService.updateIssue(issue.id, updates);
      setIssue(updated);

      // Broadcast to other users
      broadcastIssueUpdate(issue.id, updates);
    } catch (error) {
      toast.error(t('issues.updateError'));
      throw error;
    }
  };

  const handleTitleChange = (value: string) => {
    setEditTitle(value);
    debouncedSaveTitle(value);
  };

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value);
    // Persist to DB - Yjs CRDT handles real-time sync between users
    debouncedSaveDescription(value);
  };

  const handleSendComment = async () => {
    if (!issueId || !newComment.trim()) return;

    setIsSendingComment(true);
    try {
      await commentService.createComment(issueId, newComment.trim());
      setNewComment('');
      loadCommentsAndActivities();
      toast.success(t('issues.commentAdded'));
    } catch (error) {
      toast.error(t('issues.commentError'));
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      loadCommentsAndActivities();
      toast.success(t('issues.commentDeleted'));
    } catch (error) {
      toast.error(t('issues.deleteCommentError'));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t('issues.linkCopied'));
  };

  // Archive issue handler
  const handleArchive = async () => {
    if (!issue) return;
    try {
      await issueService.archiveIssue(issue.id);
      toast.success(t('issues.archived', 'Issue archived'));
      navigate('/issues');
    } catch (error) {
      console.error('Failed to archive issue:', error);
      toast.error(t('issues.archiveError', 'Failed to archive issue'));
    }
  };

  // AI Assistant handler
  const handleAISend = async () => {
    if (!aiInput.trim() || isAILoading || !issue) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: aiInput.trim(),
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, userMessage]);
    const userQuery = aiInput.trim();
    setAiInput('');
    setIsAILoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setAiMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant' as const,
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
              content: `You are an issue editing assistant. Help the user with their issue.
              
Current Issue:
- Title: ${issue.title}
- Description: ${issue.description || 'No description'}
- Status: ${issue.status}
- Priority: ${issue.priority}
- Type: ${(issue as any).type || 'task'}

Help the user understand the issue, suggest improvements, or answer questions about it.
Respond in the same language as the user's message.`
            },
            ...aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userQuery }
          ],
          provider: selectedProvider,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

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
                  parsed.text || '';
                if (delta) {
                  fullContent += delta;
                  setAiMessages(prev => prev.map(m =>
                    m.id === assistantMessageId ? { ...m, content: fullContent } : m
                  ));
                }
              } catch {
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
    } catch (error) {
      console.error('AI request failed:', error);
      setAiMessages(prev => prev.map(m =>
        m.id === assistantMessageId ? {
          ...m,
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } : m
      ));
    } finally {
      setIsAILoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  if (!issue) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-12 w-12 text-slate-400" />
          <p className="text-lg font-medium">{t('issues.notFound')}</p>
          <Button onClick={() => navigate('/issues')}>{t('issues.backToList')}</Button>
        </div>
      </AppLayout>
    );
  }

  const issueType = (issue as any).type as IssueType || 'task';

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row h-full">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[#0d0d0f]/95 backdrop-blur z-10 border-b border-white/10 px-3 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.history.length > 1) {
                      navigate(-1);
                    } else {
                      navigate('/issues');
                    }
                  }}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {/* Issue Type Icon with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
                      <IssueTypeIcon type={issueType} />
                      <span className="sr-only">{t('issues.changeType', 'Change type')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="z-[100]">
                    {allIssueTypes.map((type) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          const typeField = issueTypeConfig[type]?.typeField;
                          if (typeField) {
                            handleUpdateIssue({ issue_type: typeField } as any);
                          }
                        }}
                      >
                        <IssueTypeIcon type={type} showLabel />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs sm:text-sm text-slate-400 font-mono">
                  {issue.identifier}
                </span>
                {/* Save Status Indicator (Google Docs style) */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs ml-2">
                  {(isSavingTitle || isSavingDescription) ? (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (titleSaved || descriptionSaved) ? (
                    <div className="flex items-center gap-1 text-green-500">
                      <Cloud className="h-3 w-3" />
                      <span>Saved</span>
                    </div>
                  ) : null}
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <IssueFocusIndicator issueId={issue.id} />
                  {issueId && <EditingIndicator issueId={issueId} />}
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Mobile Properties Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden h-8"
                  onClick={() => setShowMobileProperties(!showMobileProperties)}
                >
                  Properties
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopyLink} className="hidden sm:flex">
                  <Copy className="h-4 w-4 mr-1" />
                  Link
                </Button>
                <Button
                  variant={showAIPanel ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">AI</span>
                  {showAIPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-orange-500" onClick={handleArchive}>
                      <Archive className="h-4 w-4 mr-2" />
                      {t('common.archive', 'Archive')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile Properties Panel */}
          {showMobileProperties && (
            <div className="lg:hidden p-4 border-b border-white/10 bg-white/5 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400">{t('issues.status')}</label>
                <Select
                  value={issue.status}
                  onValueChange={(v) => handleUpdateIssue({ status: v as IssueStatus })}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={issue.status} />
                        <span className="text-sm">{STATUS_OPTIONS.find(s => s.value === issue.status)?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={status.value} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">{t('issues.priority')}</label>
                <Select
                  value={issue.priority}
                  onValueChange={(v) => handleUpdateIssue({ priority: v as IssuePriority })}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <PriorityIcon priority={issue.priority} />
                        <span className="text-sm">{PRIORITY_OPTIONS.find(p => p.value === issue.priority)?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        <div className="flex items-center gap-2">
                          <PriorityIcon priority={priority.value} />
                          {priority.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Issue Content */}
          <div className="p-4 sm:p-6 w-full">
            {/* Title - Click to edit */}
            <div className="relative group">
              {isEditingTitle ? (
                <div className="relative">
                  <Input
                    value={editTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    autoFocus
                    className="text-2xl font-semibold border-none px-0 focus-visible:ring-1 focus-visible:ring-primary h-auto py-1"
                    placeholder={t('issues.issueTitle')}
                  />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {isSavingTitle && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {titleSaved && <Check className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
              ) : (
                <h1
                  className="text-2xl font-semibold cursor-text hover:bg-white/5 rounded px-1 py-1 -mx-1 transition-colors"
                  onClick={() => {
                    setIsEditingTitle(true);
                    setCollabIsEditing(true);
                  }}
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Description - Enhanced Block Editor */}
            <div className="mt-4 relative">
              {isEditingDescription ? (
                <div className="relative">
                  <div className="absolute right-0 top-0 flex items-center gap-2 z-10">
                    {isSavingDescription && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {descriptionSaved && <Check className="h-4 w-4 text-green-500" />}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => {
                        setIsEditingDescription(false);
                        setCollabIsEditing(false);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                  <div className="min-h-[500px]">
                    <BlockEditor
                      content={editDescription || ''}
                      onChange={(content) => handleDescriptionChange(content)}
                      placeholder={t('issues.addDescription', 'Add a description... Type "/" for commands')}
                      editable={true}
                      autoFocus={true}
                      yjsDoc={yjsDoc || undefined}
                      yjsProvider={yjsProvider || undefined}
                      remoteCursors={remoteCursors.size > 0 ? remoteCursors : undefined}
                      onCursorPositionChange={(pos, blockId) => {
                        yjsUpdateCursorPosition(pos, blockId);
                        supabaseUpdateCursorPosition(pos, blockId);
                      }}
                      comments={blockComments}
                      onCommentClick={handleCommentClick}
                    />
                  </div>
                </div>
              ) : (editDescription || issue.description) ? (
                <div
                  className="cursor-text hover:bg-white/5 rounded-lg px-3 py-3 -mx-2 transition-colors border border-transparent hover:border-white/10"
                  onClick={() => {
                    setIsEditingDescription(true);
                    setCollabIsEditing(true);
                  }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-400
                    [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1
                    [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm
                    [&_code]:text-xs [&_code]:bg-[#121215] [&_code]:px-1 [&_code]:rounded
                    [&_pre]:bg-[#121215] [&_pre]:p-3 [&_pre]:rounded-lg
                    [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3
                  ">
                    <div dangerouslySetInnerHTML={{ __html: editDescription || issue.description || '' }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsEditingDescription(true);
                    setCollabIsEditing(true);
                  }}
                  className="text-slate-400 hover:text-white hover:bg-white/5 rounded-lg px-3 py-4 -mx-2 transition-colors w-full text-left border border-dashed border-white/10/50 hover:border-white/10"
                >
                  <Pencil className="h-4 w-4 inline-block mr-2 opacity-50" />
                  {t('issues.addDescription', 'Add a description...')}
                </button>
              )}
            </div>

            {/* Acceptance Criteria for User Stories */}
            {issueType === 'user_story' && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">{t('issues.acceptanceCriteria', 'Acceptance Criteria')}</h3>
                <div className="bg-white/5 rounded-lg p-4 text-sm text-slate-400">
                  {(issue as any).acceptance_criteria ? (
                    <ul className="list-disc list-inside space-y-1">
                      {((issue as any).acceptance_criteria as string[]).map((criteria, idx) => (
                        <li key={idx}>{criteria}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic">{t('issues.noAcceptanceCriteria', 'No acceptance criteria defined')}</p>
                  )}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Comments & Activity Tabs */}
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments" className="gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {t('issues.comments')} ({comments.length})
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-1">
                  <Activity className="h-4 w-4" />
                  {t('issues.activity')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="mt-4 space-y-4">
                {/* Typing Indicator */}
                {issueId && <TypingIndicator issueId={issueId} />}

                {/* New Comment */}
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => {
                        setNewComment(e.target.value);
                        setIsTyping(e.target.value.length > 0);
                      }}
                      onBlur={() => setIsTyping(false)}
                      placeholder={t('issues.writeComment')}
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendComment}
                      disabled={!newComment.trim() || isSendingComment}
                      size="icon"
                    >
                      {isSendingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.user?.avatar_url || undefined} />
                      <AvatarFallback>{comment.user?.name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comment.user?.name || t('common.user')}</span>
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                        {comment.user_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-center text-slate-400 py-8">
                    {t('issues.noComments')}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-4 space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={activity.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {activity.user?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="font-medium">{activity.user?.name || t('common.system')}</span>
                      <span className="text-slate-400 ml-1">
                        {t(`activity.${activity.type}`, activity.type)}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <p className="text-center text-slate-400 py-8">
                    {t('issues.noActivityLog')}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sidebar - Properties (Desktop only) */}
        <div className="hidden lg:block w-72 border-l border-white/10 p-4 space-y-6 overflow-y-auto">
          {/* Issue Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.type', 'Type')}</label>
            <Select
              value={issueType}
              onValueChange={async (v) => {
                // Update local state immediately for responsiveness
                setIssue(prev => prev ? { ...prev, type: v as IssueType } as Issue : null);
                try {
                  const updated = await issueService.updateIssue(issue.id, { type: v } as any);
                  // Sync with server response
                  setIssue(updated as Issue);
                  toast.success(t('issues.typeUpdated', '이슈 타입이 변경되었습니다'));
                } catch (error) {
                  // Revert on error
                  setIssue(prev => prev ? { ...prev, type: issueType } as Issue : null);
                  toast.error(t('issues.updateError', '업데이트에 실패했습니다'));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  <IssueTypeIcon type={issueType} showLabel />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allIssueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <IssueTypeIcon type={type} showLabel />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.status')}</label>
            <Select
              value={issue.status}
              onValueChange={(v) => handleUpdateIssue({ status: v as IssueStatus })}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={issue.status} />
                    {STATUS_OPTIONS.find(s => s.value === issue.status)?.label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={status.value} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.priority')}</label>
            <Select
              value={issue.priority}
              onValueChange={(v) => handleUpdateIssue({ priority: v as IssuePriority })}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <PriorityIcon priority={issue.priority} />
                    {PRIORITY_OPTIONS.find(p => p.value === issue.priority)?.label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={priority.value} />
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.assignee')}</label>
            <Select
              value={issue.assignee_id || 'unassigned'}
              onValueChange={(v) => handleUpdateIssue({ assignee_id: v === 'unassigned' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('issues.unassigned')}>
                  {issue.assignee_id ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {members.find(m => m.id === issue.assignee_id)?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {members.find(m => m.id === issue.assignee_id)?.name || 'Unknown'}
                    </div>
                  ) : (
                    <span className="text-slate-400">{t('issues.unassigned')}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-slate-400">{t('issues.unassigned')}</span>
                </SelectItem>
                {/* Assign to myself */}
                {user && (
                  <SelectItem value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {user.email?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{t('issues.assignToMe', 'Assign to me')}</span>
                    </div>
                  </SelectItem>
                )}
                {members.filter(m => m.id !== user?.id).map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{member.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      {member.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reporter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.reporter', 'Reporter')}</label>
            <Select
              value={(issue as any).reporter_id || issue.created_by || 'unassigned'}
              onValueChange={(v) => handleUpdateIssue({ reporter_id: v === 'unassigned' ? null : v } as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('issues.unassigned')}>
                  {(() => {
                    const reporterId = (issue as any).reporter_id || issue.created_by;
                    const reporter = members.find(m => m.id === reporterId);
                    return reporterId ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={reporter?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {reporter?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        {reporter?.name || 'Unknown'}
                      </div>
                    ) : (
                      <span className="text-slate-400">{t('issues.unassigned')}</span>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-slate-400">{t('issues.unassigned')}</span>
                </SelectItem>
                {/* Set myself as reporter */}
                {user && (
                  <SelectItem value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {user.email?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{t('issues.setMeAsReporter', 'Set me as reporter')}</span>
                    </div>
                  </SelectItem>
                )}
                {members.filter(m => m.id !== user?.id).map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{member.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      {member.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.startDate', 'Start Date')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !(issue as any).start_date && "text-slate-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {(issue as any).start_date ? (
                    format(new Date((issue as any).start_date), 'PPP', { locale: dateLocale })
                  ) : (
                    <span>{t('issues.pickStartDate', 'Pick start date')}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={(issue as any).start_date ? new Date((issue as any).start_date) : undefined}
                  onSelect={(date) => {
                    handleUpdateIssue({ start_date: date ? format(date, 'yyyy-MM-dd') : null } as any);
                  }}
                  initialFocus
                  locale={dateLocale}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.dueDate')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !issue.due_date && "text-slate-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {issue.due_date ? (
                    format(new Date(issue.due_date), 'PPP', { locale: dateLocale })
                  ) : (
                    <span>{t('issues.pickDate', 'Pick a date')}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={issue.due_date ? new Date(issue.due_date) : undefined}
                  onSelect={(date) => {
                    handleUpdateIssue({
                      due_date: date ? format(date, 'yyyy-MM-dd') : null
                    });
                  }}
                  initialFocus
                  locale={dateLocale}
                />
                {issue.due_date && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => handleUpdateIssue({ due_date: null })}
                    >
                      {t('issues.clearDate', 'Clear date')}
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Estimate */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.estimate')}</label>
            <Select
              value={issue.estimate?.toString() || 'none'}
              onValueChange={(v) => handleUpdateIssue({ estimate: v === 'none' ? null : parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('issues.noEstimate')}>
                  {issue.estimate ? (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      {issue.estimate} {t('issues.points')}
                    </div>
                  ) : (
                    <span className="text-slate-400">{t('issues.noEstimate')}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('issues.noEstimate')}</SelectItem>
                {[1, 2, 3, 5, 8, 13, 21].map((points) => (
                  <SelectItem key={points} value={points.toString()}>
                    {points} {t('issues.points')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cycle/Sprint */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.cycle', 'Sprint')}</label>
            <Select
              value={issue.cycle_id || 'none'}
              onValueChange={async (v) => {
                try {
                  if (v === 'none') {
                    await cycleService.removeIssueFromCycle(issue.id);
                    setIssue(prev => prev ? { ...prev, cycle_id: null } : null);
                  } else {
                    await cycleService.addIssueToCycle(issue.id, v);
                    setIssue(prev => prev ? { ...prev, cycle_id: v } : null);
                  }
                  toast.success(t('issues.cycleUpdated', 'Sprint updated'));
                } catch (error) {
                  console.error('Failed to update cycle:', error);
                  toast.error(t('issues.cycleUpdateFailed', 'Failed to update sprint'));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('issues.noCycle', 'No sprint')}>
                  {issue.cycle_id ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {cycles.find(c => c.id === issue.cycle_id)?.name || 'Sprint'}
                    </div>
                  ) : (
                    <span className="text-slate-400">{t('issues.noCycle', 'No sprint')}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('issues.noCycle', 'No sprint')}</SelectItem>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    <div className="flex flex-col">
                      <span>{cycle.name}</span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(cycle.start_date), 'MMM d')} - {format(new Date(cycle.end_date), 'MMM d')}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked PRD/Document */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase">{t('issues.linkedPrd', 'Linked PRD')}</label>
            <Select
              value={issue.prd_id || 'none'}
              onValueChange={async (v) => {
                try {
                  const newPrdId = v === 'none' ? null : v;
                  await issueService.updateIssue(issue.id, { prd_id: newPrdId });
                  setIssue(prev => prev ? { ...prev, prd_id: newPrdId } : null);
                  toast.success(t('issues.prdUpdated', 'Linked PRD updated'));
                } catch (error) {
                  console.error('Failed to update linked PRD:', error);
                  toast.error(t('issues.prdUpdateFailed', 'Failed to update linked PRD'));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('issues.noPrd', 'No linked PRD')}>
                  {issue.prd_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span className="truncate">{prds.find(p => p.id === issue.prd_id)?.title || 'PRD'}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">{t('issues.noPrd', 'No linked PRD')}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('issues.noPrd', 'No linked PRD')}</SelectItem>
                {prds.map((prd) => (
                  <SelectItem key={prd.id} value={prd.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span className="truncate">{prd.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('issues.created')}</span>
              <span>{format(new Date(issue.created_at), 'MMM d, yyyy', { locale: dateLocale })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t('issues.updated')}</span>
              <span>{formatDistanceToNow(new Date(issue.updated_at), { addSuffix: true, locale: dateLocale })}</span>
            </div>
          </div>
        </div>

        {/* Inline Comment Panel */}
        <CommentPanel
          isOpen={commentPanelOpen}
          onClose={() => setCommentPanelOpen(false)}
          blockId={activeCommentBlockId}
          comments={blockComments}
          onAddComment={handleAddBlockComment}
          onResolveComment={handleResolveBlockComment}
          onAddReply={handleAddBlockReply}
          onToggleReaction={handleToggleBlockReaction}
        />

        {/* AI Assistant Panel */}
        {showAIPanel && (
          <div className="w-80 border-l border-white/10 flex flex-col bg-white/5">
            {/* AI Panel Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#0d0d0f]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">AI Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedProvider} onValueChange={(v: AIProvider) => setSelectedProvider(v)}>
                  <SelectTrigger className="h-7 w-[90px] text-[10px]">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.length > 0 ? (
                      availableProviders.map(provider => (
                        <SelectItem key={provider} value={provider} className="text-xs">
                          {PROVIDER_LABELS[provider] || provider}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="anthropic" className="text-xs">Claude</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowAIPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {aiMessages.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Ask AI about this issue</p>
                  <p className="text-xs mt-1">Get suggestions, improvements, or answers</p>
                </div>
              ) : (
                aiMessages.map((msg) => {
                  // Extract thinking content
                  let thinkingContent = '';
                  let cleanContent = msg.content;
                  const thinkingMatch = cleanContent.match(/<thinking>([\s\S]*?)<\/thinking>/);
                  if (thinkingMatch) {
                    thinkingContent = thinkingMatch[1];
                    cleanContent = cleanContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
                  }

                  return (
                    <div key={msg.id}>
                      {/* Timeline Thinking Block */}
                      {msg.role === 'assistant' && thinkingContent && (
                        <TimelineThinkingBlock content={thinkingContent} />
                      )}

                      <div className={cn(
                        "flex gap-2",
                        msg.role === 'user' && "flex-row-reverse"
                      )}>
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarFallback className={cn(
                            "text-[10px]",
                            msg.role === 'assistant' && "bg-primary text-primary-foreground"
                          )}>
                            {msg.role === 'assistant' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "rounded-lg px-2.5 py-1.5 max-w-[85%]",
                          msg.role === 'user'
                            ? "bg-primary text-primary-foreground text-xs"
                            : "bg-[#0d0d0f] border"
                        )}>
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed
                              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                              [&_p]:my-2 [&_p]:leading-6
                              [&_ul]:my-2 [&_ul]:pl-4 [&_ul]:list-disc
                              [&_ol]:my-2 [&_ol]:pl-4 [&_ol]:list-decimal
                              [&_li]:leading-6
                              [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                              [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
                              [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1
                              [&_code]:text-[10px] [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                              [&_pre]:my-2 [&_pre]:bg-zinc-900 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[10px]
                              [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-2 [&_blockquote]:my-2 [&_blockquote]:italic
                              [&_table]:my-2 [&_table]:text-[10px] [&_table]:border-collapse
                              [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-white/5
                              [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1
                            ">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {cleanContent || 'Thinking...'}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-xs">{cleanContent}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isAILoading && !aiMessages.find(m => m.content === '') && (
                <div className="flex gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-[#0d0d0f] border rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 bg-[#0d0d0f]">
              <div className="flex gap-2">
                <Textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask AI about this issue..."
                  className="min-h-[60px] max-h-[100px] text-xs resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAISend();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-[60px] w-10"
                  onClick={handleAISend}
                  disabled={isAILoading || !aiInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
