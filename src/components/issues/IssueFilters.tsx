import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Filter,
  X,
  Search,
  Circle,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
  ChevronDown,
  User,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IssueStatus, IssuePriority, Profile, Project } from '@/types/database';
import { teamMemberService, type TeamMemberWithProfile } from '@/lib/services/teamService';
import { projectService } from '@/lib/services/projectService';
import { useTeamStore } from '@/stores/teamStore';

export interface IssueFiltersState {
  status: IssueStatus[];
  priority: IssuePriority[];
  assigneeId: string[];
  projectId: string[];
  search: string;
}

interface IssueFiltersProps {
  filters: IssueFiltersState;
  onFiltersChange: (filters: IssueFiltersState) => void;
}

const STATUS_OPTIONS: { value: IssueStatus; icon: React.ElementType; color: string }[] = [
  { value: 'backlog', icon: Circle, color: 'text-muted-foreground' },
  { value: 'todo', icon: Circle, color: 'text-blue-500' },
  { value: 'in_progress', icon: Clock, color: 'text-yellow-500' },
  { value: 'in_review', icon: AlertCircle, color: 'text-purple-500' },
  { value: 'blocked', icon: XCircle, color: 'text-orange-500' },
  { value: 'done', icon: CheckCircle2, color: 'text-green-500' },
  { value: 'cancelled', icon: XCircle, color: 'text-red-500' },
];

const PRIORITY_OPTIONS: { value: IssuePriority; color: string }[] = [
  { value: 'urgent', color: 'text-red-500' },
  { value: 'high', color: 'text-orange-500' },
  { value: 'medium', color: 'text-yellow-500' },
  { value: 'low', color: 'text-blue-500' },
  { value: 'none', color: 'text-muted-foreground' },
];

export function IssueFilters({ filters, onFiltersChange }: IssueFiltersProps) {
  const { t } = useTranslation();
  const { currentTeam } = useTeamStore();
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState(filters.search);

  // Load members and projects
  useEffect(() => {
    if (currentTeam?.id) {
      teamMemberService.getMembers(currentTeam.id).then(setMembers).catch(console.error);
      projectService.getProjects(currentTeam.id).then(setProjects).catch(console.error);
    }
  }, [currentTeam?.id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        onFiltersChange({ ...filters, search: searchQuery });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const toggleStatus = (status: IssueStatus) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatus });
  };

  const togglePriority = (priority: IssuePriority) => {
    const newPriority = filters.priority.includes(priority)
      ? filters.priority.filter(p => p !== priority)
      : [...filters.priority, priority];
    onFiltersChange({ ...filters, priority: newPriority });
  };

  const toggleAssignee = (assigneeId: string) => {
    const newAssignee = filters.assigneeId.includes(assigneeId)
      ? filters.assigneeId.filter(a => a !== assigneeId)
      : [...filters.assigneeId, assigneeId];
    onFiltersChange({ ...filters, assigneeId: newAssignee });
  };

  const toggleProject = (projectId: string) => {
    const newProject = filters.projectId.includes(projectId)
      ? filters.projectId.filter(p => p !== projectId)
      : [...filters.projectId, projectId];
    onFiltersChange({ ...filters, projectId: newProject });
  };

  const clearFilters = () => {
    setSearchQuery('');
    onFiltersChange({
      status: [],
      priority: [],
      assigneeId: [],
      projectId: [],
      search: '',
    });
  };

  const activeFilterCount =
    filters.status.length +
    filters.priority.length +
    filters.assigneeId.length +
    filters.projectId.length +
    (filters.search ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('issues.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-48 pl-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Filter Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Filter className="h-3.5 w-3.5" />
            {t('issues.filter')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-medium text-sm">{t('issues.filters')}</span>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={clearFilters}
              >
                {t('issues.clearFilters')}
              </Button>
            )}
          </div>

          <ScrollArea className="h-[320px]">
            <div className="p-3 space-y-4">
              {/* Status Filter */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Circle className="h-3.5 w-3.5" />
                  {t('issues.status')}
                </div>
                <div className="space-y-1">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.status.includes(option.value)}
                          onCheckedChange={() => toggleStatus(option.value)}
                        />
                        <Icon className={cn("h-3.5 w-3.5", option.color)} />
                        <span className="text-sm">{t(`status.${option.value}`)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Priority Filter */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t('issues.priority')}
                </div>
                <div className="space-y-1">
                  {PRIORITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.priority.includes(option.value)}
                        onCheckedChange={() => togglePriority(option.value)}
                      />
                      <Minus className={cn("h-3.5 w-3.5", option.color)} />
                      <span className="text-sm">{t(`priority.${option.value}`)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Assignee Filter */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <User className="h-3.5 w-3.5" />
                  {t('issues.assignee')}
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={filters.assigneeId.includes('unassigned')}
                      onCheckedChange={() => toggleAssignee('unassigned')}
                    />
                    <span className="text-sm text-muted-foreground">{t('issues.unassigned')}</span>
                  </label>
                  {members.map((member) => (
                    <label
                      key={member.user_id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.assigneeId.includes(member.user_id)}
                        onCheckedChange={() => toggleAssignee(member.user_id)}
                      />
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                        {member.profile?.name?.charAt(0) || member.profile?.email?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm truncate">
                        {member.profile?.name || member.profile?.email || 'Unknown'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Project Filter */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Folder className="h-3.5 w-3.5" />
                  {t('issues.project')}
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={filters.projectId.includes('no-project')}
                      onCheckedChange={() => toggleProject('no-project')}
                    />
                    <span className="text-sm text-muted-foreground">{t('issues.noProject')}</span>
                  </label>
                  {projects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.projectId.includes(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-sm truncate">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.status.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="h-6 gap-1 cursor-pointer"
              onClick={() => toggleStatus(status)}
            >
              {t(`status.${status}`)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.priority.map((priority) => (
            <Badge
              key={priority}
              variant="secondary"
              className="h-6 gap-1 cursor-pointer"
              onClick={() => togglePriority(priority)}
            >
              {t(`priority.${priority}`)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.assigneeId.map((assignee) => {
            const member = members.find(m => m.user_id === assignee);
            return (
              <Badge
                key={assignee}
                variant="secondary"
                className="h-6 gap-1 cursor-pointer"
                onClick={() => toggleAssignee(assignee)}
              >
                {assignee === 'unassigned' ? t('issues.unassigned') : member?.profile?.name || assignee}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.projectId.map((projectId) => {
            const project = projects.find(p => p.id === projectId);
            return (
              <Badge
                key={projectId}
                variant="secondary"
                className="h-6 gap-1 cursor-pointer"
                onClick={() => toggleProject(projectId)}
              >
                {projectId === 'no-project' ? t('issues.noProject') : project?.name || projectId}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
