import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppLayout } from '@/components/layout';
import { prdService, type PRDWithRelations } from '@/features/prd';
import { projectService } from '@/lib/services';
import { teamMemberService } from '@/lib/services/teamService';
import { notificationService } from '@/lib/services/notificationService';
import { prdVersionService } from '@/features/prd';
import { BlockEditor } from '@/components/editor';
import { CommentPanel } from '@/components/editor/CommentPanel';
import { VersionHistoryPanel } from '@/components/prd/VersionHistoryPanel';
import { blockCommentService } from '@/lib/services/blockCommentService';
import type { BlockComment as BlockCommentType } from '@/types/database';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useCloudflareCollaboration } from '@/hooks/useCloudflareCollaboration';
import { useSupabaseCollaboration } from '@/hooks/collaboration/useSupabaseCollaboration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { userAISettingsService } from '@/lib/services/conversationService';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import type { AIProvider } from '@/types';
import { TimelineThinkingBlock } from '@/components/issues';
import { extractOverview, type VersionEntry, type AISuggestion, type AIMessage, type PRDStatus } from '@/features/prd/types/PRDTypes';


// Types and utilities are now imported from ./prd/PRDTypes
// TimelineThinkingBlock is now imported from @/components/issues/TimelineThinkingBlock


const statusConfig: Record<PRDStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-[#121215] text-slate-400', icon: <Pencil className="h-3 w-3" /> },
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

  // Track if Yjs document has content (for new PRDs, Yjs is empty so we use DB content)
  const [useYjsForCollab, setUseYjsForCollab] = useState(true);
  const [hasInitializedYjs, setHasInitializedYjs] = useState(false);

  // AI Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<AISuggestion | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic');
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const [teamMembers, setTeamMembers] = useState<import('@/types/database').Profile[]>([]);

  // Project linking state
  const [allProjects, setAllProjects] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  const [linkedProjects, setLinkedProjects] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Generate a consistent user color based on user ID
  const getUserColor = (userId: string) => {
    const colors = [
      '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
      '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Yjs CRDT Real-time Collaboration (WebSocket to Cloudflare Durable Object)
  // Handles document sync, cursor positions, text selections, and offline editing
  const {
    yjsDoc,
    provider: yjsProvider,
    isConnected: isYjsConnected,
    isSynced: isYjsSynced,
    remoteCursors: yjsRemoteCursors,
    updateCursorPosition: yjsUpdateCursorPosition,
  } = useCloudflareCollaboration({
    documentId: prdId || '',
    documentType: 'prd',
    teamId: currentTeam?.id || '',
    userId: user?.id || '',
    userName: user?.name || user?.email?.split('@')[0] || 'Anonymous',
    userColor: user?.id ? getUserColor(user.id) : undefined,
    avatarUrl: user?.avatarUrl,
    enabled: !!(prdId && currentTeam?.id && user?.id && !isLoading),
  });

  // Supabase Realtime for presence and content sync fallback (when Yjs is unavailable)
  const {
    isConnected: isSupabaseCollabConnected,
    presenceUsers,
    updateCursorPosition: supabaseUpdateCursorPosition,
    broadcastContentChange,
    onRemoteContentChange,
  } = useSupabaseCollaboration({
    entityType: 'prd',
    entityId: prdId || '',
    userId: user?.id || '',
    userName: user?.name || user?.email?.split('@')[0] || 'Anonymous',
    userColor: user?.id ? getUserColor(user.id) : undefined,
    avatarUrl: user?.avatarUrl,
    enabled: !!(prdId && user?.id && !isLoading),
  });

  // Combine remote cursors from Cloudflare (CRDT) and Supabase (Presence)
  const remoteCursors = useMemo(() => {
    const combined = new Map(yjsRemoteCursors || []);
    // Add Supabase presence users for block presence indicator
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

  // Update cursor position to Cloudflare (primary) and Supabase (presence)
  const updateCursorPosition = useCallback((position: number, blockId?: string) => {
    yjsUpdateCursorPosition(position, blockId);
    supabaseUpdateCursorPosition(position, blockId);
  }, [yjsUpdateCursorPosition, supabaseUpdateCursorPosition]);

  // Register callback for Supabase content sync (fallback when Yjs is unavailable)
  useEffect(() => {
    if (!useYjsForCollab) {
      onRemoteContentChange((remoteContent: string, fromUserId: string) => {
        // Only apply if it's different from what we have
        if (remoteContent !== content) {
          setContent(remoteContent);
        }
      });
    }
  }, [useYjsForCollab, onRemoteContentChange, content]);

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

  // Fetch team members for @mention
  useEffect(() => {
    async function fetchTeamMembers() {
      if (currentTeam?.id) {
        try {
          const members = await teamMemberService.getMembers(currentTeam.id);
          const profiles = members.map(m => m.profile).filter(Boolean);
          setTeamMembers(profiles);
        } catch (error) {
          console.error('Failed to fetch team members:', error);
        }
      }
    }
    fetchTeamMembers();
  }, [currentTeam?.id]);

  // Handle @mention callback - saves to DB notifications for inbox and sends email
  const handleMention = useCallback(async (userId: string, userName: string) => {
    if (!user || !prd || userId === user.id) return; // Don't notify self

    try {
      // Save to DB notifications table for proper inbox integration
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: user.id,
        type: 'prd_mentioned',
        title: `${user.name || user.email} mentioned you`,
        message: `In PRD: ${prd.title}`,
        entity_type: 'prd',
        entity_id: prd.id,
        data: { prdId: prd.id, mentionedBy: user.id, prdTitle: prd.title },
        read: false,
      });

      // Find mentioned user's email for email notification
      const mentionedUser = teamMembers.find(m => m.id === userId);
      if (mentionedUser?.email) {
        // Call Edge Function to send email (fire and forget, don't block UI)
        supabase.functions.invoke('send-mention-email', {
          body: {
            recipientId: userId,
            recipientEmail: mentionedUser.email,
            recipientName: mentionedUser.name || mentionedUser.email,
            mentionerName: user.name || user.email,
            mentionerEmail: user.email,
            prdId: prd.id,
            prdTitle: prd.title,
          },
        }).catch(err => console.error('Failed to send mention email:', err));
      }
    } catch (error) {
      console.error('Failed to create mention notification:', error);
    }
  }, [user, prd, teamMembers]);

  // Version history for undo
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Inline comments state
  const [blockComments, setBlockComments] = useState<BlockCommentType[]>([]);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);

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

  // Load inline comments and subscribe to changes
  const loadBlockComments = useCallback(async () => {
    if (!prdId) return;
    try {
      const comments = await blockCommentService.getComments(prdId, 'prd');
      setBlockComments(comments);
    } catch (error) {
      console.error('Failed to load block comments:', error);
    }
  }, [prdId]);

  useEffect(() => {
    loadBlockComments();
  }, [loadBlockComments]);

  // Real-time subscription for block comments
  useEffect(() => {
    if (!prdId) return;
    const unsubscribe = blockCommentService.subscribeToComments(prdId, 'prd', loadBlockComments);
    return unsubscribe;
  }, [prdId, loadBlockComments]);

  const handleCommentClick = useCallback((blockId: string) => {
    setActiveCommentBlockId(blockId);
    setCommentPanelOpen(true);
  }, []);

  const handleAddComment = useCallback(async (blockId: string, content: string) => {
    if (!prdId) return;
    await blockCommentService.addComment(prdId, 'prd', blockId, content);
    await loadBlockComments();
  }, [prdId, loadBlockComments]);

  const handleResolveComment = useCallback(async (commentId: string) => {
    await blockCommentService.resolveComment(commentId);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleUnresolveComment = useCallback(async (commentId: string) => {
    await blockCommentService.unresolveComment(commentId);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    await blockCommentService.deleteComment(commentId);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleAddReply = useCallback(async (commentId: string, content: string) => {
    await blockCommentService.addReply(commentId, content);
    await loadBlockComments();
  }, [loadBlockComments]);

  const handleToggleReaction = useCallback(async (commentId: string, emoji: string) => {
    await blockCommentService.toggleReaction(commentId, emoji);
    await loadBlockComments();
  }, [loadBlockComments]);

  // Scroll AI messages to bottom
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // Track version creation time (create version every 5 minutes)
  const lastVersionTimeRef = useRef<number>(0);
  const VERSION_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Auto-save content (matching Issue pattern)
  const { debouncedSave: debouncedSaveContent, setInitialValue: setInitialContent } = useAutoSave({
    onSave: async (value) => {
      if (!prdId) return;
      setIsSavingContent(true);
      try {
        // Update both content and overview for list preview sync
        const overview = extractOverview(value);
        await prdService.updatePRD(currentTeam!.id, prdId, { content: value, overview });
        setLastSaved(new Date());
        setContentSaved(true);
        setTimeout(() => setContentSaved(false), 2000);

        // Create version if 5 minutes have passed since last version
        const now = Date.now();
        if (now - lastVersionTimeRef.current > VERSION_INTERVAL) {
          try {
            await prdVersionService.createVersion(currentTeam!.id, prdId, value, title, 'Auto-saved');
            lastVersionTimeRef.current = now;
          } catch (versionError) {
            console.error('Failed to create version:', versionError);
          }
        }
      } catch (error) {
        console.error('Failed to auto-save:', error);
        toast.error(t('prd.saveFailed', 'Failed to save. Please try again.'));
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
        await prdService.updatePRD(currentTeam!.id, prdId, { title: value.trim() });
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
      if (!currentTeam?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await prdService.getPRD(currentTeam.id, prdId);
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

          // Load linked projects for this PRD
          try {
            const linked = await prdService.getLinkedProjects(currentTeam.id, prdId);
            setLinkedProjects(linked);
          } catch (e) {
            console.log('No linked projects found');
          }
        }

        // Load all projects for the team (for dropdown)
        if (currentTeam?.id) {
          try {
            const projects = await projectService.getProjects(currentTeam.id);
            setAllProjects(projects.map(p => ({ id: p.id, name: p.name, icon: p.icon })));
          } catch (e) {
            console.log('Could not load projects');
          }
        }
      } catch (error) {
        console.error('Failed to load PRD:', error);
        toast.error(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPRD();
  }, [prdId, t, currentTeam?.id]);

  // When Yjs syncs and the document is empty, initialize it with DB content
  // This handles the case where a new PRD was created without Yjs (e.g., from Lily AI)
  useEffect(() => {
    if (isYjsSynced && yjsDoc && !hasInitializedYjs && content) {
      const yFragment = yjsDoc.getXmlFragment('prosemirror');
      const isEmpty = yFragment.length === 0;

      console.log('[PRDDetailPage] Yjs synced, fragment empty:', isEmpty, 'DB content length:', content.length);

      if (isEmpty && content.length > 0) {
        // Yjs is empty but DB has content - we'll let the editor initialize from content prop
        // The Tiptap Collaboration extension will pick up the content and sync to Yjs
        console.log('[PRDDetailPage] Yjs empty, will initialize from DB content');
        setUseYjsForCollab(false); // First render uses DB content
        // After a short delay, switch to Yjs mode (editor will have populated the Yjs doc)
        setTimeout(() => {
          setUseYjsForCollab(true);
          setHasInitializedYjs(true);
        }, 500);
      } else {
        // Yjs has content - use Yjs directly
        setUseYjsForCollab(true);
        setHasInitializedYjs(true);
      }
    }
  }, [isYjsSynced, yjsDoc, hasInitializedYjs, content]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(value !== savedTitle || content !== savedContent || status !== savedStatus);
    debouncedSaveTitle(value);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(title !== savedTitle || value !== savedContent || status !== savedStatus);

    // Persist to DB (debounced) - Yjs CRDT handles real-time sync between users,
    // but we still need to save to DB for non-collaboration reads and backup
    debouncedSaveContent(value, true);

    // When Yjs is NOT active, use Supabase broadcast to sync content to other users
    if (!useYjsForCollab) {
      broadcastContentChange(value);
    }
  };

  const handleStatusChange = async (newStatus: PRDStatus) => {
    if (!prdId) return;
    setStatus(newStatus);
    try {
      await prdService.updateStatus(currentTeam!.id, prdId, newStatus);
      setLastSaved(new Date());
      toast.success(t('prd.statusUpdated', 'Status updated'));
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const toggleProjectLink = async (projectId: string) => {
    if (!prdId) return;
    const isLinked = linkedProjects.some(p => p.id === projectId);
    try {
      if (isLinked) {
        await prdService.unlinkFromProject(currentTeam!.id, prdId, projectId);
        setLinkedProjects(prev => prev.filter(p => p.id !== projectId));
        toast.success(t('prd.projectUnlinked', 'Project unlinked'));
      } else {
        await prdService.linkToProject(currentTeam!.id, prdId, projectId);
        const project = allProjects.find(p => p.id === projectId);
        if (project) {
          setLinkedProjects(prev => [...prev, project]);
        }
        toast.success(t('prd.projectLinked', 'Project linked'));
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleSave = async () => {
    if (!prdId || !currentTeam?.id || !title.trim()) return;

    setIsSaving(true);
    try {
      await prdService.updatePRD(currentTeam.id, prdId, {
        title: title.trim(),
        content,
        status,
      });
      setLastSaved(new Date());
      setSavedTitle(title.trim());
      setSavedContent(content);
      setSavedStatus(status);
      setHasChanges(false);
      toast.success(t('settings.saved'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
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
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  if (!prd) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <FileText className="h-12 w-12 text-slate-400" />
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
        <div className="sticky top-0 bg-[#0d0d0f]/95 backdrop-blur z-10 border-b border-white/10">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/prd')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {/* Breadcrumb with Project Selector */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">PRDs</span>
                <span className="text-slate-400">/</span>

                {/* Project Multi-Select Dropdown */}
                <DropdownMenu open={showProjectSelector} onOpenChange={setShowProjectSelector}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-slate-400 hover:text-white">
                      <Folder className="h-3 w-3" />
                      {linkedProjects.length === 0 ? (
                        <span className="text-xs">{t('prd.addProject', 'Add project')}</span>
                      ) : linkedProjects.length === 1 ? (
                        <span className="text-xs">{linkedProjects[0].name}</span>
                      ) : (
                        <span className="text-xs">{linkedProjects.length} projects</span>
                      )}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {allProjects.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-slate-400 text-center">
                        {t('projects.noProjects', 'No projects')}
                      </div>
                    ) : (
                      allProjects.map(project => {
                        const isLinked = linkedProjects.some(p => p.id === project.id);
                        return (
                          <DropdownMenuItem
                            key={project.id}
                            onClick={() => toggleProjectLink(project.id)}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span>{project.icon || '📁'}</span>
                              <span>{project.name}</span>
                            </div>
                            {isLinked && <Check className="h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-slate-400">/</span>
                <span className="font-medium truncate max-w-[200px]">{title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Save Status Indicator (Google Docs style - matching Issue pattern) */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                {(isSavingTitle || isSavingContent) ? (
                  <div className="flex items-center gap-1 text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (titleSaved || contentSaved) ? (
                  <div className="flex items-center gap-1 text-green-500">
                    <Cloud className="h-3 w-3" />
                    <span>Saved</span>
                  </div>
                ) : lastSaved ? (
                  <span className="text-slate-400">
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
                    className="font-bold border-none px-2 -mx-2 focus-visible:ring-0 h-auto py-2 bg-transparent w-full"
                    style={{ fontSize: 'clamp(1.875rem, 5vw, 2.25rem)', lineHeight: 1.2 }}
                  />
                ) : (
                  <h1
                    className="text-3xl sm:text-4xl font-bold cursor-text hover:bg-white/5 rounded px-2 py-2 -mx-2 transition-colors group flex items-center gap-3"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {title || t('prd.titlePlaceholder', 'Untitled PRD')}
                    <Pencil className="h-5 w-5 opacity-0 group-hover:opacity-30 transition-opacity" />
                  </h1>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
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

              {/* Block Editor - conditionally use Yjs based on whether it has content */}
              <div className="min-h-[500px]">
                <BlockEditor
                  key={useYjsForCollab && yjsDoc ? `collab-${yjsDoc.guid}` : 'db-content'}
                  content={content}
                  onChange={handleContentChange}
                  placeholder="Start writing your PRD... Type '/' for commands or '@' to mention"
                  editable={true}
                  autoFocus={false}
                  teamMembers={teamMembers}
                  onMention={handleMention}
                  yjsDoc={useYjsForCollab && yjsDoc ? yjsDoc : undefined}
                  yjsProvider={useYjsForCollab && yjsProvider ? yjsProvider : undefined}
                  remoteCursors={remoteCursors.size > 0 ? remoteCursors : undefined}
                  onCursorPositionChange={updateCursorPosition}
                  comments={blockComments}
                  onCommentClick={handleCommentClick}
                />
              </div>

              {/* Footer actions */}
              <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {format(new Date(prd.updated_at), 'MMM d, yyyy h:mm a')}</span>
                </div>

                <div className="flex items-center gap-3">
                  <VersionHistoryPanel
                    teamId={currentTeam!.id}
                    prdId={prd.id}
                    currentContent={content}
                    onRestore={(restoredContent, restoredTitle) => {
                      setContent(restoredContent);
                      setTitle(restoredTitle);
                      window.location.reload(); // Refresh to get latest
                    }}
                  />
                  <Button variant="outline" onClick={() => setShowAIPanel(true)} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Edit with AI
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Panel */}
          {showAIPanel && (
            <div className="w-[40%] border-l border-white/10 flex flex-col bg-white/5">
              {/* AI Panel Header */}
              <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#0d0d0f]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Model Selector */}
                  <Select value={selectedProvider} onValueChange={(v: AIProvider) => setSelectedProvider(v)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px]">
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

              {/* Pending Suggestion Alert */}
              {pendingSuggestion && (
                <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/30">
                  <p className="text-xs font-medium text-yellow-600 mb-2">
                    📝 Pending change: {pendingSuggestion.description}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 gap-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleAcceptSuggestion(pendingSuggestion)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Allow
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 h-7 text-xs"
                      onClick={() => handleRejectSuggestion(pendingSuggestion)}
                    >
                      <XCircle className="h-3 w-3" />
                      Deny
                    </Button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {aiMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Ask AI to edit your PRD</p>
                    <p className="text-xs mt-1">Try: "Add a section about security requirements"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiMessages.map((msg) => {
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
                              {msg.suggestion && (
                                <div className="mt-2 pt-2 border-t border-white/10/50">
                                  {msg.suggestion.status === 'pending' ? (
                                    <div className="flex gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="flex-1 gap-1 h-6 text-[10px] bg-green-600 hover:bg-green-700"
                                        onClick={() => handleAcceptSuggestion(msg.suggestion!)}
                                      >
                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                        Allow
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1 h-6 text-[10px]"
                                        onClick={() => handleRejectSuggestion(msg.suggestion!)}
                                      >
                                        <XCircle className="h-2.5 w-2.5" />
                                        Deny
                                      </Button>
                                    </div>
                                  ) : (
                                    <Badge variant={msg.suggestion.status === 'accepted' ? 'default' : 'secondary'} className="text-[10px]">
                                      {msg.suggestion.status === 'accepted' ? '✓ Applied' : '✗ Rejected'}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <span className="text-[9px] opacity-50 mt-1 block">
                                {format(msg.timestamp, 'h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isAILoading && (
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
                    <div ref={aiMessagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-white/10 bg-[#0d0d0f]">
                <div className="flex gap-2">
                  <Textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask AI to edit your PRD..."
                    className="min-h-[60px] max-h-[120px] text-xs resize-none"
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
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            </div>
          )}

          {/* Inline Comment Panel */}
          <CommentPanel
            isOpen={commentPanelOpen}
            onClose={() => setCommentPanelOpen(false)}
            blockId={activeCommentBlockId}
            comments={blockComments}
            onAddComment={handleAddComment}
            onResolveComment={handleResolveComment}
            onUnresolveComment={handleUnresolveComment}
            onDeleteComment={handleDeleteComment}
            onAddReply={handleAddReply}
            onToggleReaction={handleToggleReaction}
          />

          {/* Version History Panel */}
          {showVersionHistory && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#0d0d0f] border-l border-white/10 shadow-lg z-20">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span className="font-medium text-sm">Version History</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowVersionHistory(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-48px)]">
                <div className="p-2 space-y-1">
                  {versionHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No history yet. Changes will appear here.
                    </p>
                  ) : (
                    versionHistory.slice().reverse().map((version, idx) => {
                      const actualIdx = versionHistory.length - 1 - idx;
                      return (
                        <button
                          key={version.id}
                          onClick={() => {
                            setContent(version.content);
                            setCurrentVersionIndex(actualIdx);
                            toast.success(`Restored: ${version.description}`);
                          }}
                          className={cn(
                            "w-full text-left p-2 rounded text-xs hover:bg-white/5 transition-colors",
                            actualIdx === currentVersionIndex && "bg-primary/10 border border-primary/30"
                          )}
                        >
                          <p className="font-medium truncate">{version.description}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">
                            {format(version.timestamp, 'MMM d, h:mm a')}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </AppLayout >
  );
}
