/**
 * Sortable Gantt Chart Components
 * Reusable drag-and-drop components for Gantt charts
 */
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IssueTypeIcon } from './IssueTypeIcon';
import type { Issue } from '@/types';

interface SortableIssueRowProps {
    issue: Issue;
    index: number;
    isDragging: boolean;
}

/**
 * Sortable Issue Row Component with Notion-style design
 * Used in the sidebar of Gantt charts for row reordering
 */
export function SortableIssueRow({ issue, index, isDragging }: SortableIssueRowProps) {
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

interface SortableIssueBarProps {
    issue: Issue;
    children: React.ReactNode;
}

/**
 * Wrapper for the timeline bar to enable vertical sorting
 * Provides drag handle and transform functionality
 */
export function SortableIssueBar({ issue, children }: SortableIssueBarProps) {
    const {
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
        listeners,
        attributes,
    } = useSortable({ id: `${issue.id}-timeline` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        zIndex: isDragging ? 50 : 10,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("relative", isDragging && "opacity-80")}
        >
            {/* Drag Handle - Visible on Hover of the Row/Bar */}
            <div
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                className={cn(
                    "absolute left-[-24px] top-1/2 -translate-y-1/2 p-1 cursor-grab active:cursor-grabbing",
                    "opacity-0 group-hover/bar:opacity-100 hover:opacity-100 transition-opacity z-40",
                    "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                )}
                onMouseDown={(e) => {
                    // Ensure this doesn't trigger bar move
                    e.stopPropagation();
                }}
            >
                <GripVertical className="h-4 w-4" />
            </div>
            {children}
        </div>
    );
}
