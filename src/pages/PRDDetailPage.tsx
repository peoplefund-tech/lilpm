import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { prdService, type PRDWithRelations } from '@/lib/services/prdService';
import { BlockEditor } from '@/components/editor';
import { useAutoSave } from '@/hooks/useAutoSave';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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
  
  const [prd, setPrd] = useState<PRDWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedTitle, setSavedTitle] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [savedStatus, setSavedStatus] = useState<PRDStatus>('draft');
  
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

  // Auto-save content
  const { debouncedSave: debouncedSaveContent } = useAutoSave({
    onSave: async (value) => {
      if (!prdId) return;
      try {
        await prdService.updatePRD(prdId, { content: value });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Failed to auto-save:', error);
      }
    },
    delay: 2000,
  });

  // Auto-save title
  const { debouncedSave: debouncedSaveTitle } = useAutoSave({
    onSave: async (value) => {
      if (!prdId || !value.trim()) return;
      try {
        await prdService.updatePRD(prdId, { title: value.trim() });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Failed to auto-save title:', error);
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
          // Use content if available, otherwise use overview for backwards compatibility, or template
          const initialContent = data.content || data.overview || DEFAULT_PRD_TEMPLATE;
          setContent(initialContent);
          setSavedContent(initialContent);
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

  const handleSave = async () => {
    if (!prdId || !title.trim()) return;
    
    setIsSaving(true);
    try {
      await prdService.updatePRD(prdId, {
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

  // Handle AI message send
  const handleAISend = async () => {
    if (!aiInput.trim() || isAILoading) return;
    
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: aiInput.trim(),
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAILoading(true);
    
    try {
      // Call AI to suggest PRD changes
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
If the user asks a question, answer it helpfully without the PRD_EDIT block.`
            },
            { role: 'user', content: userMessage.content }
          ],
          provider: 'anthropic',
        }),
      });
      
      const data = await response.json();
      const aiContent = data.content || data.message || '';
      
      // Parse PRD edit suggestion
      const editMatch = aiContent.match(/\[PRD_EDIT\]([\s\S]*?)\[\/PRD_EDIT\]/);
      let suggestion: AISuggestion | undefined;
      let cleanContent = aiContent;
      
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
          cleanContent = aiContent.replace(/\[PRD_EDIT\][\s\S]*?\[\/PRD_EDIT\]/, '').trim();
          cleanContent = cleanContent || `I suggest the following change: ${editData.description}`;
        } catch (e) {
          console.error('Failed to parse PRD edit:', e);
        }
      }
      
      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        suggestion,
      };
      setAiMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI request failed:', error);
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, errorMessage]);
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
              {/* Last saved indicator */}
              {lastSaved && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                </span>
              )}
              
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
              
              {/* Save button */}
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !title.trim() || !hasChanges} 
                size="sm"
                variant={hasChanges ? "default" : "secondary"}
              >
                {isSaving ? (
                  <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('common.saving', 'Saving...')}
                  </>
                ) : hasChanges ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    {t('common.saved', 'Saved')}
                  </>
                )}
              </Button>
              {lastSaved && !hasChanges && (
                <span className="text-xs text-muted-foreground ml-2">
                  {formatDistanceToNow(lastSaved, { addSuffix: true })}
                </span>
              )}
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

              {/* Block Editor */}
              <div className="min-h-[500px]">
                <BlockEditor
                  content={content}
                  onChange={handleContentChange}
                  placeholder="Start writing your PRD... Type '/' for commands"
                  editable={true}
                  autoFocus={false}
                />
              </div>

              {/* Footer actions */}
              <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Last updated {format(new Date(prd.updated_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                
                <div className="flex items-center gap-3">
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
            <div className="w-[40%] border-l border-border flex flex-col bg-muted/30">
              {/* AI Panel Header */}
              <div className="p-3 border-b border-border flex items-center justify-between bg-background">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Assistant</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowAIPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
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
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Ask AI to edit your PRD</p>
                    <p className="text-xs mt-1">Try: "Add a section about security requirements"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiMessages.map((msg) => (
                      <div key={msg.id} className={cn(
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
                          "rounded-lg px-2.5 py-1.5 text-xs max-w-[85%]",
                          msg.role === 'user' 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-background border"
                        )}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.suggestion && (
                            <div className="mt-2 pt-2 border-t border-border/50">
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
                    ))}
                    {isAILoading && (
                      <div className="flex gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                            <Bot className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-background border rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-xs text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={aiMessagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-border bg-background">
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
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            </div>
          )}

          {/* Version History Panel */}
          {showVersionHistory && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-background border-l border-border shadow-lg z-20">
              <div className="p-3 border-b border-border flex items-center justify-between">
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
                    <p className="text-xs text-muted-foreground text-center py-4">
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
                            "w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors",
                            actualIdx === currentVersionIndex && "bg-primary/10 border border-primary/30"
                          )}
                        >
                          <p className="font-medium truncate">{version.description}</p>
                          <p className="text-muted-foreground text-[10px] mt-0.5">
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
    </AppLayout>
  );
}
