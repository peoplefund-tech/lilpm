import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { IssueList, IssueBoard, GanttChart, CreateIssueModal } from '@/components/issues';
import { IssueFilters, type IssueFiltersState } from '@/components/issues/IssueFilters';
import { PresenceAvatars } from '@/components/collaboration';
import { useIssueStore } from '@/stores/issueStore';
import { useTeamStore } from '@/stores/teamStore';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import type { Issue, IssueStatus } from '@/types';

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
    setViewPreferences,
  } = useIssueStore();
  
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState<IssueStatus>('backlog');
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

  // Client-side filtering for unassigned and no-project
  const filteredIssues = issues.filter(issue => {
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
            {/* Presence Avatars - Hidden on mobile */}
            <div className="hidden sm:block">
              <PresenceAvatars />
            </div>

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
            <GanttChart issues={filteredIssues} />
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
    </AppLayout>
  );
}
