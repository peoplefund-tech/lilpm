import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  differenceInDays,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  parseISO,
  isValid,
  addDays,
  subDays,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut, Layers, User, Folder, GripVertical, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { StatusIcon, PriorityIcon } from './IssueIcons';
import { IssueTypeIcon } from './IssueTypeIcon';
import type { Issue } from '@/types';

interface GanttChartProps {
  issues: Issue[];
  onIssueClick?: (issue: Issue) => void;
  onIssueUpdate?: (issueId: string, updates: { dueDate?: string; startDate?: string }) => void;
  onDependencyCreate?: (fromIssueId: string, toIssueId: string) => void;
}

interface DragState {
  issueId: string | null;
  mode: 'move' | 'resize-start' | 'resize-end' | 'link' | null;
  startX: number;
  originalDueDate: string | null;
  originalCreatedAt: string | null;
}

interface Dependency {
  from: string;
  to: string;
}

type ViewMode = 'day' | 'week' | 'month' | 'quarter';
type GroupBy = 'none' | 'project' | 'assignee' | 'status';

interface GroupedIssues {
  key: string;
  label: string;
  issues: Issue[];
  isCollapsed: boolean;
}

export function GanttChart({ issues, onIssueClick, onIssueUpdate, onDependencyCreate }: GanttChartProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = i18n.language === 'ko' ? ko : enUS;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    issueId: null,
    mode: null,
    startX: 0,
    originalDueDate: null,
    originalCreatedAt: null,
  });
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  
  // Calculate the cell width based on view mode
  const cellWidth = useMemo(() => {
    switch (viewMode) {
      case 'day': return 60;
      case 'week': return 40;
      case 'month': return 32;
      case 'quarter': return 20;
      default: return 32;
    }
  }, [viewMode]);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    let start: Date, end: Date;
    
    switch (viewMode) {
      case 'day':
        start = startOfWeek(currentDate, { locale: dateLocale });
        end = endOfWeek(addWeeks(currentDate, 1), { locale: dateLocale });
        break;
      case 'week':
        start = startOfWeek(subWeeks(currentDate, 1), { locale: dateLocale });
        end = endOfWeek(addWeeks(currentDate, 5), { locale: dateLocale });
        break;
      case 'month':
        start = startOfMonth(subMonths(currentDate, 1));
        end = endOfMonth(addMonths(currentDate, 2));
        break;
      case 'quarter':
        start = startOfMonth(subMonths(currentDate, 2));
        end = endOfMonth(addMonths(currentDate, 4));
        break;
      default:
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
    }
    
    return { 
      start, 
      end, 
      days: eachDayOfInterval({ start, end })
    };
  }, [currentDate, viewMode, dateLocale]);

  // Group issues based on groupBy setting
  const groupedIssues = useMemo((): GroupedIssues[] => {
    // Filter issues that have at least a due date
    const issuesWithDates = issues.filter(issue => issue.dueDate || issue.createdAt);

    if (groupBy === 'none') {
      return [{
        key: 'all',
        label: t('gantt.allIssues', 'All Issues'),
        issues: issuesWithDates.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.createdAt);
          const dateB = new Date(b.dueDate || b.createdAt);
          return dateA.getTime() - dateB.getTime();
        }),
        isCollapsed: false,
      }];
    }

    const groups = new Map<string, Issue[]>();
    
    issuesWithDates.forEach(issue => {
      let key: string;
      let label: string;
      
      switch (groupBy) {
        case 'project':
          key = issue.projectId || 'no-project';
          label = key === 'no-project' ? t('gantt.noProject', 'No Project') : `Project ${key.slice(0, 8)}`;
          break;
        case 'assignee':
          key = issue.assigneeId || 'unassigned';
          label = key === 'unassigned' ? t('gantt.unassigned', 'Unassigned') : `User ${key.slice(0, 8)}`;
          break;
        case 'status':
          key = issue.status;
          label = t(`status.${issue.status}`);
          break;
        default:
          key = 'all';
          label = 'All';
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(issue);
    });

    return Array.from(groups.entries()).map(([key, groupIssues]) => ({
      key,
      label: groupBy === 'status' ? t(`status.${key}`) : 
             groupBy === 'project' && key === 'no-project' ? t('gantt.noProject', 'No Project') :
             groupBy === 'assignee' && key === 'unassigned' ? t('gantt.unassigned', 'Unassigned') :
             key.slice(0, 12),
      issues: groupIssues.sort((a, b) => {
        const dateA = new Date(a.dueDate || a.createdAt);
        const dateB = new Date(b.dueDate || b.createdAt);
        return dateA.getTime() - dateB.getTime();
      }),
      isCollapsed: collapsedGroups.has(key),
    }));
  }, [issues, groupBy, collapsedGroups, t]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handlePrevious = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 2));
        break;
      case 'month':
      case 'quarter':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 2));
        break;
      case 'month':
      case 'quarter':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    // Scroll to today
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const todayIndex = dateRange.days.findIndex(d => isToday(d));
        if (todayIndex > -1) {
          scrollContainerRef.current.scrollLeft = Math.max(0, todayIndex * cellWidth - 200);
        }
      }
    }, 100);
  };

  // Drag handlers
  const handleBarMouseDown = useCallback((e: React.MouseEvent, issue: Issue, mode: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      issueId: issue.id,
      mode,
      startX: e.clientX,
      originalDueDate: issue.dueDate || null,
      originalCreatedAt: issue.createdAt,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.issueId || !dragState.mode) return;
    
    if (linkingFrom) {
      setMousePosition({ x: e.clientX, y: e.clientY });
      return;
    }
    
    const deltaX = e.clientX - dragState.startX;
    const daysDelta = Math.round(deltaX / cellWidth);
    
    if (daysDelta === 0) return;
    
    const issue = issues.find(i => i.id === dragState.issueId);
    if (!issue) return;
    
    const originalDueDate = dragState.originalDueDate 
      ? parseISO(dragState.originalDueDate) 
      : addDays(parseISO(dragState.originalCreatedAt!), 3);
    
    if (dragState.mode === 'move') {
      const newDueDate = addDays(originalDueDate, daysDelta);
      onIssueUpdate?.(issue.id, { dueDate: format(newDueDate, 'yyyy-MM-dd') });
    } else if (dragState.mode === 'resize-end') {
      const newDueDate = addDays(originalDueDate, daysDelta);
      onIssueUpdate?.(issue.id, { dueDate: format(newDueDate, 'yyyy-MM-dd') });
    }
  }, [dragState, cellWidth, issues, onIssueUpdate, linkingFrom]);

  const handleMouseUp = useCallback(() => {
    if (linkingFrom) {
      setLinkingFrom(null);
    }
    setDragState({
      issueId: null,
      mode: null,
      startX: 0,
      originalDueDate: null,
      originalCreatedAt: null,
    });
  }, [linkingFrom]);

  const handleStartLinking = useCallback((e: React.MouseEvent, issueId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLinkingFrom(issueId);
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleBarMouseEnter = useCallback((issueId: string) => {
    if (linkingFrom && linkingFrom !== issueId) {
      // Create dependency
      setDependencies(prev => [...prev, { from: linkingFrom, to: issueId }]);
      onDependencyCreate?.(linkingFrom, issueId);
      setLinkingFrom(null);
    }
  }, [linkingFrom, onDependencyCreate]);

  // Add global mouse event listeners
  useEffect(() => {
    if (dragState.issueId || linkingFrom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.issueId, linkingFrom, handleMouseMove, handleMouseUp]);

  const getBarPosition = useCallback((issue: Issue) => {
    const dueDate = issue.dueDate ? parseISO(issue.dueDate) : null;
    const createdDate = parseISO(issue.createdAt);
    
    // Use created date as start if no explicit start date
    const startDate = createdDate;
    // Use due date as end, or created date + 3 days if no due date
    const endDate = dueDate && isValid(dueDate) ? dueDate : addDays(createdDate, 3);
    
    const startIndex = differenceInDays(startDate, dateRange.start);
    const endIndex = differenceInDays(endDate, dateRange.start);
    const totalDays = dateRange.days.length;
    
    // Calculate position
    const left = Math.max(0, startIndex * cellWidth);
    const width = Math.max(cellWidth, (endIndex - startIndex + 1) * cellWidth);
    
    const isVisible = endIndex >= 0 && startIndex < totalDays;
    
    return {
      left: `${left}px`,
      width: `${Math.min(width, (totalDays - Math.max(0, startIndex)) * cellWidth)}px`,
      isVisible,
      hasDueDate: !!dueDate && isValid(dueDate),
    };
  }, [dateRange, cellWidth]);

  const getStatusColor = (status: Issue['status']) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500 hover:bg-emerald-600';
      case 'in_progress':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'in_review':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'todo':
        return 'bg-slate-500 hover:bg-slate-600';
      case 'cancelled':
        return 'bg-red-500/70 hover:bg-red-600/70';
      default:
        return 'bg-slate-400 hover:bg-slate-500';
    }
  };

  const handleIssueClick = (issue: Issue) => {
    if (onIssueClick) {
      onIssueClick(issue);
    } else {
      navigate(`/issue/${issue.id}`);
    }
  };

  const totalWidth = dateRange.days.length * cellWidth;

  // Get week/month markers for header
  const getHeaderMarkers = () => {
    const markers: { date: Date; label: string; span: number }[] = [];
    let currentMonth = '';
    let currentSpan = 0;
    let startIndex = 0;

    dateRange.days.forEach((day, index) => {
      const monthKey = format(day, 'yyyy-MM');
      if (monthKey !== currentMonth) {
        if (currentMonth) {
          markers.push({
            date: dateRange.days[startIndex],
            label: format(dateRange.days[startIndex], 'MMMM yyyy', { locale: dateLocale }),
            span: currentSpan,
          });
        }
        currentMonth = monthKey;
        currentSpan = 1;
        startIndex = index;
      } else {
        currentSpan++;
      }
    });
    
    // Push last month
    if (currentSpan > 0) {
      markers.push({
        date: dateRange.days[startIndex],
        label: format(dateRange.days[startIndex], 'MMMM yyyy', { locale: dateLocale }),
        span: currentSpan,
      });
    }

    return markers;
  };

  const totalIssuesWithDates = groupedIssues.reduce((sum, g) => sum + g.issues.length, 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleToday}>
            {t('gantt.today', 'Today')}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-3 text-base font-semibold">
            {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Group By */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Layers className="h-3.5 w-3.5" />
                {t('gantt.groupBy', 'Group')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setGroupBy('none')}>
                {groupBy === 'none' && '✓ '}{t('gantt.noGrouping', 'No Grouping')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy('project')}>
                <Folder className="h-4 w-4 mr-2" />
                {groupBy === 'project' && '✓ '}{t('gantt.byProject', 'By Project')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy('assignee')}>
                <User className="h-4 w-4 mr-2" />
                {groupBy === 'assignee' && '✓ '}{t('gantt.byAssignee', 'By Assignee')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy('status')}>
                {groupBy === 'status' && '✓ '}{t('gantt.byStatus', 'By Status')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoom Level */}
          <div className="flex items-center border border-border rounded-md">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-r-none"
              onClick={() => {
                const modes: ViewMode[] = ['day', 'week', 'month', 'quarter'];
                const currentIndex = modes.indexOf(viewMode);
                if (currentIndex > 0) setViewMode(modes[currentIndex - 1]);
              }}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs font-medium min-w-[60px] text-center border-x border-border">
              {t(`gantt.${viewMode}`, viewMode)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-l-none"
              onClick={() => {
                const modes: ViewMode[] = ['day', 'week', 'month', 'quarter'];
                const currentIndex = modes.indexOf(viewMode);
                if (currentIndex < modes.length - 1) setViewMode(modes[currentIndex + 1]);
              }}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Fixed Issue Column */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-background z-10">
          {/* Column Header */}
          <div className="h-16 border-b border-border px-3 flex items-end pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t('gantt.issues', 'Issues')} ({totalIssuesWithDates})
            </span>
          </div>
          
          {/* Issue List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {totalIssuesWithDates === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <div className="text-center px-4">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">{t('gantt.noIssues', 'No issues with dates')}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {t('gantt.addDueDates', 'Add due dates to see issues here')}
                  </p>
                </div>
              </div>
            ) : (
              groupedIssues.map((group) => (
                <div key={group.key}>
                  {/* Group Header */}
                  {groupBy !== 'none' && (
                    <div 
                      className="h-8 px-3 flex items-center gap-2 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        !group.isCollapsed && "rotate-90"
                      )} />
                      <span className="text-xs font-medium truncate">{group.label}</span>
                      <span className="text-xs text-muted-foreground">({group.issues.length})</span>
                    </div>
                  )}
                  
                  {/* Group Issues */}
                  {!group.isCollapsed && group.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="h-10 px-3 flex items-center gap-2 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleIssueClick(issue)}
                    >
                      <IssueTypeIcon type={(issue as any).type || 'task'} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" title={issue.title}>
                          {issue.title}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                        {issue.identifier}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
            {/* Timeline Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border">
              {/* Month Row */}
              <div className="h-8 flex border-b border-border/50">
                {getHeaderMarkers().map((marker, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center text-xs font-medium border-r border-border/30"
                    style={{ width: `${marker.span * cellWidth}px` }}
                  >
                    {marker.label}
                  </div>
                ))}
              </div>
              
              {/* Days Row */}
              <div className="h-8 flex">
                {dateRange.days.map((day, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col items-center justify-center border-r border-border/30",
                      isToday(day) && "bg-primary/10",
                      !isSameMonth(day, currentDate) && "text-muted-foreground/50"
                    )}
                    style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                  >
                    <span className={cn(
                      "text-[10px] font-medium",
                      isToday(day) && "text-primary font-bold"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {viewMode !== 'quarter' && (
                      <span className="text-[9px] text-muted-foreground">
                        {format(day, 'EEE', { locale: dateLocale })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows */}
            <div>
              {groupedIssues.map((group) => (
                <div key={group.key}>
                  {/* Group Header Row */}
                  {groupBy !== 'none' && (
                    <div className="h-8 bg-muted/50 border-b border-border relative">
                      <div className="absolute inset-0 flex">
                        {dateRange.days.map((day, index) => (
                          <div
                            key={index}
                            className={cn(
                              "border-r border-border/20",
                              isToday(day) && "bg-primary/5"
                            )}
                            style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Issue Rows */}
                  {!group.isCollapsed && group.issues.map((issue) => {
                    const barPos = getBarPosition(issue);
                    
                    return (
                      <div key={issue.id} className="h-10 relative border-b border-border/30">
                        {/* Grid Background */}
                        <div className="absolute inset-0 flex">
                          {dateRange.days.map((day, index) => (
                            <div
                              key={index}
                              className={cn(
                                "border-r border-border/20",
                                isToday(day) && "bg-primary/5"
                              )}
                              style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                            />
                          ))}
                        </div>
                        
                        {/* Issue Bar */}
                        {barPos.isVisible && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute top-1/2 -translate-y-1/2 h-6 rounded transition-all shadow-sm group/bar",
                                  getStatusColor(issue.status),
                                  !barPos.hasDueDate && "opacity-60 border-2 border-dashed border-white/30",
                                  dragState.issueId === issue.id && "ring-2 ring-white ring-opacity-50 z-30",
                                  linkingFrom === issue.id && "ring-2 ring-yellow-400 z-30"
                                )}
                                style={{ 
                                  left: barPos.left, 
                                  width: barPos.width,
                                  minWidth: '60px',
                                  cursor: dragState.mode ? 'grabbing' : 'grab',
                                }}
                                onMouseDown={(e) => handleBarMouseDown(e, issue, 'move')}
                                onMouseEnter={() => handleBarMouseEnter(issue.id)}
                                onDoubleClick={() => handleIssueClick(issue)}
                              >
                                {/* Left resize handle */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 rounded-l flex items-center justify-center"
                                  onMouseDown={(e) => handleBarMouseDown(e, issue, 'resize-start')}
                                >
                                  <GripVertical className="h-3 w-3 text-white/70" />
                                </div>
                                
                                {/* Bar content */}
                                <div className="h-full flex items-center px-3 overflow-hidden">
                                  <StatusIcon status={issue.status} className="h-3 w-3 mr-1.5 flex-shrink-0 text-white" />
                                  <span className="text-[10px] text-white font-medium truncate">
                                    {issue.identifier}
                                  </span>
                                </div>
                                
                                {/* Right resize handle */}
                                <div 
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 rounded-r flex items-center justify-center"
                                  onMouseDown={(e) => handleBarMouseDown(e, issue, 'resize-end')}
                                >
                                  <GripVertical className="h-3 w-3 text-white/70" />
                                </div>
                                
                                {/* Link points */}
                                <div 
                                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-yellow-400 border-2 border-white opacity-0 group-hover/bar:opacity-100 cursor-crosshair flex items-center justify-center"
                                  onMouseDown={(e) => handleStartLinking(e, issue.id)}
                                >
                                  <Link2 className="h-2 w-2 text-yellow-900" />
                                </div>
                                <div 
                                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-yellow-400 border-2 border-white opacity-0 group-hover/bar:opacity-100 cursor-crosshair flex items-center justify-center"
                                  onMouseDown={(e) => handleStartLinking(e, issue.id)}
                                >
                                  <Link2 className="h-2 w-2 text-yellow-900" />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium text-sm">{issue.title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{issue.identifier}</span>
                                  <span>•</span>
                                  <span>{t(`status.${issue.status}`)}</span>
                                </div>
                                {issue.dueDate && (
                                  <p className="text-xs">
                                    {t('issues.dueDate')}: {format(parseISO(issue.dueDate), 'PPP', { locale: dateLocale })}
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {t('gantt.dragToMove', 'Drag to move • Double-click to view')}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Today Line */}
            {dateRange.days.some(d => isToday(d)) && (
              <div 
                className="absolute top-16 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ 
                  left: `${(dateRange.days.findIndex(d => isToday(d)) * cellWidth) + cellWidth / 2}px` 
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dependency Lines - SVG Overlay */}
      <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-[15]"
        style={{ overflow: 'visible' }}
      >
        {dependencies.map((dep, index) => {
          const fromIssue = issues.find(i => i.id === dep.from);
          const toIssue = issues.find(i => i.id === dep.to);
          if (!fromIssue || !toIssue) return null;
          
          // Calculate positions - simplified for now
          const fromPos = getBarPosition(fromIssue);
          const toPos = getBarPosition(toIssue);
          
          // Get row indices
          let fromRowIndex = 0;
          let toRowIndex = 0;
          let currentRow = 0;
          for (const group of groupedIssues) {
            for (const issue of group.issues) {
              if (issue.id === dep.from) fromRowIndex = currentRow;
              if (issue.id === dep.to) toRowIndex = currentRow;
              currentRow++;
            }
          }
          
          // Calculate actual pixel positions
          const sidebarWidth = 288; // w-72 = 288px
          const headerHeight = 56 + 64; // Toolbar + Timeline header
          const rowHeight = 40;
          
          const fromX = sidebarWidth + parseFloat(fromPos.left) + parseFloat(fromPos.width);
          const fromY = headerHeight + (fromRowIndex * rowHeight) + (rowHeight / 2);
          const toX = sidebarWidth + parseFloat(toPos.left);
          const toY = headerHeight + (toRowIndex * rowHeight) + (rowHeight / 2);
          
          // Draw curved line
          const midX = (fromX + toX) / 2;
          
          return (
            <g key={`dep-${index}`} className="pointer-events-auto">
              <path
                d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="5,3"
                className="cursor-pointer hover:stroke-red-500 transition-colors"
                onClick={() => {
                  // Remove dependency
                  setDependencies(prev => prev.filter((_, i) => i !== index));
                }}
              />
              {/* Arrow head */}
              <polygon
                points={`${toX},${toY} ${toX - 8},${toY - 4} ${toX - 8},${toY + 4}`}
                fill="#f59e0b"
                className="hover:fill-red-500 transition-colors"
              />
            </g>
          );
        })}
        
        {/* Linking line while dragging */}
        {linkingFrom && mousePosition.x > 0 && (
          <line
            x1={288 + parseFloat(getBarPosition(issues.find(i => i.id === linkingFrom)!)?.left || '0') + parseFloat(getBarPosition(issues.find(i => i.id === linkingFrom)!)?.width || '0')}
            y1={120 + groupedIssues.flatMap(g => g.issues).findIndex(i => i.id === linkingFrom) * 40 + 20}
            x2={mousePosition.x}
            y2={mousePosition.y}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="5,3"
          />
        )}
      </svg>

      {/* Footer Legend */}
      <div className="border-t border-border px-4 py-2 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">{t('gantt.legend', 'Legend')}:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-400" />
              <span>{t('status.backlog')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-500" />
              <span>{t('status.todo')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>{t('status.in_progress')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>{t('status.in_review')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>{t('status.done')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-8 h-3 rounded bg-slate-400/60 border-2 border-dashed border-white/30" />
            <span>{t('gantt.noDueDate', 'No due date')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
