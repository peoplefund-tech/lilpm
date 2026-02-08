import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { IssueList, IssueBoard, GanttChart, CreateIssueModal } from '@/components/issues';
import { IssueFilters, type IssueFiltersState } from '@/components/issues/IssueFilters';
import { BulkArchiveDialog } from '@/components/issues/BulkArchiveDialog';
import { useIssueStore } from '@/stores/issueStore';
import { useTeamStore } from '@/stores/teamStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  SortAsc,
  LayoutList,
  Kanban,
  GanttChartSquare,
  ChevronDown,
  Zap,
  Archive,
  CheckSquare,
  X,
} from 'lucide-react';
import type { Issue, IssueStatus } from '@/types';

type SprintView = 'active' | 'backlog' | 'all';

export function IssuesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { currentTeam } = useTeamStore();
  const {
    issues,
    isLoading,
    viewPreferences,
    loadIssues,
    createIssue,
    updateIssue,
    archiveIssues,
    setViewPreferences,
    createDependency,
    deleteDependency,
  } = useIssueStore();

  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState<IssueStatus>('backlog');
  const [sprintView, setSprintView] = useState<SprintView>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [filters, setFilters] = useState<IssueFiltersState>({
    status: [],
    priority: [],
    assigneeId: [],
    projectId: [],
    search: '',
  });

  // Handle URL parameter for view mode
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'gantt') {
      setViewPreferences({ layout: 'gantt' });
    }
  }, [searchParams, setViewPreferences]);

  useEffect(() => {
    if (currentTeam) {
      loadIssues(currentTeam.id, {
        status: filters.status.length > 0 ? filters.status : undefined,
        priority: filters.priority.length > 0 ? filters.priority : undefined,
        assigneeId: filters.assigneeId.filter(a => a !== 'unassigned').length > 0
          ? filters.assigneeId.filter(a => a !== 'unassigned')
          : undefined,
        projectId: filters.projectId.filter(p => p !== 'no-project').length > 0
          ? filters.projectId.filter(p => p !== 'no-project')
          : undefined,
      });
    }
  }, [currentTeam, loadIssues, filters]);

  // Client-side filtering for unassigned, no-project, and sprint view
  const filteredIssues = issues.filter(issue => {
    // Sprint view filter
    if (sprintView === 'active' && !issue.cycleId) {
      return false; // Only show issues with a sprint
    }
    if (sprintView === 'backlog' && issue.cycleId) {
      return false; // Only show issues without a sprint
    }

    if (filters.assigneeId.includes('unassigned') && issue.assigneeId) {
      return false;
    }
    if (filters.projectId.includes('no-project') && issue.projectId) {
      return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        issue.title.toLowerCase().includes(search) ||
        issue.identifier.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Count for badges
  const activeSprintCount = issues.filter(i => i.cycleId).length;
  const backlogCount = issues.filter(i => !i.cycleId).length;

  const handleSelectIssue = (issueId: string, selected: boolean) => {
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(issueId);
      } else {
        next.delete(issueId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIssues(new Set(filteredIssues.map((i) => i.id)));
    } else {
      setSelectedIssues(new Set());
    }
  };

  const handleCreateIssue = async (data: Partial<Issue>) => {
    if (currentTeam) {
      await createIssue(currentTeam.id, data);
    }
  };

  const handleOpenCreateModal = (status?: IssueStatus) => {
    setInitialStatus(status || 'backlog');
    setCreateModalOpen(true);
  };

  const handleStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    await updateIssue(issueId, { status: newStatus });
  };

  const handleBulkArchive = async () => {
    try {
      await archiveIssues(Array.from(selectedIssues));
      toast.success(t('issues.archivedBulk', {
        count: selectedIssues.size,
        defaultValue: `${selectedIssues.size} issue(s) archived`,
      }));
      setSelectedIssues(new Set());
      setSelectionMode(false);
    } catch (error) {
      toast.error(t('issues.archiveFailed', 'Failed to archive issues'));
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedIssues(new Set());
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Toolbar - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 border-b border-border bg-background gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* View Toggle */}
            <Tabs
              value={viewPreferences.layout}
              onValueChange={(v) => setViewPreferences({ layout: v as 'list' | 'board' | 'gantt' })}
            >
              <TabsList className="h-8">
                <TabsTrigger value="list" className="h-6 px-2" title={t('issues.listView', 'List View')}>
                  <LayoutList className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger value="board" className="h-6 px-2" title={t('issues.boardView', 'Board View')}>
                  <Kanban className="h-3.5 w-3.5" />
                </TabsTrigger>
                <TabsTrigger value="gantt" className="h-6 px-2" title={t('issues.ganttView', 'Gantt Chart')}>
                  <GanttChartSquare className="h-3.5 w-3.5" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Sprint View Toggle - Jira-style Active Sprint / Backlog */}
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/30">
              <button
                onClick={() => setSprintView('all')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${sprintView === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {t('issues.allIssues', 'All')}
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {issues.length}
                </Badge>
              </button>
              <button
                onClick={() => setSprintView('active')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${sprintView === 'active'
                  ? 'bg-green-500/10 text-green-600 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Zap className="h-3 w-3" />
                {t('issues.activeSprint', 'Active Sprint')}
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-green-500/20 text-green-600">
                  {activeSprintCount}
                </Badge>
              </button>
              <button
                onClick={() => setSprintView('backlog')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${sprintView === 'backlog'
                  ? 'bg-slate-500/10 text-slate-600 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Archive className="h-3 w-3" />
                {t('issues.backlog', 'Backlog')}
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {backlogCount}
                </Badge>
              </button>
            </div>

            {/* Filters */}
            <IssueFilters filters={filters} onFiltersChange={setFilters} />

            {/* Group By - Hidden on mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 hidden sm:flex">
                  {t('issues.groupBy')}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setViewPreferences({ groupBy: 'status' })}>
                  {t('issues.groupByStatus')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewPreferences({ groupBy: 'priority' })}>
                  {t('issues.groupByPriority')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewPreferences({ groupBy: 'assignee' })}>
                  {t('issues.groupByAssignee')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewPreferences({ groupBy: 'none' })}>
                  {t('issues.noGrouping')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort - Hidden on mobile */}
            <Button variant="ghost" size="sm" className="h-8 gap-1 hidden sm:flex">
              <SortAsc className="h-3.5 w-3.5" />
              {t('issues.sort')}
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
            {/* Selection Mode Toggle */}
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1"
              onClick={toggleSelectionMode}
            >
              {selectionMode ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  {t('common.cancel', 'Cancel')}
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  {t('issues.selectMode', 'Select')}
                </>
              )}
            </Button>

            {/* Bulk Actions - Show when in selection mode */}
            {selectionMode && selectedIssues.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setBulkArchiveOpen(true)}
              >
                <Archive className="h-3.5 w-3.5" />
                {t('issues.archiveSelected', 'Archive')} ({selectedIssues.size})
              </Button>
            )}

            {/* Select All - Show when in selection mode */}
            {selectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => handleSelectAll(selectedIssues.size !== filteredIssues.length)}
              >
                {selectedIssues.size === filteredIssues.length
                  ? t('issues.deselectAll', 'Deselect All')
                  : t('issues.selectAll', 'Select All')}
              </Button>
            )}

            {/* Create Issue */}
            <Button size="sm" className="h-8 gap-1 flex-1 sm:flex-none" onClick={() => handleOpenCreateModal()}>
              <Plus className="h-3.5 w-3.5" />
              <span className="sm:inline">{t('issues.newIssue')}</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : viewPreferences.layout === 'board' ? (
            <IssueBoard
              issues={filteredIssues}
              onStatusChange={handleStatusChange}
              onCreateIssue={handleOpenCreateModal}
            />
          ) : viewPreferences.layout === 'gantt' ? (
            <GanttChart
              issues={filteredIssues}
              onIssueUpdate={async (issueId, updates) => {
                await updateIssue(issueId, updates);
              }}
              onDependencyCreate={createDependency}
              onDependencyDelete={deleteDependency}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <IssueList
                issues={filteredIssues}
                groupBy={viewPreferences.groupBy}
                selectedIssues={selectedIssues}
                onSelectIssue={handleSelectIssue}
                onSelectAll={handleSelectAll}
                onCreateIssue={handleOpenCreateModal}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Issue Modal */}
      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        initialStatus={initialStatus}
        onSubmit={handleCreateIssue}
      />

      {/* Bulk Archive Dialog */}
      <BulkArchiveDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        issueCount={selectedIssues.size}
        retentionDays={30}
        onConfirm={handleBulkArchive}
      />
    </AppLayout>
  );
}
