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
import { ChevronLeft, ChevronRight, Calendar, GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { StatusIcon } from './IssueIcons';
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
  mode: 'move' | 'resize-start' | 'resize-end' | null;
  startX: number;
  startDate: Date | null;
  endDate: Date | null;
}

// Sortable Issue Row Component with Notion-style design
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
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-9 px-2 flex items-center gap-1.5 border-b border-gray-200/60 dark:border-gray-700/60 cursor-pointer select-none",
        "transition-all duration-200 ease-out",
        "hover:bg-gray-50/50 dark:hover:bg-gray-800/30",
        (isDragging || isSortableDragging) && "opacity-40 scale-[0.98] bg-blue-50/50 dark:bg-blue-900/20 shadow-sm"
      )}
      {...attributes}
    >
      <div {...listeners} className="flex items-center gap-1.5 flex-1 min-w-0 py-1">
        <GripVertical className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <IssueTypeIcon type={(issue as any).type || 'task'} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] truncate text-gray-900 dark:text-gray-100 font-medium" title={issue.title}>
            {issue.title}
          </p>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono flex-shrink-0">
          {issue.identifier}
        </span>
      </div>
    </div>
  );
}

// Wrapper for the timeline bar to enable vertical sorting
function SortableIssueBar({ issue, children }: { issue: Issue; children: React.ReactNode }) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative z-10", isDragging && "z-50 opacity-80")}
    >
      {children}
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

  // Notion uses 32px per day for optimal viewing
  const cellWidth = 32;

  // Calculate date range - show 2 months (current + next)
  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(addMonths(currentDate, 1));
    const days = eachDayOfInterval({ start, end });

    return { start, end, days };
  }, [currentDate, dateLocale]);

  const totalWidth = dateRange.days.length * cellWidth;

  // Sort issues by sortOrder
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
      return orderA - orderB;
    });
  }, [issues]);

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

        onIssueUpdate(active.id as string, { sortOrder: newSortOrder });
      }
    }

    setActiveId(null);
  };

  const getBarPosition = useCallback((issue: Issue) => {
    const dueDate = issue.dueDate ? parseISO(issue.dueDate) : null;
    const issueStartDate = (issue as any).startDate || (issue as any).start_date;
    const startDate = issueStartDate ? parseISO(issueStartDate) : parseISO(issue.createdAt);
    const endDate = dueDate && isValid(dueDate) ? dueDate : addDays(startDate, 2);

    const startIndex = differenceInDays(startDate, dateRange.start);
    const endIndex = differenceInDays(endDate, dateRange.start);
    const totalDays = dateRange.days.length;

    const left = Math.max(0, startIndex * cellWidth);
    const width = Math.max(cellWidth, (endIndex - startIndex + 1) * cellWidth);

    // Fallback styling logic
    const isFallbackDate = !dueDate || !isValid(dueDate);

    const isVisible = endIndex >= 0 && startIndex < totalDays;

    return {
      left: `${left}px`,
      width: `${Math.min(width, (totalDays - Math.max(0, startIndex)) * cellWidth)}px`,
      isVisible,
      hasDueDate: !isFallbackDate,
    };
  }, [dateRange, cellWidth]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      backlog: 'bg-gray-400/90 hover:bg-gray-500/90 border-gray-400/20',
      todo: 'bg-gray-500/90 hover:bg-gray-600/90 border-gray-500/20',
      in_progress: 'bg-blue-500/90 hover:bg-blue-600/90 border-blue-500/20',
      in_review: 'bg-amber-500/90 hover:bg-amber-600/90 border-amber-500/20',
      done: 'bg-emerald-500/90 hover:bg-emerald-600/90 border-emerald-500/20',
    };
    return colors[status] || colors.todo;
  };

  // Handle bar mouse down for resizing/moving
  const handleBarMouseDown = useCallback((e: React.MouseEvent, issue: Issue, mode: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();

    const issueStartDateStr = (issue as any).startDate || (issue as any).start_date;
    const startDate = issueStartDateStr ? parseISO(issueStartDateStr) : parseISO(issue.createdAt);
    const endDate = issue.dueDate ? parseISO(issue.dueDate) : addDays(startDate, 2);

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
          // Resize constraint: End date cannot be before start date
          if (newEndDate >= dragState.startDate) {
            onIssueUpdate?.(dragState.issueId, { dueDate: format(newEndDate, 'yyyy-MM-dd') });
          }
        } else if (dragState.mode === 'resize-start') {
          const newStartDate = addDays(dragState.startDate, daysDelta);
          // Resize constraint: Start date cannot be after end date
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
    <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar - Notion-style minimal design */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[13px] font-medium"
            onClick={() => setCurrentDate(new Date())}
          >
            {format(currentDate, 'MMM yyyy', { locale: dateLocale })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {onCycleCreate && (
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[13px]" onClick={() => { }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Cycle
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
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
            {/* Sidebar - Notion-style */}
            <div className="w-64 border-r border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900 flex flex-col overflow-hidden z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
              <div className="h-10 px-2 flex items-center border-b border-gray-200/60 dark:border-gray-700/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Task
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">

                {sortedIssues.map((issue, index) => (
                  <SortableIssueRow
                    key={issue.id}
                    issue={issue}
                    index={index}
                    isDragging={activeId === issue.id}
                  />
                ))}
              </div>
            </div>

            {/* Timeline - Notion-style */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <div style={{ width: `${totalWidth}px`, minWidth: '100%' }} className="relative">
                {/* Timeline Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200/60 dark:border-gray-700/60 h-10">
                  <div className="h-full flex">
                    {dateRange.days.map((day, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex flex-col items-center justify-center border-r border-gray-200/40 dark:border-gray-700/40",
                          isToday(day) && "bg-blue-50/50 dark:bg-blue-900/10",
                          !isSameMonth(day, currentDate) && "bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600"
                        )}
                        style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                      >
                        <span className={cn(
                          "text-[11px] font-medium",
                          isToday(day) && "text-blue-600 dark:text-blue-400 font-semibold"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Issue Bars - Notion-style */}
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
                      <SortableIssueBar key={issue.id} issue={issue}>
                        <div
                          className="h-9 relative border-b border-gray-200/40 dark:border-gray-700/40"
                        >
                          {/* Grid Background */}
                          <div className="absolute inset-0 flex">
                            {dateRange.days.map((day, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "border-r border-gray-200/20 dark:border-gray-700/20",
                                  isToday(day) && "bg-blue-50/30 dark:bg-blue-900/5"
                                )}
                                style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                              />
                            ))}
                          </div>

                          {/* Issue Bar */}
                          {barPos.isVisible && (
                            <>
                              {/* Ghost bar - Notion-style preview */}
                              {isDragging && (snappedDelta !== 0 || dragDelta !== 0) && (
                                <div
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 h-6 rounded border-2 border-dashed pointer-events-none z-20",
                                    "border-blue-400/50 dark:border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/20"
                                  )}
                                  style={{
                                    left: `${snappedLeft}px`,
                                    width: `${snappedWidth}px`,
                                  }}
                                />
                              )}

                              {/* Main bar - Notion-style */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    data-bar-id={issue.id}
                                    className={cn(
                                      "absolute top-1/2 -translate-y-1/2 h-6 rounded border group/bar select-none",
                                      getStatusColor(issue.status),
                                      "shadow-sm hover:shadow-md",
                                      !barPos.hasDueDate && "border-2 border-dashed",
                                      isDragging && "z-30 cursor-grabbing shadow-lg scale-105",
                                      !isDragging && "transition-all duration-150 ease-out cursor-grab",
                                      isLinkingFromThis && "ring-2 ring-yellow-400/80 dark:ring-yellow-500/80 z-30",
                                      isLinkTarget && "ring-2 ring-green-400/80 dark:ring-green-500/80 z-30 scale-105"
                                    )}
                                    style={{
                                      left: `${visualLeft}px`,
                                      width: `${visualWidth}px`,
                                      minWidth: '40px',
                                      opacity: isDragging ? 0.75 : 1,
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const relativeX = e.clientX - rect.left;
                                      const isOnLeftHandle = relativeX < 12;
                                      const isOnRightHandle = relativeX > rect.width - 12;

                                      if (!isOnLeftHandle && !isOnRightHandle) {
                                        handleBarMouseDown(e, issue, 'move');
                                      }
                                    }}
                                    onDoubleClick={() => handleIssueClick(issue)}
                                  >
                                    {/* Left resize handle */}
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/20 dark:hover:bg-white/10 rounded-l flex items-center justify-center z-30 transition-opacity"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleBarMouseDown(e, issue, 'resize-start');
                                      }}
                                    >
                                      <div className="w-0.5 h-2.5 bg-white/80 rounded-full" />
                                    </div>

                                    {/* Bar content */}
                                    <div className="h-full flex items-center px-2 overflow-hidden pointer-events-none">
                                      <StatusIcon status={issue.status} className="h-3 w-3 mr-1.5 flex-shrink-0 text-white" />
                                      <span className="text-[11px] text-white font-medium truncate">
                                        {issue.identifier}
                                      </span>
                                    </div>

                                    {/* Right resize handle */}
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/20 dark:hover:bg-white/10 rounded-r flex items-center justify-center z-30 transition-opacity"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleBarMouseDown(e, issue, 'resize-end');
                                      }}
                                    >
                                      <div className="w-0.5 h-2.5 bg-white/80 rounded-full" />
                                    </div>

                                    {/* Link points - Notion-style (smaller) */}
                                    <div
                                      data-link-point="left"
                                      data-issue-id={issue.id}
                                      className={cn(
                                        "absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white cursor-crosshair z-40 transition-all duration-150",
                                        linkingFrom
                                          ? (isLinkTarget && hoverTarget?.side === 'left'
                                            ? "opacity-100 bg-green-500 scale-[2.5] border-green-300 shadow-lg"
                                            : "opacity-100 bg-amber-500")
                                          : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-[1.8]"
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
                                        "absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white cursor-crosshair z-40 transition-all duration-150",
                                        linkingFrom
                                          ? (isLinkTarget && hoverTarget?.side === 'right'
                                            ? "opacity-100 bg-green-500 scale-[2.5] border-green-300 shadow-lg"
                                            : "opacity-100 bg-amber-500")
                                          : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-[1.8]"
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
                      </SortableIssueBar>
                    );
                  })}
                </div>

                {/* Today Line - Optimized */}
                {dateRange.days.some(d => isToday(d)) && (
                  <div
                    className="absolute top-10 bottom-0 w-[2px] bg-blue-500/60 z-20 pointer-events-none"
                    style={{
                      left: `${(dateRange.days.findIndex(d => isToday(d)) * cellWidth) + (cellWidth / 2) - 1}px`
                    }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                  </div>
                )}
                {/* Dependency Lines SVG - MOVED INSIDE SCROLL CONTAINER */}
                <svg
                  className="absolute top-10 left-0 w-full h-[calc(100%-40px)] pointer-events-none z-[15]"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <marker
                      id="arrowhead-gantt-notion"
                      markerWidth="6"
                      markerHeight="5"
                      refX="5"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <polygon points="0 0, 6 2.5, 0 5" fill="#f59e0b" />
                    </marker>
                    <marker
                      id="arrowhead-snap-gantt-notion"
                      markerWidth="8"
                      markerHeight="6"
                      refX="7"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
                    </marker>
                  </defs>

                  {/* Linking line while dragging */}
                  {linkingFrom && (
                    (() => {
                      // Calculate start point relative to timeline used for linking
                      const fromIssue = sortedIssues.find(i => i.id === linkingFrom);
                      const fromIssueIndex = sortedIssues.findIndex(i => i.id === linkingFrom);

                      if (!fromIssue || fromIssueIndex === -1) return null;

                      const fromPos = getBarPosition(fromIssue);
                      const rowHeight = 36;
                      // Start Y relative to the SVG top (which is at top-10, i.e. header height)
                      const fromY = (fromIssueIndex * rowHeight) + (rowHeight / 2);

                      // Start X
                      const fromX = linkingFromSide === 'right'
                        ? parseFloat(fromPos.left) + parseFloat(fromPos.width)
                        : parseFloat(fromPos.left);

                      let toX: number;
                      let toY: number;
                      let isSnapped = false;

                      if (hoverTarget) {
                        const targetIssue = sortedIssues.find(i => i.id === hoverTarget.issueId);
                        const targetIdx = sortedIssues.findIndex(i => i.id === hoverTarget.issueId);
                        if (targetIssue) {
                          const targetPos = getBarPosition(targetIssue);
                          toX = hoverTarget.side === 'right'
                            ? parseFloat(targetPos.left) + parseFloat(targetPos.width)
                            : parseFloat(targetPos.left);
                          toY = (targetIdx * rowHeight) + (rowHeight / 2);
                          isSnapped = true;
                        } else {
                          toX = fromX;
                          toY = fromY;
                        }
                      } else {
                        // Following Mouse relative to scroll container
                        if (scrollContainerRef.current) {
                          const rect = scrollContainerRef.current.getBoundingClientRect();
                          const scrollLeft = scrollContainerRef.current.scrollLeft;

                          toX = mousePosition.x - rect.left + scrollLeft;
                          toY = mousePosition.y - rect.top - 40;
                        } else {
                          toX = fromX;
                          toY = fromY;
                        }
                      }

                      const cpOffset = 50;
                      const direction = linkingFromSide === 'right' ? 1 : -1;

                      let pathD = '';

                      if ((toX - fromX) * direction > 15) {
                        const cp1x = fromX + (direction * cpOffset);
                        const cp2x = toX - (direction * cpOffset);
                        pathD = `M ${fromX} ${fromY} C ${cp1x} ${fromY}, ${cp2x} ${toY}, ${toX} ${toY}`;
                      } else {
                        const loopOffset = 60;
                        pathD = `M ${fromX} ${fromY} 
                             C ${fromX + (direction * loopOffset)} ${fromY}, 
                               ${fromX + (direction * loopOffset)} ${toY}, 
                               ${fromX} ${toY} 
                             S ${toX - (direction * loopOffset)} ${toY}, 
                               ${toX} ${toY}`;
                      }

                      return (
                        <g>
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isSnapped ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)"}
                            strokeWidth={isSnapped ? 6 : 5}
                            strokeLinecap="round"
                          />
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isSnapped ? "#22c55e" : "#f59e0b"}
                            strokeWidth={isSnapped ? 2 : 1.5}
                            strokeDasharray={isSnapped ? "none" : "6,3"}
                            strokeLinecap="round"
                            markerEnd={isSnapped ? "url(#arrowhead-snap-gantt-notion)" : "url(#arrowhead-gantt-notion)"}
                          />
                        </g>
                      );
                    })()
                  )}
                </svg>
              </div>
            </div>

          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <div className="h-9 px-2 flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-blue-500/50 rounded shadow-lg opacity-90 w-64">
                <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                  {sortedIssues.find(i => i.id === activeId)?.title}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div >
    </div >
  );
}
