import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { prdService, type PRDWithRelations } from '@/features/prd';
import { projectService } from '@/lib/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Sparkles,
  Check,
  Clock,
  Archive,
  Eye,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  Filter,
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Project } from '@/types/database';

type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';
type ViewMode = 'grid' | 'list';
type SortOption = 'updated' | 'created' | 'title' | 'status';

const statusConfig: Record<PRDStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: <Pencil className="h-3 w-3" /> },
  review: { label: 'In Review', color: 'bg-yellow-500/20 text-yellow-600', icon: <Eye className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-600', icon: <Check className="h-3 w-3" /> },
  archived: { label: 'Archived', color: 'bg-gray-500/20 text-gray-600', icon: <Archive className="h-3 w-3" /> },
};

export function PRDPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTeam } = useTeamStore();

  const [prds, setPrds] = useState<PRDWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPRDTitle, setNewPRDTitle] = useState('');
  const [newPRDOverview, setNewPRDOverview] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // View preferences with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('prdViewMode') as ViewMode) || 'list'
  );
  const [sortBy, setSortBy] = useState<SortOption>(() =>
    (localStorage.getItem('prdSortBy') as SortOption) || 'updated'
  );
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<PRDStatus | 'all'>('all');

  // Persist view preferences
  useEffect(() => {
    localStorage.setItem('prdViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('prdSortBy', sortBy);
  }, [sortBy]);

  const loadPRDs = async () => {
    if (!currentTeam) return;

    setIsLoading(true);
    try {
      const [prdData, projectData] = await Promise.all([
        prdService.getPRDs(currentTeam.id),
        projectService.getProjects(currentTeam.id)
      ]);
      setPrds(prdData);
      setProjects(projectData);
    } catch (error) {
      console.error('Failed to load PRDs:', error);
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPRDs();
  }, [currentTeam?.id]);

  const handleCreatePRD = async () => {
    if (!currentTeam || !newPRDTitle.trim()) return;

    setIsCreating(true);
    try {
      const prd = await prdService.createPRD(currentTeam.id, {
        title: newPRDTitle.trim(),
        overview: newPRDOverview.trim() || undefined,
      });

      toast.success(t('prd.created', 'PRD created'));
      setCreateDialogOpen(false);
      setNewPRDTitle('');
      setNewPRDOverview('');

      // Navigate to the new PRD
      navigate(`/prd/${prd.id}`);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePRD = async (prdId: string) => {
    try {
      await prdService.deletePRD(prdId);
      toast.success(t('prd.deleted', 'PRD deleted'));
      loadPRDs();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleStatusChange = async (prdId: string, status: PRDStatus) => {
    try {
      await prdService.updateStatus(prdId, status);
      toast.success(t('prd.statusUpdated', 'Status updated'));
      loadPRDs();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  // Filter and sort PRDs
  const filteredPRDs = prds
    .filter(prd => {
      const matchesSearch = prd.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prd.overview?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = filterProject === 'all' || prd.project_id === filterProject;
      const matchesStatus = filterStatus === 'all' || prd.status === filterStatus;
      return matchesSearch && matchesProject && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('prd.title', 'PRD Documents')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('prd.description', 'Product Requirements Documents for your team')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/lily')}
            >
              <Sparkles className="h-4 w-4" />
              {t('prd.generateWithAI', 'Generate with AI')}
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('prd.create', 'New PRD')}
            </Button>
          </div>
        </div>

        {/* Toolbar: Search, Filters, View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('prd.searchPlaceholder', 'Search PRDs...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            {/* Project Filter */}
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[150px]">
                <Folder className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as PRDStatus | 'all')}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[130px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last Updated</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* PRD List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPRDs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">
                {searchQuery
                  ? t('prd.noResults', 'No PRDs found')
                  : t('prd.noPRDs', 'No PRD documents yet')
                }
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                {t('prd.emptyDescription', 'Create a PRD to define product requirements, or use AI to generate one from a conversation.')}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/lily')}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('prd.generateWithAI', 'Generate with AI')}
                </Button>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('prd.create', 'New PRD')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Project</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                  <th className="px-4 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPRDs.map((prd) => (
                  <tr
                    key={prd.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/prd/${prd.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{prd.title}</div>
                      {prd.overview && (
                        <div className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {prd.overview}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {prd.project ? (
                        <span className="text-sm">📁 {prd.project.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={`${statusConfig[prd.status as PRDStatus]?.color} gap-1`}
                      >
                        {statusConfig[prd.status as PRDStatus]?.icon}
                        {statusConfig[prd.status as PRDStatus]?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {format(new Date(prd.updated_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'review')}>
                            <Eye className="h-4 w-4 mr-2" />
                            Mark as Review
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'approved')}>
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'archived')}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeletePRD(prd.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card/Grid View */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPRDs.map((prd) => (
              <Card
                key={prd.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/prd/${prd.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{prd.title}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'review')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Mark as Review
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'approved')}>
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(prd.id, 'archived')}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeletePRD(prd.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {prd.overview && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {prd.overview}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className={`${statusConfig[prd.status as PRDStatus]?.color} gap-1`}
                    >
                      {statusConfig[prd.status as PRDStatus]?.icon}
                      {statusConfig[prd.status as PRDStatus]?.label}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(prd.updated_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {prd.project && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      📁 {prd.project.name}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create PRD Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('prd.create', 'New PRD')}</DialogTitle>
              <DialogDescription>
                {t('prd.createDescription', 'Create a new Product Requirements Document')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('prd.prdTitle', 'Title')}</label>
                <Input
                  value={newPRDTitle}
                  onChange={(e) => setNewPRDTitle(e.target.value)}
                  placeholder={t('prd.titlePlaceholder', 'e.g. User Authentication System')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('prd.overview', 'Overview')} ({t('common.optional', 'optional')})</label>
                <Textarea
                  value={newPRDOverview}
                  onChange={(e) => setNewPRDOverview(e.target.value)}
                  placeholder={t('prd.overviewPlaceholder', 'Brief description of this PRD...')}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleCreatePRD} disabled={!newPRDTitle.trim() || isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('common.create')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
