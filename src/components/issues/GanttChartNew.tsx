import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  differenceInDays,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  parseISO,
  isValid,
  addDays,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut, Layers, User, Folder, GripVertical, Plus } from 'lucide-react';
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

interface GanttCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
}

interface GanttChartProps {
  issues: Issue[];
  cycles?: GanttCycle[];
  onIssueClick?: (issue: Issue) => void;
  onIssueUpdate?: (issueId: string, updates: { dueDate?: string; startDate?: string; sortOrder?: number }) => void;
  onDependencyCreate?: (fromIssueId: string, toIssueId: string) => void;
  onCycleCreate?: (startDate: string, endDate: string, name: string) => void;
}

interface DragState {
  issueId: string | null;
  mode: 'move' | 'resize-start' | 'resize-end' | 'link' | null;
  startX: number;
  startDate: Date | null;
  endDate: Date | null;
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

// Sortable Issue Row Component
function SortableIssueRow({ issue, index, isDragging }: { issue: Issue; index: number; isDragging: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-10 px-3 flex items-center gap-2 border-b border-border/50 cursor-grab active:cursor-grabbing select-none bg-background",
        "transition-all duration-200",
        (isDragging || isSortableDragging) && "opacity-50 scale-95 z-50"
      )}
      {...attributes}
    >
      <div {...listeners} className="flex items-center gap-2 flex-1">
        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground flex-shrink-0" />
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
    </div>
  );
}

export function GanttChart({ issues, cycles = [], onIssueClick, onIssueUpdate, onDependencyCreate, onCycleCreate }: GanttChartProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = i18n.language === 'ko' ? ko : enUS;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // Drag state for bar resizing/moving
  const [dragState, setDragState] = useState<DragState>({
    issueId: null,
    mode: null,
    startX: 0,
    startDate: null,
    endDate: null,
  });
  const [dragDelta, setDragDelta] = useState(0);
  const [snappedDelta, setSnappedDelta] = useState(0);
  
  // Dependency linking state
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkingFromPos, setLinkingFromPos] = useState<{ x: number; y: number } | null>(null);
  const [linkingFromSide, setLinkingFromSide] = useState<'left' | 'right'>('right');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [hoverTarget, setHoverTarget] = useState<{ issueId: string; side: 'left' | 'right' } | null>(null);
  
  // DnD-Kit sensors for row reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);

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
        end = endOfWeek(addMonths(currentDate, 0), { locale: dateLocale });
        break;
      case 'week':
        start = startOfWeek(subMonths(currentDate, 1), { locale: dateLocale });
        end = endOfWeek(addMonths(currentDate, 2), { locale: dateLocale });
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
    
    const days = eachDayOfInterval({ start, end });
    
    return { start, end, days };
  }, [currentDate, viewMode, dateLocale]);

  const totalWidth = dateRange.days.length * cellWidth;

  // Sort issues by sortOrder
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
      return orderA - orderB;
    });
  }, [issues]);

  // Group issues
  const groupedIssues = useMemo((): GroupedIssues[] => {
    if (groupBy === 'none') {
      return [{
        key: 'all',
        label: 'All Issues',
        issues: sortedIssues,
        isCollapsed: false,
      }];
    }
    
    // Group by selected criterion
    const groups = new Map<string, Issue[]>();
    
    sortedIssues.forEach(issue => {
      let key: string;
      let label: string;
      
      switch (groupBy) {
        case 'status':
          key = issue.status;
          label = t(`status.${issue.status}`);
          break;
        case 'project':
          key = issue.projectId;
          label = issue.projectId; // Would need project name lookup
          break;
        case 'assignee':
          key = issue.assigneeId || 'unassigned';
          label = issue.assigneeId || t('common.unassigned');
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
    
    return Array.from(groups.entries()).map(([key, issues]) => ({
      key,
      label: key,
      issues,
      isCollapsed: collapsedGroups.has(key),
    }));
  }, [sortedIssues, groupBy, collapsedGroups, t]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && onIssueUpdate) {
      const oldIndex = sortedIssues.findIndex(i => i.id === active.id);
      const newIndex = sortedIssues.findIndex(i => i.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Calculate new sort order
        const targetIssue = sortedIssues[newIndex];
        const prevIssue = newIndex > 0 ? sortedIssues[newIndex - 1] : null;
        const nextIssue = newIndex < sortedIssues.length - 1 ? sortedIssues[newIndex + 1] : null;
        
        let newSortOrder: number;
        const targetSort = targetIssue.sortOrder !== undefined ? targetIssue.sortOrder : newIndex * 1000;
        
        if (oldIndex < newIndex) {
          // Moving down - place after target
          const nextSort = nextIssue?.sortOrder !== undefined ? nextIssue.sortOrder : targetSort + 1000;
          newSortOrder = (targetSort + nextSort) / 2;
        } else {
          // Moving up - place before target
          const prevSort = prevIssue?.sortOrder !== undefined ? prevIssue.sortOrder : targetSort - 1000;
          newSortOrder = (prevSort + targetSort) / 2;
        }
        
        console.log(`Moving issue ${active.id} to position ${newIndex}, sortOrder: ${newSortOrder}`);
        onIssueUpdate(active.id as string, { sortOrder: newSortOrder });
      }
    }
    
    setActiveId(null);
  };

  const getBarPosition = useCallback((issue: Issue) => {
    const dueDate = issue.dueDate ? parseISO(issue.dueDate) : null;
    const issueStartDate = (issue as any).startDate || (issue as any).start_date;
    const startDate = issueStartDate ? parseISO(issueStartDate) : parseISO(issue.createdAt);
    const endDate = dueDate && isValid(dueDate) ? dueDate : addDays(startDate, 3);
    
    const startIndex = differenceInDays(startDate, dateRange.start);
    const endIndex = differenceInDays(endDate, dateRange.start);
    const totalDays = dateRange.days.length;
    
    const left = Math.max(0, startIndex * cellWidth);
    const width = Math.max(cellWidth, (endIndex - startIndex + 1) * cellWidth);
    
    const isVisible = endIndex >= 0 && startIndex < totalDays;
    
    return {
      left: `${left}px`,
      width: `${Math.min(width, (totalDays - Math.max(0, startIndex)) * cellWidth)}px`,
      isVisible,
      hasDueDate: !!dueDate && isValid(dueDate),
      hasStartDate: !!issueStartDate,
    };
  }, [dateRange, cellWidth]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      backlog: 'bg-slate-400 hover:bg-slate-500',
      todo: 'bg-slate-500 hover:bg-slate-600',
      in_progress: 'bg-blue-500 hover:bg-blue-600',
      in_review: 'bg-amber-500 hover:bg-amber-600',
      done: 'bg-emerald-500 hover:bg-emerald-600',
    };
    return colors[status] || colors.todo;
  };

  // Handle bar mouse down for resizing/moving
  const handleBarMouseDown = useCallback((e: React.MouseEvent, issue: Issue, mode: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    
    const issueStartDateStr = (issue as any).startDate || (issue as any).start_date;
    const startDate = issueStartDateStr ? parseISO(issueStartDateStr) : parseISO(issue.createdAt);
    const endDate = issue.dueDate ? parseISO(issue.dueDate) : addDays(startDate, 3);
    
    setDragState({
      issueId: issue.id,
      mode,
      startX: e.clientX,
      startDate,
      endDate,
    });
    setDragDelta(0);
    setSnappedDelta(0);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (linkingFrom) {
      setMousePosition({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (!dragState.issueId || !dragState.mode) return;
    
    const deltaX = e.clientX - dragState.startX;
    setDragDelta(deltaX);
    
    const snappedDays = Math.round(deltaX / cellWidth);
    setSnappedDelta(snappedDays * cellWidth);
  }, [dragState, linkingFrom, cellWidth]);

  const handleMouseUp = useCallback(() => {
    if (linkingFrom && hoverTarget) {
      setDependencies(prev => [...prev, { from: linkingFrom, to: hoverTarget.issueId }]);
      onDependencyCreate?.(linkingFrom, hoverTarget.issueId);
    }
    
    if (linkingFrom) {
      setLinkingFrom(null);
      setLinkingFromPos(null);
      setLinkingFromSide('right');
      setHoverTarget(null);
    }
    
    if (dragState.issueId && dragState.mode && snappedDelta !== 0) {
      const daysDelta = Math.round(snappedDelta / cellWidth);
      
      if (daysDelta !== 0 && dragState.startDate && dragState.endDate) {
        if (dragState.mode === 'move') {
          const newStartDate = addDays(dragState.startDate, daysDelta);
          const newEndDate = addDays(dragState.endDate, daysDelta);
          onIssueUpdate?.(dragState.issueId, {
            startDate: format(newStartDate, 'yyyy-MM-dd'),
            dueDate: format(newEndDate, 'yyyy-MM-dd'),
          });
        } else if (dragState.mode === 'resize-end') {
          const newEndDate = addDays(dragState.endDate, daysDelta);
          if (newEndDate >= dragState.startDate) {
            onIssueUpdate?.(dragState.issueId, { dueDate: format(newEndDate, 'yyyy-MM-dd') });
          }
        } else if (dragState.mode === 'resize-start') {
          const newStartDate = addDays(dragState.startDate, daysDelta);
          if (newStartDate <= dragState.endDate) {
            onIssueUpdate?.(dragState.issueId, { startDate: format(newStartDate, 'yyyy-MM-dd') });
          }
        }
      }
    }
    
    setDragDelta(0);
    setSnappedDelta(0);
    setDragState({
      issueId: null,
      mode: null,
      startX: 0,
      startDate: null,
      endDate: null,
    });
  }, [linkingFrom, hoverTarget, dragState, snappedDelta, cellWidth, onIssueUpdate, onDependencyCreate]);

  const handleStartLinking = useCallback((e: React.MouseEvent, issueId: string, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setLinkingFrom(issueId);
    setLinkingFromSide(side);
    
    const barElement = (e.currentTarget as HTMLElement).closest('[data-bar-id]') as HTMLElement;
    if (barElement) {
      const rect = barElement.getBoundingClientRect();
      setLinkingFromPos({
        x: side === 'right' ? rect.right : rect.left,
        y: rect.top + rect.height / 2,
      });
    }
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLinkPointEnter = useCallback((issueId: string, side: 'left' | 'right') => {
    if (linkingFrom && linkingFrom !== issueId) {
      setHoverTarget({ issueId, side });
    }
  }, [linkingFrom]);

  const handleLinkPointLeave = useCallback(() => {
    setHoverTarget(null);
  }, []);

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

  const handleIssueClick = (issue: Issue) => {
    onIssueClick?.(issue);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-background border border-border/50 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar - Notion-style */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-white dark:bg-muted/20">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            <Calendar className="h-4 w-4 mr-2" />
            {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="h-4 w-4 mr-2" />
                {t(`gantt.view.${viewMode}`)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setViewMode('day')}>
                {t('gantt.view.day')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('week')}>
                {t('gantt.view.week')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('month')}>
                {t('gantt.view.month')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('quarter')}>
                {t('gantt.view.quarter')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onCycleCreate && (
            <Button variant="outline" size="sm" onClick={() => {}}>
              <Plus className="h-4 w-4 mr-2" />
              {t('gantt.newCycle', 'New Cycle')}
            </Button>
          )}
        </div>
      </div>

      {/* Gantt Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border bg-muted/10 flex flex-col overflow-hidden">
          <div className="h-16 px-3 flex items-center border-b border-border font-medium text-sm">
            {t('gantt.taskName', 'Task Name')}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedIssues.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedIssues.map((issue, index) => (
                  <SortableIssueRow
                    key={issue.id}
                    issue={issue}
                    index={index}
                    isDragging={activeId === issue.id}
                  />
                ))}
              </SortableContext>
              
              <DragOverlay>
                {activeId ? (
                  <div className="h-10 px-3 flex items-center gap-2 bg-card border border-primary rounded shadow-lg">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {sortedIssues.find(i => i.id === activeId)?.title}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        {/* Timeline */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto">
          <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
            {/* Timeline Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border h-16">
              <div className="h-full flex">
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

            {/* Issue Bars */}
            <div className="relative">
              {sortedIssues.map((issue, issueIndex) => {
                const barPos = getBarPosition(issue);
                const isDragging = dragState.issueId === issue.id;
                const isLinkingFromThis = linkingFrom === issue.id;
                const isLinkTarget = hoverTarget?.issueId === issue.id;
                
                const baseLeft = parseFloat(barPos.left);
                const baseWidth = parseFloat(barPos.width);
                
                const snappedLeft = isDragging && (dragState.mode === 'move' || dragState.mode === 'resize-start')
                  ? baseLeft + snappedDelta : baseLeft;
                const snappedWidth = isDragging && (dragState.mode === 'resize-end' || dragState.mode === 'resize-start')
                  ? (dragState.mode === 'resize-end'
                      ? Math.max(cellWidth, baseWidth + snappedDelta)
                      : Math.max(cellWidth, baseWidth - snappedDelta))
                  : baseWidth;
                
                const visualLeft = isDragging && (dragState.mode === 'move' || dragState.mode === 'resize-start')
                  ? baseLeft + dragDelta : baseLeft;
                const visualWidth = isDragging && (dragState.mode === 'resize-end' || dragState.mode === 'resize-start')
                  ? (dragState.mode === 'resize-end'
                      ? Math.max(cellWidth, baseWidth + dragDelta)
                      : Math.max(cellWidth, baseWidth - dragDelta))
                  : baseWidth;

                return (
                  <div
                    key={issue.id}
                    className="h-10 relative border-b border-border/30"
                  >
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
                      <>
                        {/* Ghost bar */}
                        {isDragging && (snappedDelta !== 0 || dragDelta !== 0) && (
                          <div
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 h-6 rounded border-2 border-dashed pointer-events-none z-20",
                              getStatusColor(issue.status)
                            )}
                            style={{
                              left: `${snappedLeft}px`,
                              width: `${snappedWidth}px`,
                              opacity: 0.4,
                            }}
                          />
                        )}

                        {/* Main bar */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              data-bar-id={issue.id}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 h-6 rounded shadow-sm group/bar select-none",
                                getStatusColor(issue.status),
                                !barPos.hasDueDate && "border-2 border-dashed border-white/30",
                                isDragging && "z-30 cursor-grabbing shadow-lg",
                                !isDragging && "transition-all cursor-grab",
                                isLinkingFromThis && "ring-2 ring-yellow-400 z-30",
                                isLinkTarget && "ring-2 ring-green-400 z-30 scale-105"
                              )}
                              style={{
                                left: `${visualLeft}px`,
                                width: `${visualWidth}px`,
                                minWidth: '60px',
                                opacity: isDragging ? 0.7 : (barPos.hasDueDate ? 1 : 0.6),
                              }}
                              onMouseDown={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeX = e.clientX - rect.left;
                                const isOnLeftHandle = relativeX < 16;
                                const isOnRightHandle = relativeX > rect.width - 16;
                                
                                if (!isOnLeftHandle && !isOnRightHandle) {
                                  handleBarMouseDown(e, issue, 'move');
                                }
                              }}
                              onDoubleClick={() => handleIssueClick(issue)}
                            >
                              {/* Left resize handle */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 hover:bg-white/40 rounded-l flex items-center justify-center z-30 transition-all"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleBarMouseDown(e, issue, 'resize-start');
                                }}
                                title="Drag to resize start date"
                              >
                                <div className="w-0.5 h-3 bg-white/80 rounded" />
                              </div>

                              {/* Bar content */}
                              <div className="h-full flex items-center px-3 overflow-hidden pointer-events-none">
                                <StatusIcon status={issue.status} className="h-3 w-3 mr-1.5 flex-shrink-0 text-white" />
                                <span className="text-[10px] text-white font-medium truncate">
                                  {issue.identifier}
                                </span>
                              </div>

                              {/* Right resize handle */}
                              <div
                                className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 hover:bg-white/40 rounded-r flex items-center justify-center z-30 transition-all"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleBarMouseDown(e, issue, 'resize-end');
                                }}
                                title="Drag to resize end date"
                              >
                                <div className="w-0.5 h-3 bg-white/80 rounded" />
                              </div>

                              {/* Link points */}
                              <div
                                data-link-point="left"
                                data-issue-id={issue.id}
                                className={cn(
                                  "absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white/90 cursor-crosshair z-40 transition-all",
                                  linkingFrom
                                    ? (isLinkTarget && hoverTarget?.side === 'left'
                                        ? "opacity-100 bg-green-500 scale-[2] border-green-300 shadow-lg shadow-green-500/50"
                                        : "opacity-100 bg-amber-500")
                                    : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-150 hover:bg-amber-400"
                                )}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleStartLinking(e, issue.id, 'left');
                                }}
                                onMouseEnter={() => handleLinkPointEnter(issue.id, 'left')}
                                onMouseLeave={handleLinkPointLeave}
                              />
                              <div
                                data-link-point="right"
                                data-issue-id={issue.id}
                                className={cn(
                                  "absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white/90 cursor-crosshair z-40 transition-all",
                                  linkingFrom
                                    ? (isLinkTarget && hoverTarget?.side === 'right'
                                        ? "opacity-100 bg-green-500 scale-[2] border-green-300 shadow-lg shadow-green-500/50"
                                        : "opacity-100 bg-amber-500")
                                    : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-150 hover:bg-amber-400"
                                )}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleStartLinking(e, issue.id, 'right');
                                }}
                                onMouseEnter={() => handleLinkPointEnter(issue.id, 'right')}
                                onMouseLeave={handleLinkPointLeave}
                              />
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
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                );
              })}
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

      {/* Dependency Lines SVG */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-[15]"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker
            id="arrowhead-gantt"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
          </marker>
          <marker
            id="arrowhead-snap-gantt"
            markerWidth="10"
            markerHeight="8"
            refX="9"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 4, 0 8" fill="#22c55e" />
          </marker>
        </defs>

        {/* Linking line while dragging */}
        {linkingFrom && linkingFromPos && (
          (() => {
            const fromX = linkingFromPos.x;
            const fromY = linkingFromPos.y;
            
            let toX = mousePosition.x;
            let toY = mousePosition.y;
            let isSnapped = false;
            
            if (hoverTarget) {
              const targetIssue = sortedIssues.find(i => i.id === hoverTarget.issueId);
              if (targetIssue) {
                const targetPos = getBarPosition(targetIssue);
                const targetIdx = sortedIssues.findIndex(i => i.id === hoverTarget.issueId);
                const sidebarWidth = 288;
                const headerHeight = 64;
                const rowHeight = 40;
                
                toX = sidebarWidth + parseFloat(targetPos.left) + (hoverTarget.side === 'right' ? parseFloat(targetPos.width) : 0);
                toY = headerHeight + (targetIdx * rowHeight) + (rowHeight / 2);
                isSnapped = true;
              }
            }
            
            const horizontalDist = Math.abs(toX - fromX);
            const verticalDist = Math.abs(toY - fromY);
            const distance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);
            const cpOffset = Math.min(Math.max(distance / 3, 30), 100);
            
            let pathD: string;
            const direction = linkingFromSide === 'right' ? 1 : -1;
            
            if ((toX - fromX) * direction > 20) {
              const cp1x = fromX + (direction * cpOffset);
              const cp1y = fromY;
              const cp2x = toX - (direction * cpOffset);
              const cp2y = toY;
              pathD = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
            } else {
              const loopOffset = Math.max(cpOffset, 60);
              const midY = (fromY + toY) / 2;
              pathD = `M ${fromX} ${fromY}
                       C ${fromX + (direction * loopOffset)} ${fromY},
                         ${fromX + (direction * loopOffset)} ${midY},
                         ${(fromX + toX) / 2} ${midY}
                       S ${toX - (direction * loopOffset)} ${toY},
                         ${toX} ${toY}`;
            }
            
            return (
              <g>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSnapped ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"}
                  strokeWidth={isSnapped ? 8 : 6}
                  strokeLinecap="round"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSnapped ? "#22c55e" : "#f59e0b"}
                  strokeWidth={isSnapped ? 2.5 : 2}
                  opacity={isSnapped ? 1 : 0.8}
                  strokeDasharray={isSnapped ? "none" : "8,4"}
                  strokeLinecap="round"
                  markerEnd={isSnapped ? "url(#arrowhead-snap-gantt)" : "url(#arrowhead-gantt)"}
                />
                {!isSnapped && (
                  <circle cx={toX} cy={toY} r="4" fill="#f59e0b" opacity="0.8">
                    <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })()
        )}
      </svg>
    </div>
  );
}

