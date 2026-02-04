import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { useIssueStore } from '@/stores/issueStore';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import { issueService, commentService, activityService } from '@/lib/services/issueService';
import { teamMemberService } from '@/lib/services/teamService';
import { BlockEditor } from '@/components/editor';
import { IssueFocusIndicator, EditingIndicator, TypingIndicator } from '@/components/collaboration';
import { useIssueFocus, useRealtimeIssueUpdates } from '@/hooks/useRealtimeCollaboration';
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
  Trash2,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import type { Issue, IssueStatus, IssuePriority, CommentWithUser, ActivityWithUser, Profile, IssueType } from '@/types/database';
import { StatusIcon, PriorityIcon } from '@/components/issues/IssueIcons';
import { IssueTypeIcon, issueTypeConfig, allIssueTypes } from '@/components/issues/IssueTypeIcon';

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

  // Track focus for collaboration
  useIssueFocus(issueId || null);

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

  useEffect(() => {
    loadIssue();
    loadCommentsAndActivities();
    loadMembers();
  }, [loadIssue, loadCommentsAndActivities, loadMembers]);

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!issue) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
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
          <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border px-3 sm:px-6 py-3">
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
                <IssueTypeIcon type={issueType} />
                <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                  {issue.identifier}
                </span>
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
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile Properties Panel */}
          {showMobileProperties && (
            <div className="lg:hidden p-4 border-b border-border bg-muted/30 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('issues.status')}</label>
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
                <label className="text-xs font-medium text-muted-foreground">{t('issues.priority')}</label>
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
          <div className="p-4 sm:p-6 max-w-3xl">
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
                    {isSavingTitle && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {titleSaved && <Check className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
              ) : (
                <h1 
                  className="text-2xl font-semibold cursor-text hover:bg-muted/50 rounded px-1 py-1 -mx-1 transition-colors"
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
                <div className="relative border border-border rounded-lg bg-background shadow-sm">
                  <div className="absolute right-3 top-3 flex items-center gap-2 z-10">
                    {isSavingDescription && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {descriptionSaved && <Check className="h-4 w-4 text-green-500" />}
                    <Button 
                      variant="ghost" 
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
                  <div className="min-h-[400px] max-h-[70vh] overflow-y-auto p-4">
                    <BlockEditor
                      content={editDescription || ''}
                      onChange={(content) => handleDescriptionChange(content)}
                      placeholder={t('issues.addDescription', 'Add a description... Type "/" for commands')}
                      editable={true}
                      autoFocus={true}
                    />
                  </div>
                </div>
              ) : issue.description ? (
                <div 
                  className="cursor-text hover:bg-muted/30 rounded-lg px-3 py-3 -mx-2 transition-colors border border-transparent hover:border-border"
                  onClick={() => {
                    setIsEditingDescription(true);
                    setCollabIsEditing(true);
                  }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground
                    [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1
                    [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm
                    [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded
                    [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg
                    [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3
                  ">
                    <div dangerouslySetInnerHTML={{ __html: issue.description }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsEditingDescription(true);
                    setCollabIsEditing(true);
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg px-3 py-4 -mx-2 transition-colors w-full text-left border border-dashed border-border/50 hover:border-border"
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
                <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
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
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                        {comment.user_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
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
                      <span className="text-muted-foreground ml-1">
                        {t(`activity.${activity.type}`, activity.type)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {t('issues.noActivityLog')}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sidebar - Properties (Desktop only) */}
        <div className="hidden lg:block w-72 border-l border-border p-4 space-y-6 overflow-y-auto">
          {/* Issue Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.type', 'Type')}</label>
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.status')}</label>
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.priority')}</label>
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.assignee')}</label>
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
                    <span className="text-muted-foreground">{t('issues.unassigned')}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">{t('issues.unassigned')}</span>
                </SelectItem>
                {members.map((member) => (
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.startDate', 'Start Date')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !(issue as any).start_date && "text-muted-foreground"
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.dueDate')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !issue.due_date && "text-muted-foreground"
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
            <label className="text-xs font-medium text-muted-foreground uppercase">{t('issues.estimate')}</label>
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
                    <span className="text-muted-foreground">{t('issues.noEstimate')}</span>
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

          <Separator />

          {/* Metadata */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('issues.created')}</span>
              <span>{format(new Date(issue.created_at), 'MMM d, yyyy', { locale: dateLocale })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('issues.updated')}</span>
              <span>{formatDistanceToNow(new Date(issue.updated_at), { addSuffix: true, locale: dateLocale })}</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
