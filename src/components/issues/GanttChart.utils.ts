import type { Issue, IssueStatus } from '@/types';
import type { Locale } from 'date-fns';
import {
    differenceInDays,
    parseISO,
    isValid,
    addDays,
    isSameMonth,
    format
} from 'date-fns';
import type { ViewMode, DateRange, HeaderMarker } from './GanttChart.types';

/**
 * Get color classes for issue status
 */
export function getStatusColor(status: IssueStatus): string {
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
}

/**
 * Sort issues with robust handling for mixed defined/undefined sortOrders
 * 1. Establish a "Natural Order" based on Date -> Created -> ID
 * 2. Assign virtual sortOrders to undefined items based on their Natural Index
 * 3. Sort by Effective Sort Order (Real ?? Virtual)
 */
export function sortIssues(issueList: Issue[]): Issue[] {
    const BASE_GAP = 1000000;

    // 1. Natural Sort (fallback logic)
    const naturalSorted = [...issueList].sort((a, b) => {
        // Fallback 1: Due Date
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        if (dateA !== dateB) {
            if (dateA === 0) return 1;
            if (dateB === 0) return -1;
            return dateA - dateB;
        }
        // Fallback 2: Creation Date
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        if (createdA !== createdB) return createdA - createdB;
        // Fallback 3: ID
        return a.id.localeCompare(b.id);
    });

    // 2 & 3. Map to effective sort order and sort
    return naturalSorted
        .map((issue, index) => ({
            issue,
            effectiveSortOrder: issue.sortOrder ?? ((index + 1) * BASE_GAP)
        }))
        .sort((a, b) => {
            if (a.effectiveSortOrder !== b.effectiveSortOrder) {
                return a.effectiveSortOrder - b.effectiveSortOrder;
            }
            // Ultimate tie-breaker (should rarely be reached due to unique IDs in natural sort)
            return a.issue.id.localeCompare(b.issue.id);
        })
        .map(item => item.issue);
}

/**
 * Bar position calculation result
 */
export interface BarPosition {
    left: string;
    width: string;
    isVisible: boolean;
    hasDueDate: boolean;
    hasStartDate: boolean;
}

/**
 * Calculate bar position for an issue on the Gantt chart
 */
export function getBarPosition(
    issue: Issue,
    dateRange: DateRange,
    cellWidth: number
): BarPosition {
    const dueDate = issue.dueDate ? parseISO(issue.dueDate) : null;
    const createdDate = parseISO(issue.createdAt);

    // Use explicit start_date if available, otherwise fall back to created date
    const issueStartDate = (issue as any).startDate || (issue as any).start_date;
    const startDate = issueStartDate ? parseISO(issueStartDate) : createdDate;

    // Safety check for invalid dates
    const safeStartDate = isValid(startDate) ? startDate : new Date();

    // Use due date as end, or start date + 3 days if no due date
    const endDate = dueDate && isValid(dueDate) ? dueDate : addDays(safeStartDate, 3);
    const safeEndDate = isValid(endDate) ? endDate : addDays(safeStartDate, 3);

    const startIndex = differenceInDays(safeStartDate, dateRange.start);
    const endIndex = differenceInDays(safeEndDate, dateRange.start);
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
        hasStartDate: !!issueStartDate,
    };
}

/**
 * Calculate cell width based on view mode
 */
export function getCellWidth(viewMode: ViewMode): number {
    switch (viewMode) {
        case 'day': return 60;
        case 'week': return 40;
        case 'month': return 32;
        case 'quarter': return 20;
        default: return 32;
    }
}

/**
 * Get header markers for the timeline
 */
export function getHeaderMarkers(
    dateRange: DateRange,
    viewMode: ViewMode,
    dateLocale: Locale
): HeaderMarker[] {
    const markers: HeaderMarker[] = [];
    let currentMonth = '';
    let currentSpan = 0;
    let startIndex = 0;

    dateRange.days.forEach((day, index) => {
        const monthKey = format(day, 'yyyy-MM', { locale: dateLocale });

        if (monthKey !== currentMonth) {
            if (currentMonth !== '') {
                markers.push({
                    date: dateRange.days[startIndex],
                    label: format(dateRange.days[startIndex], viewMode === 'quarter' ? 'MMM' : 'MMMM yyyy', { locale: dateLocale }),
                    span: currentSpan
                });
            }
            currentMonth = monthKey;
            currentSpan = 1;
            startIndex = index;
        } else {
            currentSpan++;
        }
    });

    // Add the last month
    if (currentSpan > 0) {
        markers.push({
            date: dateRange.days[startIndex],
            label: format(dateRange.days[startIndex], viewMode === 'quarter' ? 'MMM' : 'MMMM yyyy', { locale: dateLocale }),
            span: currentSpan
        });
    }

    return markers;
}

/**
 * Calculate new sortOrder for reordering
 */
export function calculateReorderSortOrder(
    issuesWithoutDragged: Issue[],
    insertIndex: number
): number {
    const BASE_GAP = 1000000;

    const itemBefore = insertIndex > 0 ? issuesWithoutDragged[insertIndex - 1] : null;
    const itemAfter = insertIndex < issuesWithoutDragged.length ? issuesWithoutDragged[insertIndex] : null;

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

    return newSortOrder;
}
