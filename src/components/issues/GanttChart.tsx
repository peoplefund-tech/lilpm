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
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut, Layers, User, Folder, GripVertical, Link2, Plus, ArrowLeft, ListFilter } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { StatusIcon, PriorityIcon } from './IssueIcons';
import { IssueTypeIcon } from './IssueTypeIcon';
import type { Issue } from '@/types';
import type {
  GanttCycle,
  GanttChartProps,
  DragState,
  Dependency,
  ViewMode,
  GroupBy,
  GroupedIssues,
  DateRange,
} from './GanttChart.types';
import {
  getStatusColor,
  sortIssues,
  getBarPosition as getBarPositionFromUtils,
  getCellWidth,
  getHeaderMarkers as getHeaderMarkersFromUtils,
  calculateReorderSortOrder,
} from './GanttChart.utils';

export function GanttChart({ issues, cycles = [], onIssueClick, onIssueUpdate, onDependencyCreate, onDependencyDelete, onCycleCreate }: GanttChartProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLocale = i18n.language === 'ko' ? ko : enUS;


  // Refs for scroll sync
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Timeline
  const sidebarRef = useRef<HTMLDivElement>(null); // Sidebar
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);
  const wasDraggedRef = useRef(false); // Track if row was just dragged to prevent click-after-drag
  const hasInitialScrolled = useRef(false); // Track if initial focus on today has happened

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set()); // Jira-style filter

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    issueId: null,
    mode: null,
    startX: 0,
    startY: 0,
    originalDueDate: null,
    originalCreatedAt: null,
  });
  const [dragDelta, setDragDelta] = useState(0); // X-axis delta (Date)
  const [dragDeltaY, setDragDeltaY] = useState(0); // Y-axis delta (Row Reorder)
  const [snappedDelta, setSnappedDelta] = useState(0); // Snapped to cell boundaries
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkingFromPos, setLinkingFromPos] = useState<{ x: number; y: number } | null>(null);
  const [linkingFromSide, setLinkingFromSide] = useState<'left' | 'right'>('right');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [hoverTarget, setHoverTarget] = useState<{ issueId: string; side: 'left' | 'right' } | null>(null);

  // Track optimistically deleted dependencies to prevent resurrection from stale props
  const deletedDepKeysRef = useRef<Set<string>>(new Set());

  // Scroll Sync Effect
  useEffect(() => {
    const right = scrollContainerRef.current;
    const left = sidebarRef.current;
    if (!right || !left) return;

    const handleLeftScroll = () => {
      if (!isSyncingLeft.current) {
        isSyncingRight.current = true;
        right.scrollTop = left.scrollTop;
      }
      isSyncingLeft.current = false;
    };

    const handleRightScroll = () => {
      if (!isSyncingRight.current) {
        isSyncingLeft.current = true;
        left.scrollTop = right.scrollTop;
      }
      isSyncingRight.current = false;
    };

    left.addEventListener('scroll', handleLeftScroll);
    right.addEventListener('scroll', handleRightScroll);

    return () => {
      left.removeEventListener('scroll', handleLeftScroll);
      right.removeEventListener('scroll', handleRightScroll);
    };
  }, []); // For snapping dependency lines


  // Sync dependencies from issues (DB persistence)
  // CRITICAL FIX: Filter out optimistically deleted dependencies
  useEffect(() => {
    const serverDependencies: Dependency[] = [];
    issues.forEach(issue => {
      if (issue.blocking) {
        issue.blocking.forEach(dep => {
          const key = `${issue.id}->${dep.targetIssueId}`;
          // Skip dependencies that were optimistically deleted locally
          if (deletedDepKeysRef.current.has(key)) {
            return;
          }
          if (!serverDependencies.some(d => d.from === issue.id && d.to === dep.targetIssueId)) {
            serverDependencies.push({ from: issue.id, to: dep.targetIssueId });
          }
        });
      }
    });

    setDependencies(currentDeps => {
      // If counts match and content matches, don't update (preserves identity)
      if (currentDeps.length === serverDependencies.length &&
        currentDeps.every(c => serverDependencies.some(s => s.from === c.from && s.to === c.to))) {
        return currentDeps;
      }
      return serverDependencies;
    });
  }, [issues]);

  // ... (code omitted)
  // Removed malformed duplicate code block


  // Row reordering state - enhanced for better snapping
  const [rowDragIssueId, setRowDragIssueId] = useState<string | null>(null);
  const [rowDropTargetIndex, setRowDropTargetIndex] = useState<number | null>(null);
  const [rowDropPosition, setRowDropPosition] = useState<'above' | 'below' | null>(null);
  const [rowDragFromIndex, setRowDragFromIndex] = useState<number | null>(null);
  const [rowDragStartY, setRowDragStartY] = useState<number>(0);
  const [rowDragCurrentY, setRowDragCurrentY] = useState<number>(0);

  // Ref to track scroll container position for accurate line positioning
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the cell width based on view mode
  const cellWidth = useMemo(() => getCellWidth(viewMode), [viewMode]);

  // Global mouse tracker for row dragging - now handled by handleMouseMove
  // handleContainerDragOver removed - using custom drag instead of HTML5 DnD

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
    let issuesWithDates = issues.filter(issue => issue.dueDate || issue.createdAt);

    // Apply assignee filter if any are selected (Jira-style toggle)
    if (selectedAssignees.size > 0) {
      issuesWithDates = issuesWithDates.filter(issue =>
        issue.assigneeId && selectedAssignees.has(issue.assigneeId)
      );
    }

    if (groupBy === 'none') {
      return [{
        key: 'all',
        label: t('gantt.allIssues', 'All Issues'),
        issues: sortIssues(issuesWithDates),
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
      issues: sortIssues(groupIssues),
      isCollapsed: collapsedGroups.has(key),
    }));
  }, [issues, groupBy, collapsedGroups, selectedAssignees, t]);

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

  const handleToday = useCallback(() => {
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
  }, [dateRange, cellWidth]);

  // Initial focus on today - Only run ONCE on mount, not on every handleToday change
  useEffect(() => {
    if (hasInitialScrolled.current) return;

    // Small delay to allow layout to settle
    const timer = setTimeout(() => {
      if (scrollContainerRef.current && !hasInitialScrolled.current) {
        const todayIndex = dateRange.days.findIndex(d => isToday(d));
        if (todayIndex > -1) {
          scrollContainerRef.current.scrollLeft = Math.max(0, todayIndex * cellWidth - 200);
          hasInitialScrolled.current = true;
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [dateRange.days, cellWidth]);

  // Drag handlers - enhanced for proper resize/move
  const handleBarMouseDown = useCallback((e: React.MouseEvent, issue: Issue, mode: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();

    // Get the start date for the issue
    const issueStartDate = (issue as any).startDate || (issue as any).start_date;

    setDragState({
      issueId: issue.id,
      mode: mode === 'move' ? 'pending-bar' : mode, // Default to pending check only for move mode
      startX: e.clientX,
      startY: e.clientY,
      originalDueDate: issue.dueDate || null,
      originalCreatedAt: issueStartDate || issue.createdAt,
    });
    setDragDelta(0);
    setDragDeltaY(0);
    setSnappedDelta(0);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Handle linking line
    if (linkingFrom) {
      setMousePosition({ x: e.clientX, y: e.clientY });
      return;
    }

    if (dragState.mode === 'pending-bar') {
      const dx = Math.abs(e.clientX - dragState.startX);
      const dy = Math.abs(e.clientY - dragState.startY);

      // Threshold for movement
      if (dx > 5 || dy > 5) {
        if (dy > dx) {
          // Vertical movement -> Row Reorder
          setDragState(prev => ({ ...prev, mode: 'row-reorder' }));
        } else {
          // Horizontal movement -> Move Date
          setDragState(prev => ({ ...prev, mode: 'move' }));
        }
      }
      return;
    }

    // Handle pending-row mode (from sidebar row mousedown)
    if (dragState.mode === 'pending-row') {
      const dy = Math.abs(e.clientY - dragState.startY);

      // Only activate row reordering after a small threshold to distinguish from click
      if (dy > 5) {
        setDragState(prev => ({ ...prev, mode: 'row-reorder' }));
      }
      return;
    }

    if (!dragState.issueId || !dragState.mode) return;

    if (dragState.mode === 'row-reorder') {
      const deltaY = e.clientY - dragState.startY;
      setDragDeltaY(deltaY);

      // Find drop target using elementFromPoint
      // We temporarily hide the dragged element pointer events via CSS/style in render, 
      // so elementFromPoint hits what's underneath.
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const row = element?.closest('[data-issue-index]');

      if (row) {
        const index = parseInt(row.getAttribute('data-issue-index') || '0', 10);
        const rect = row.getBoundingClientRect();
        const isAbove = e.clientY < (rect.top + rect.height / 2);

        setRowDropTargetIndex(index);
        setRowDropPosition(isAbove ? 'above' : 'below');
      }
      return;
    }

    const deltaX = e.clientX - dragState.startX;

    // Update raw drag delta for visual feedback
    setDragDelta(deltaX);

    // Calculate snapped delta (snaps to cell boundaries)
    const snappedDays = Math.round(deltaX / cellWidth);
    setSnappedDelta(snappedDays * cellWidth);
  }, [dragState, linkingFrom, cellWidth]);

  const handleMouseUp = useCallback(() => {
    // Handle linking completion
    if (linkingFrom && hoverTarget) {
      // Create dependency when dropping on a target
      setDependencies(prev => [...prev, { from: linkingFrom, to: hoverTarget.issueId }]);
      onDependencyCreate?.(linkingFrom, hoverTarget.issueId);
    }

    if (linkingFrom) {
      setLinkingFrom(null);
      setLinkingFromPos(null);
      setLinkingFromSide('right');
      setHoverTarget(null);
    }

    // Commit the drag changes using snapped delta
    if (dragState.issueId && dragState.mode) {
      // Handle pending-row mode (click without significant drag = navigate to issue)
      if (dragState.mode === 'pending-row') {
        const issue = issues.find(i => i.id === dragState.issueId);
        if (issue) {
          // Reset drag state first
          setDragDelta(0);
          setSnappedDelta(0);
          setDragDeltaY(0);
          setDragState({
            issueId: null,
            mode: null,
            startX: 0,
            startY: 0,
            originalDueDate: null,
            originalCreatedAt: null,
          });
          setRowDropTargetIndex(null);
          setRowDropPosition(null);
          setRowDragIssueId(null);
          // Navigate to issue
          if (onIssueClick) {
            onIssueClick(issue);
          } else {
            navigate(`/issue/${issue.id}`);
          }
          return;
        }
      }

      if (dragState.mode === 'row-reorder' && rowDropTargetIndex !== null) {
        const allIssues = groupedIssues.flatMap(g => g.issues);
        const draggedIssueIndex = allIssues.findIndex(i => i.id === dragState.issueId);

        // Don't do anything if dropped on same position
        if (draggedIssueIndex === rowDropTargetIndex) {
          // Reset and return
        } else if (rowDropTargetIndex >= 0 && rowDropTargetIndex < allIssues.length && draggedIssueIndex !== -1) {
          const issueId = dragState.issueId;
          const BASE_GAP = 1000000;

          // SIMPLIFIED APPROACH: Calculate final target position directly
          // 1. Remove dragged item from list conceptually
          // 2. Determine where it should be inserted
          // 3. Calculate sortOrder based on neighbors

          const issuesWithoutDragged = allIssues.filter(i => i.id !== issueId);

          // Calculate the actual insertion index
          let insertIndex: number;
          if (rowDropPosition === 'above') {
            // Insert before the target
            insertIndex = draggedIssueIndex < rowDropTargetIndex
              ? rowDropTargetIndex - 1  // Moving down, target shifts up
              : rowDropTargetIndex;      // Moving up, target stays
          } else {
            // Insert after the target
            insertIndex = draggedIssueIndex < rowDropTargetIndex
              ? rowDropTargetIndex       // Moving down, insert at target
              : rowDropTargetIndex + 1;  // Moving up, insert after target
          }

          // Clamp to valid range
          insertIndex = Math.max(0, Math.min(insertIndex, issuesWithoutDragged.length));

          // Get the items that will be before and after the insertion point
          const itemBefore = insertIndex > 0 ? issuesWithoutDragged[insertIndex - 1] : null;
          const itemAfter = insertIndex < issuesWithoutDragged.length ? issuesWithoutDragged[insertIndex] : null;

          // Calculate sortOrder based on neighbors
          let newSortOrder: number;

          if (!itemBefore && !itemAfter) {
            // Only item in list
            newSortOrder = BASE_GAP;
          } else if (!itemBefore) {
            // Insert at beginning - use half of first item's order
            const afterOrder = itemAfter!.sortOrder ?? BASE_GAP;
            newSortOrder = Math.max(1, Math.floor(afterOrder / 2));
          } else if (!itemAfter) {
            // Insert at end - use last item's order + gap
            const beforeOrder = itemBefore.sortOrder ?? (insertIndex * BASE_GAP);
            newSortOrder = beforeOrder + BASE_GAP;
          } else {
            // Insert between two items - use midpoint
            const beforeOrder = itemBefore.sortOrder ?? (insertIndex * BASE_GAP);
            const afterOrder = itemAfter.sortOrder ?? ((insertIndex + 1) * BASE_GAP);

            if (afterOrder <= beforeOrder) {
              // Invalid ordering, use timestamp
              newSortOrder = beforeOrder + Math.floor(BASE_GAP / 2);
            } else {
              newSortOrder = Math.floor((beforeOrder + afterOrder) / 2);
            }
          }

          // Safety check: ensure positive
          if (newSortOrder < 1) {
            newSortOrder = Date.now();
          }

          console.log('[Gantt Reorder]', {
            from: draggedIssueIndex,
            to: rowDropTargetIndex,
            position: rowDropPosition,
            insertIndex,
            newSortOrder,
            issueId
          });

          wasDraggedRef.current = true;
          onIssueUpdate?.(issueId, { sortOrder: newSortOrder });
        }
        wasDraggedRef.current = true;
      } else if (snappedDelta !== 0) {
        const daysDelta = Math.round(snappedDelta / cellWidth);

        if (daysDelta !== 0) {
          const issue = issues.find(i => i.id === dragState.issueId);
          if (issue) {
            const issueStartDateStr = (issue as any).startDate || (issue as any).start_date;
            const originalStartDate = issueStartDateStr
              ? parseISO(issueStartDateStr)
              : parseISO(issue.createdAt);
            const originalDueDate = dragState.originalDueDate
              ? parseISO(dragState.originalDueDate)
              : addDays(originalStartDate, 3);

            if (dragState.mode === 'move') {
              // Move both start and end dates
              const newStartDate = addDays(originalStartDate, daysDelta);
              const newDueDate = addDays(originalDueDate, daysDelta);
              if (onIssueUpdate) {
                onIssueUpdate(issue.id, {
                  startDate: format(newStartDate, 'yyyy-MM-dd'),
                  dueDate: format(newDueDate, 'yyyy-MM-dd')
                });
              }
            } else if (dragState.mode === 'resize-end') {
              // Only change the end date
              const newDueDate = addDays(originalDueDate, daysDelta);
              // Ensure due date is not before start date
              if (newDueDate >= originalStartDate) {
                onIssueUpdate?.(issue.id, { dueDate: format(newDueDate, 'yyyy-MM-dd') });
              }
            } else if (dragState.mode === 'resize-start') {
              // Only change the start date
              const newStartDate = addDays(originalStartDate, daysDelta);

              // Check if newStartDate exceeds dueDate
              if (newStartDate <= originalDueDate) {
                // Update
                if (onIssueUpdate) {
                  onIssueUpdate(issue.id, { startDate: format(newStartDate, 'yyyy-MM-dd') });
                }
              } else {
                // Clamp to due date? Or just don't update.
                // For better UX, we might clamp, but stopping update is safer for data integrity.
              }
            }
          }
        }
      }
    }

    setDragDelta(0);
    setSnappedDelta(0);
    setDragDeltaY(0);
    setDragState({
      issueId: null,
      mode: null,
      startX: 0,
      startY: 0,
      originalDueDate: null,
      originalCreatedAt: null,
    });
    setRowDropTargetIndex(null);
    setRowDropPosition(null);
    setRowDragIssueId(null);
  }, [linkingFrom, hoverTarget, dragState, snappedDelta, cellWidth, issues, onIssueUpdate, onDependencyCreate, rowDropTargetIndex, rowDropPosition, groupedIssues, navigate, onIssueClick]);

  const handleStartLinking = useCallback((e: React.MouseEvent, issueId: string, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setLinkingFrom(issueId);
    setLinkingFromSide(side);

    // Get the actual bar element's position for accurate starting point
    const barElement = (e.currentTarget as HTMLElement).closest('[data-bar-id]') as HTMLElement;
    if (barElement) {
      const rect = barElement.getBoundingClientRect();
      // Start from the side of the bar (left or right edge center)
      setLinkingFromPos({
        x: side === 'right' ? rect.right : rect.left,
        y: rect.top + rect.height / 2
      });
    } else {
      // Fallback to link dot position
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setLinkingFromPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Handle hovering over a connection point while linking
  const handleLinkPointEnter = useCallback((issueId: string, side: 'left' | 'right') => {
    if (linkingFrom && linkingFrom !== issueId) {
      setHoverTarget({ issueId, side });
    }
  }, [linkingFrom]);

  const handleLinkPointLeave = useCallback(() => {
    setHoverTarget(null);
  }, []);

  const handleBarMouseEnter = useCallback((issueId: string) => {
    // No longer auto-create dependency on bar enter - must hover on link point
  }, []);

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

  // Use imported utility function with component-specific dependencies
  const getBarPosition = useCallback(
    (issue: Issue) => getBarPositionFromUtils(issue, dateRange, cellWidth),
    [dateRange, cellWidth]
  );

  // Use imported getStatusColor from utils

  const handleIssueClick = (issue: Issue) => {
    if (onIssueClick) {
      onIssueClick(issue);
    } else {
      navigate(`/issue/${issue.id}`);
    }
  };

  const totalWidth = dateRange.days.length * cellWidth;

  // Get week/month markers for header using imported utility
  const getHeaderMarkers = useCallback(
    () => getHeaderMarkersFromUtils(dateRange, viewMode, dateLocale),
    [dateRange, viewMode, dateLocale]
  );

  const totalIssuesWithDates = groupedIssues.reduce((sum, g) => sum + g.issues.length, 0);

  const handleRowMouseDown = useCallback((e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    // Don't trigger if clicking interactive elements like buttons or dropdowns
    if ((e.target as HTMLElement).closest('button, [role="button"], .cursor-pointer, [role="menuitem"]')) return;

    setDragState({
      issueId: issue.id,
      mode: 'pending-row', // Use pending mode to distinguish click from drag
      startX: e.clientX,
      startY: e.clientY,
      originalDueDate: issue.dueDate || null,
      originalCreatedAt: (issue as any).startDate || (issue as any).start_date || issue.createdAt,
    });
    setDragDeltaY(0);
    setRowDragIssueId(issue.id);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background text-foreground select-none">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">{t('gantt.title', 'Gantt Chart')}</h1>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-7 text-xs"
            >
              {t('gantt.today', 'Today')}
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <span className="text-sm font-medium px-2">
              {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Jira-style Assignee Filter - Avatar Toggles */}
          {(() => {
            // Extract unique assignees from all issues
            const assigneeMap = new Map<string, { id: string; name: string; email?: string; avatar?: string }>();
            issues.forEach(issue => {
              if (issue.assigneeId && issue.assignee) {
                assigneeMap.set(issue.assigneeId, {
                  id: issue.assigneeId,
                  name: issue.assignee.name || issue.assignee.email || 'Unknown',
                  email: issue.assignee.email,
                  avatar: issue.assignee.avatarUrl,
                });
              }
            });
            const uniqueAssignees = Array.from(assigneeMap.values());

            if (uniqueAssignees.length === 0) return null;

            const toggleAssignee = (assigneeId: string) => {
              setSelectedAssignees(prev => {
                const next = new Set(prev);
                if (next.has(assigneeId)) {
                  next.delete(assigneeId);
                } else {
                  next.add(assigneeId);
                }
                return next;
              });
            };

            return (
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                {uniqueAssignees.slice(0, 8).map(assignee => (
                  <Tooltip key={assignee.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "rounded-full transition-all ring-offset-background",
                          selectedAssignees.has(assignee.id)
                            ? "ring-2 ring-primary ring-offset-1 opacity-100"
                            : "opacity-60 hover:opacity-100"
                        )}
                        onClick={() => toggleAssignee(assignee.id)}
                      >
                        <Avatar className="h-7 w-7">
                          {assignee.avatar && <AvatarImage src={assignee.avatar} alt={assignee.name} />}
                          <AvatarFallback className="text-[10px]">
                            {assignee.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{assignee.name}</p>
                      {selectedAssignees.has(assignee.id) && (
                        <p className="text-xs text-muted-foreground">Click to remove filter</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {selectedAssignees.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => setSelectedAssignees(new Set())}
                  >
                    Clear
                  </Button>
                )}
              </div>
            );
          })()}
          {/* Group By */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <ListFilter className="h-3.5 w-3.5" />
                <span className="text-xs">{t('gantt.groupBy', 'Group By')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setGroupBy('none')}>
                {groupBy === 'none' && '✓ '}{t('gantt.none', 'None')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy('project')}>
                {groupBy === 'project' && '✓ '}{t('gantt.byProject', 'By Project')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy('assignee')}>
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
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-background z-10 shadow-sm relative">
          {/* Column Header */}
          <div className="h-16 border-b border-border px-3 flex items-end pb-2 bg-background z-20">
            <span className="text-sm font-medium text-muted-foreground">
              {t('gantt.issues', 'Issues')} ({totalIssuesWithDates})
            </span>
          </div>

          {/* Issue List - Scrollbar hidden, synced with timeline */}
          <div
            ref={sidebarRef}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
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
                      className="h-8 px-3 flex items-center gap-2 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70 sticky top-0 z-10"
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

                  {/* Group Issues - Custom Drag for reordering */}
                  {!group.isCollapsed && group.issues.map((issue, issueIndex) => {
                    const globalIndex = groupedIssues.flatMap(g => g.issues).findIndex(i => i.id === issue.id);
                    const draggedIndex = dragState.issueId ? groupedIssues.flatMap(g => g.issues).findIndex(i => i.id === dragState.issueId) : -1;
                    const isDragging = dragState.mode === 'row-reorder' && dragState.issueId === issue.id;
                    const isDropTarget = rowDropTargetIndex !== null &&
                      groupedIssues.flatMap(g => g.issues)[rowDropTargetIndex]?.id === issue.id;

                    // Calculate visual shift for live preview
                    let shiftY = 0;
                    if (dragState.mode === 'row-reorder' && draggedIndex !== -1 && !isDragging && rowDropTargetIndex !== null) {
                      const targetIdx = rowDropPosition === 'below' ? rowDropTargetIndex + 1 : rowDropTargetIndex;
                      // If dragging from above to below this row, shift up
                      if (draggedIndex < globalIndex && globalIndex <= targetIdx - 1) {
                        shiftY = -40; // Row height
                      }
                      // If dragging from below to above this row, shift down
                      else if (draggedIndex > globalIndex && globalIndex >= targetIdx) {
                        shiftY = 40;
                      }
                    }

                    return (
                      <div
                        key={issue.id}
                        data-issue-id={issue.id}
                        data-issue-index={globalIndex}
                        onMouseDown={(e) => handleRowMouseDown(e, issue)}
                        className={cn(
                          "h-10 px-3 flex items-center gap-2 border-b border-border/50 cursor-grab hover:bg-muted/30 relative",
                          "transition-transform duration-150 ease-out",
                          isDragging && "bg-primary/30 opacity-80 pointer-events-none z-50 shadow-xl ring-2 ring-primary/50",
                          // Removed border-t/b indicators in favor of Ghost Row below
                        )}
                        style={{
                          transform: isDragging
                            ? `translateY(${dragDeltaY}px) scale(1.02)`
                            : shiftY !== 0
                              ? `translateY(${shiftY}px)`
                              : undefined,
                          zIndex: isDragging ? 100 : undefined
                        }}
                        onClick={() => {
                          // Skip click if we just finished dragging
                          if (wasDraggedRef.current) {
                            wasDraggedRef.current = false;
                            return;
                          }
                          handleIssueClick(issue);
                        }}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground flex-shrink-0 cursor-grab" />
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <div className="cursor-pointer hover:bg-muted rounded p-0.5" role="button" aria-label="Change issue type">
                                  <IssueTypeIcon type={(issue as any).type || 'task'} size="sm" />
                                </div>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(`issue.type.${(issue as any).type || 'task'}`, (issue as any).type || 'Task') as string}
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="start">
                            {['task', 'bug', 'story', 'epic'].map(type => (
                              <DropdownMenuItem
                                key={type}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  onIssueUpdate?.(issue.id, { type } as any);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <IssueTypeIcon type={type as any} size="sm" />
                                  <span>{t(`issue.type.${type}`, type)}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" title={issue.title}>
                            {issue.title}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                          {issue.identifier}
                        </span>
                      </div>
                    );
                  })}
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
          <div style={{ width: `${totalWidth}px`, minWidth: '100%' }} className="relative">
            {/* Dependency Lines - SVG Overlay with clipping */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-40"
              style={{ overflow: 'hidden' }}
            >
              <defs>
                <marker
                  id="arrowhead"
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
                  id="arrowhead-hover"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                </marker>
                <marker
                  id="arrowhead-snap"
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

              {dependencies.map((dep, index) => {
                const fromIssue = issues.find(i => i.id === dep.from);
                const toIssue = issues.find(i => i.id === dep.to);
                if (!fromIssue || !toIssue) return null;

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

                // Calculate actual pixel positions relative to timeline
                const headerHeight = 64; // Approx height of headers including month/day rows
                const rowHeight = 40;

                // End of source bar
                const fromX = parseFloat(fromPos.left) + parseFloat(fromPos.width);
                const fromY = headerHeight + (fromRowIndex * rowHeight) + (rowHeight / 2);
                // Start of target bar
                const toX = parseFloat(toPos.left);
                const toY = headerHeight + (toRowIndex * rowHeight) + (rowHeight / 2);

                // Advanced Notion/Figma-style bezier curve calculation
                const horizontalDist = Math.abs(toX - fromX);
                const verticalDist = Math.abs(toY - fromY);
                const distance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);

                // Dynamic control point offset based on distance
                const baseOffset = Math.min(distance / 3, 80);
                const curveStrength = Math.min(verticalDist / 2, 60);

                let pathD: string;

                if (toX > fromX + 20) {
                  const cp1x = fromX + baseOffset;
                  const cp1y = fromY;
                  const cp2x = toX - baseOffset;
                  const cp2y = toY;
                  pathD = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
                } else if (toX < fromX - 20) {
                  const loopOffset = Math.max(60, baseOffset);
                  const vertDirection = toY > fromY ? 1 : -1;
                  const midY = (fromY + toY) / 2;

                  pathD = `M ${fromX} ${fromY} 
                           C ${fromX + loopOffset} ${fromY}, 
                             ${fromX + loopOffset} ${fromY + (vertDirection * curveStrength)}, 
                             ${(fromX + toX) / 2 + loopOffset / 2} ${midY}
                           S ${toX - loopOffset} ${toY},
                             ${toX} ${toY}`;
                } else {
                  const cp1x = fromX + 40;
                  const cp2x = toX - 40;
                  pathD = `M ${fromX} ${fromY} C ${cp1x} ${fromY}, ${cp2x} ${toY}, ${toX} ${toY}`;
                }

                return (
                  <g key={`dep-${index}`} className={cn("group/dep", (dragState.mode && dragState.mode !== null) || !!linkingFrom ? "pointer-events-none" : "pointer-events-auto")}>
                    {/* Clickable transparent path for easier selection */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      className="cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Double click to delete
                        if (confirm(t('gantt.deleteDependencyConfirm', 'Delete this dependency?'))) {
                          const key = `${dep.from}->${dep.to}`;
                          deletedDepKeysRef.current.add(key);
                          setDependencies(prev => prev.filter((_, i) => i !== index));
                          onDependencyDelete?.(dep.from, dep.to);
                        }
                      }}
                    />
                    {/* Visible path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                      className="group-hover/dep:stroke-red-500 transition-colors pointer-events-none"
                    />

                    {/* Drag Handle at the end (Tip) */}
                    <circle
                      cx={toX}
                      cy={toY}
                      r="6"
                      fill="rgba(59, 130, 246, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                      className={cn("cursor-grab hover:fill-blue-600 z-50", (dragState.mode && dragState.mode !== null) ? "pointer-events-none" : "pointer-events-auto")}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        const key = `${dep.from}->${dep.to}`;
                        deletedDepKeysRef.current.add(key);

                        setLinkingFrom(dep.from);
                        setLinkingFromSide('right');

                        // Fake a position to trigger logic
                        setLinkingFromPos({ x: 0, y: 0 });

                        // Temporarily remove this dependency
                        setDependencies(prev => prev.filter((_, i) => i !== index));
                        onDependencyDelete?.(dep.from, dep.to);
                      }}
                    />
                  </g>
                );
              })}

              {/* Linking line while dragging */}
              {linkingFrom && linkingFromPos && (
                (() => {
                  // We need to transform screen coordinates to timeline coordinates because SVG is now inside timeline
                  // The linkingFromPos is from getBoundingClientRect (screen coords)
                  // MousePosition is screen coords
                  // We need relative coords.

                  // Actually, better to use the bar's logical position if possible.
                  // linkingFromPos in original code was:
                  // x: rect.right, y: rect.top + height/2.

                  // Since we changed SVG to be inside timeline, we must calculate 'from' based on data, not screen rects,
                  // OR we must subtract the container's BoundingRect.

                  // Let's use data-based calculation consistent with the dependency lines above.
                  const fromIssue = issues.find(i => i.id === linkingFrom);
                  if (!fromIssue) return null;

                  // Find row index
                  let fromRowIndex = 0;
                  let currentRow = 0;
                  for (const group of groupedIssues) {
                    for (const issue of group.issues) {
                      if (issue.id === linkingFrom) fromRowIndex = currentRow;
                      currentRow++;
                    }
                  }

                  const fromPos = getBarPosition(fromIssue);
                  const headerHeight = 64;
                  const rowHeight = 40;

                  const fromX = linkingFromSide === 'right'
                    ? parseFloat(fromPos.left) + parseFloat(fromPos.width)
                    : parseFloat(fromPos.left);
                  const fromY = headerHeight + (fromRowIndex * rowHeight) + (rowHeight / 2);

                  // For 'toX', we need mouse position relative to timeline.
                  // This is tricky. simpler to use logic:
                  // if snapped to target, use target data position.
                  // else? 

                  let toX: number;
                  let toY: number;
                  let isSnapped = false;

                  if (hoverTarget) {
                    const targetIssue = issues.find(i => i.id === hoverTarget.issueId);
                    if (targetIssue) {
                      const targetPos = getBarPosition(targetIssue);
                      let targetRowIndex = 0;
                      let currentRow = 0;
                      for (const group of groupedIssues) {
                        for (const issue of group.issues) {
                          if (issue.id === hoverTarget.issueId) targetRowIndex = currentRow;
                          currentRow++;
                        }
                      }

                      toX = parseFloat(targetPos.left) + (hoverTarget.side === 'right' ? parseFloat(targetPos.width) : 0);
                      toY = headerHeight + (targetRowIndex * rowHeight) + (rowHeight / 2);
                      isSnapped = true;
                    } else {
                      toX = fromX + 100; toY = fromY; // Fallback
                    }
                  } else {
                    // Approximate mouse pos relative to timeline?
                    // Using the dragDelta helps if we were dragging a bar, but here we are moving mouse.
                    // We need the container ref to get its rect.
                    // scrollContainerRef.current
                    if (scrollContainerRef.current) {
                      const rect = scrollContainerRef.current.getBoundingClientRect();
                      toX = mousePosition.x - rect.left + scrollContainerRef.current.scrollLeft;
                      toY = mousePosition.y - rect.top + scrollContainerRef.current.scrollTop;
                      // Adjust for header if needed? Header is inside scroll container?
                      // The SVG is inside the inner div.
                      // The mouse is screen relative.
                      // inner div is relative to viewport? 
                      // Yes: mouseX - containerX + scrollLeft = x relative to content start.
                    } else {
                      toX = fromX + 100;
                      toY = fromY;
                    }
                  }

                  // ... Draw curve ...
                  const horizontalDist = Math.abs(toX - fromX);
                  const verticalDist = Math.abs(toY - fromY);
                  const distance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);

                  const cpOffset = Math.min(Math.max(distance / 3, 30), 100);

                  let pathD: string;
                  const startSide = linkingFromSide;
                  const direction = startSide === 'right' ? 1 : -1;

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
                        stroke={isSnapped ? "#22c55e" : "#f59e0b"}
                        strokeWidth="2"
                        opacity="0.8"
                        strokeDasharray="8,4"
                        markerEnd={isSnapped ? "url(#arrowhead-snap)" : "url(#arrowhead)"}
                      />
                    </g>
                  );
                })()
              )}
            </svg>
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

              {/* Cycles Row - Jira-style sprint/cycle markers */}
              {cycles.length > 0 && (
                <div className="h-6 flex relative bg-muted/20 border-t border-border/30">
                  {dateRange.days.map((day, index) => (
                    <div
                      key={index}
                      className="border-r border-border/10"
                      style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                    />
                  ))}
                  {/* Cycle Bars */}
                  {cycles.map((cycle) => {
                    const cycleStart = parseISO(cycle.startDate);
                    const cycleEnd = parseISO(cycle.endDate);

                    if (!isValid(cycleStart) || !isValid(cycleEnd)) return null;

                    const startDayIndex = dateRange.days.findIndex(d => isSameDay(d, cycleStart));
                    const endDayIndex = dateRange.days.findIndex(d => isSameDay(d, cycleEnd));

                    // Calculate visible portion
                    const visibleStart = Math.max(0, startDayIndex);
                    const visibleEnd = endDayIndex >= 0 ? endDayIndex : dateRange.days.length - 1;

                    if (visibleStart > dateRange.days.length - 1 || visibleEnd < 0) return null;

                    const left = visibleStart * cellWidth;
                    const width = (visibleEnd - visibleStart + 1) * cellWidth;

                    const statusColors = {
                      upcoming: 'bg-blue-500/30 border-blue-500/50 text-blue-400',
                      active: 'bg-green-500/30 border-green-500/50 text-green-400',
                      completed: 'bg-gray-500/30 border-gray-500/50 text-gray-400',
                    };

                    return (
                      <div
                        key={cycle.id}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-full border flex items-center px-2 overflow-hidden",
                          statusColors[cycle.status]
                        )}
                        style={{ left: `${left}px`, width: `${width}px`, minWidth: '60px' }}
                        title={`${cycle.name}: ${format(cycleStart, 'PP', { locale: dateLocale })} - ${format(cycleEnd, 'PP', { locale: dateLocale })}`}
                      >
                        <span className="text-[10px] font-medium truncate">{cycle.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {!group.isCollapsed && group.issues.map((issue, issueIndex) => {
                    const barPos = getBarPosition(issue);

                    // Calculate global index for this issue FIRST (across all groups)
                    let globalIndex = 0;
                    for (const g of groupedIssues) {
                      if (g.key === group.key) {
                        globalIndex += issueIndex;
                        break;
                      }
                      globalIndex += g.issues.length;
                    }

                    const isRowDragging = rowDragIssueId === issue.id;
                    const isDropTarget = rowDropTargetIndex === globalIndex; // USE globalIndex, not issueIndex!

                    // Calculate visual shift for live preview (matching sidebar logic)
                    const draggedIndex = dragState.issueId ? groupedIssues.flatMap(g => g.issues).findIndex(i => i.id === dragState.issueId) : -1;
                    let shiftY = 0;
                    if (dragState.mode === 'row-reorder' && draggedIndex !== -1 && !isRowDragging && rowDropTargetIndex !== null) {
                      const targetIdx = rowDropPosition === 'below' ? rowDropTargetIndex + 1 : rowDropTargetIndex;
                      // If dragging from above to below this row, shift up
                      if (draggedIndex < globalIndex && globalIndex <= targetIdx - 1) {
                        shiftY = -40; // Row height
                      }
                      // If dragging from below to above this row, shift down
                      else if (draggedIndex > globalIndex && globalIndex >= targetIdx) {
                        shiftY = 40;
                      }
                    }

                    return (
                      <div
                        key={issue.id}
                        className={cn(
                          "h-10 relative border-b border-border/30 transition-all duration-150 ease-out", // Match sidebar transition
                          isRowDragging && "z-50 bg-background/80 shadow-xl opacity-80 pointer-events-none", // Match sidebar dragging style
                          // Removed border-t/b indicators
                        )}
                        style={{
                          transform: isRowDragging
                            ? `translateY(${dragDeltaY}px) scale(1.02)` // Use dragDeltaY like sidebar
                            : shiftY !== 0
                              ? `translateY(${shiftY}px)`
                              : undefined,
                          zIndex: isRowDragging ? 100 : undefined
                        }}
                        data-issue-id={issue.id}
                        data-issue-index={globalIndex}
                        data-group-key={group.key}
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
                        {barPos.isVisible && (() => {
                          const isDragging = dragState.issueId === issue.id;
                          const isLinkingFromThis = linkingFrom === issue.id;
                          const isLinkTarget = hoverTarget?.issueId === issue.id;

                          // Calculate snapped visual position during drag
                          const baseLeft = parseFloat(barPos.left);
                          const baseWidth = parseFloat(barPos.width);

                          // Snapped position (where it will land)
                          const snappedLeft = isDragging && (dragState.mode === 'move' || dragState.mode === 'resize-start')
                            ? baseLeft + snappedDelta : baseLeft;
                          const snappedWidth = isDragging && (dragState.mode === 'resize-end' || dragState.mode === 'resize-start')
                            ? (dragState.mode === 'resize-end'
                              ? Math.max(cellWidth, baseWidth + snappedDelta)
                              : Math.max(cellWidth, baseWidth - snappedDelta))
                            : baseWidth;

                          // Current visual position (follows mouse smoothly)
                          const visualLeft = isDragging && (dragState.mode === 'move' || dragState.mode === 'resize-start')
                            ? baseLeft + dragDelta : baseLeft;
                          const visualWidth = isDragging && (dragState.mode === 'resize-end' || dragState.mode === 'resize-start')
                            ? (dragState.mode === 'resize-end'
                              ? Math.max(cellWidth, baseWidth + dragDelta)
                              : Math.max(cellWidth, baseWidth - dragDelta))
                            : baseWidth;

                          return (
                            <>
                              {/* Ghost bar showing snapped position */}
                              {isDragging && (snappedDelta !== 0 || dragDelta !== 0) && (
                                <div
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 h-6 rounded border-2 border-dashed pointer-events-none z-25",
                                    getStatusColor(issue.status)
                                  )}
                                  style={{
                                    left: `${snappedLeft}px`,
                                    width: `${snappedWidth}px`,
                                    minWidth: '60px',
                                    opacity: 0.4,
                                  }}
                                />
                              )}

                              {/* Main bar - NO draggable, only date drag via mousedown */}
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
                                      isLinkTarget && "ring-2 ring-green-400 z-30 scale-105",
                                      rowDragIssueId === issue.id && "opacity-50 scale-95"
                                    )}
                                    style={{
                                      left: `${visualLeft}px`,
                                      width: `${visualWidth}px`,
                                      minWidth: '60px',
                                      opacity: isDragging ? 0.7 : (rowDragIssueId === issue.id ? 0.5 : (barPos.hasDueDate ? 1 : 0.6)),
                                    }}
                                    onMouseDown={(e) => {
                                      // Only handle bar date drag on center area (not handles)
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const relativeX = e.clientX - rect.left;
                                      const isOnLeftHandle = relativeX < 12; // Left 12px
                                      const isOnRightHandle = relativeX > rect.width - 12; // Right 12px

                                      if (!isOnLeftHandle && !isOnRightHandle) {
                                        handleBarMouseDown(e, issue, 'move');
                                      }
                                    }}
                                    onMouseEnter={() => handleBarMouseEnter(issue.id)}
                                    onDoubleClick={() => handleIssueClick(issue)}
                                  >
                                    {/* Left resize handle - wider hit area */}
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 hover:bg-white/40 rounded-l flex items-center justify-center z-20 transition-all"
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

                                    {/* Right resize handle - wider hit area */}
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 hover:bg-white/40 rounded-r flex items-center justify-center z-20 transition-all"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleBarMouseDown(e, issue, 'resize-end');
                                      }}
                                      title="Drag to resize end date"
                                    >
                                      <div className="w-0.5 h-3 bg-white/80 rounded" />
                                    </div>

                                    {/* Link points - show when hovering or when actively linking */}
                                    {/* Left Link Point - Enlarged for easier detection */}
                                    <div
                                      data-link-point="left"
                                      data-issue-id={issue.id}
                                      className={cn(
                                        "absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white/90 cursor-crosshair z-30 transition-all",
                                        linkingFrom
                                          ? (isLinkTarget && hoverTarget?.side === 'left'
                                            ? "opacity-100 bg-green-500 scale-150 border-green-300 shadow-lg shadow-green-500/50"
                                            : "opacity-100 bg-amber-500 scale-110")
                                          : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-125 hover:bg-amber-400"
                                      )}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleStartLinking(e, issue.id, 'left');
                                      }}
                                      onMouseEnter={() => handleLinkPointEnter(issue.id, 'left')}
                                      onMouseLeave={handleLinkPointLeave}
                                    />
                                    {/* Right Link Point - Enlarged for easier detection */}
                                    <div
                                      data-link-point="right"
                                      data-issue-id={issue.id}
                                      className={cn(
                                        "absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white/90 cursor-crosshair z-30 transition-all",
                                        linkingFrom
                                          ? (isLinkTarget && hoverTarget?.side === 'right'
                                            ? "opacity-100 bg-green-500 scale-150 border-green-300 shadow-lg shadow-green-500/50"
                                            : "opacity-100 bg-amber-500 scale-110")
                                          : "opacity-0 group-hover/bar:opacity-100 bg-amber-500 hover:scale-125 hover:bg-amber-400"
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
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {t('gantt.dragToMove', 'Drag to move • Double-click to view')}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </>
                          );
                        })()}
                        {/* Ghost Row for Timeline - shows where bar will land */}
                        {shiftY !== 0 && (
                          <div
                            className="absolute left-0 right-0 h-10 bg-muted/50 border-y border-dashed border-primary/30 pointer-events-none z-10"
                            style={{
                              top: shiftY > 0 ? '-40px' : 'auto',
                              bottom: shiftY < 0 ? '-40px' : 'auto',
                            }}
                          >
                            <div className="absolute inset-0 bg-primary/5" />
                          </div>
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
