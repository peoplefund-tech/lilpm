import type { Issue } from '@/types';

export interface GanttCycle {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'upcoming' | 'active' | 'completed';
}

export interface GanttChartProps {
    issues: Issue[];
    cycles?: GanttCycle[];
    onIssueClick?: (issue: Issue) => void;
    onIssueUpdate?: (issueId: string, updates: { dueDate?: string; startDate?: string; sortOrder?: number }) => void;
    onDependencyCreate?: (fromIssueId: string, toIssueId: string) => void;
    onDependencyDelete?: (fromIssueId: string, toIssueId: string) => void;
    onCycleCreate?: (startDate: string, endDate: string, name: string) => void;
}

export interface DragState {
    issueId: string | null;
    mode: 'move' | 'resize-start' | 'resize-end' | 'link' | 'row-reorder' | 'pending-bar' | 'pending-row' | null;
    startX: number;
    startY: number;
    originalDueDate: string | null;
    originalCreatedAt: string | null;
}

export interface Dependency {
    from: string;
    to: string;
}

export type ViewMode = 'day' | 'week' | 'month' | 'quarter';
export type GroupBy = 'none' | 'project' | 'assignee' | 'status';

export interface GroupedIssues {
    key: string;
    label: string;
    issues: Issue[];
    isCollapsed: boolean;
}

// Added for utils extraction
export interface DateRange {
    start: Date;
    end: Date;
    days: Date[];
}

export interface HeaderMarker {
    date: Date;
    label: string;
    span: number;
}
