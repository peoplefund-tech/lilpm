import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { prdService, type PRDWithRelations } from '@/lib/services/prdService';
import { BlockEditor } from '@/components/editor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Share2,
  Download,
  Copy,
  Sparkles,
  Check,
  Pencil,
  Eye,
  Clock,
  Users,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

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
                  <DropdownMenuItem onClick={() => navigate('/lily')}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Issues with AI
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

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
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
                <Button variant="outline" onClick={() => navigate('/lily')} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate Issues from PRD
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
