import React from 'react';
import { 
  Circle,
  CircleDot,
  CircleDashed,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Minus,
  ChevronDown,
} from 'lucide-react';
import type { IssueStatus, IssuePriority } from '@/types';
import { cn } from '@/lib/utils';

// Status Icon Component
interface StatusIconProps {
  status: IssueStatus;
  className?: string;
}

export function StatusIcon({ status, className }: StatusIconProps) {
  const iconProps = { className: cn('h-4 w-4', className) };
  
  switch (status) {
    case 'backlog':
      return <CircleDashed {...iconProps} className={cn(iconProps.className, 'text-status-backlog')} />;
    case 'todo':
      return <Circle {...iconProps} className={cn(iconProps.className, 'text-status-todo')} />;
    case 'in_progress':
      return <CircleDot {...iconProps} className={cn(iconProps.className, 'text-status-in-progress')} />;
    case 'in_review':
      return <Clock {...iconProps} className={cn(iconProps.className, 'text-primary')} />;
    case 'done':
      return <CheckCircle2 {...iconProps} className={cn(iconProps.className, 'text-status-done')} />;
    case 'cancelled':
      return <XCircle {...iconProps} className={cn(iconProps.className, 'text-status-cancelled')} />;
    default:
      return <Circle {...iconProps} />;
  }
}

export const statusLabels: Record<IssueStatus, string> = {
  'backlog': 'Backlog',
  'todo': 'Todo',
  'in_progress': 'In Progress',
  'in_review': 'In Review',
  'done': 'Done',
  'cancelled': 'Cancelled',
};

export const allStatuses: IssueStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
];

// Priority Icon Component
interface PriorityIconProps {
  priority: IssuePriority;
  className?: string;
}

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  const iconProps = { className: cn('h-4 w-4', className) };
  
  switch (priority) {
    case 'urgent':
      return <AlertCircle {...iconProps} className={cn(iconProps.className, 'text-priority-urgent')} />;
    case 'high':
      return <AlertTriangle {...iconProps} className={cn(iconProps.className, 'text-priority-high')} />;
    case 'medium':
      return (
        <div className={cn('flex gap-0.5', className)}>
          <div className="w-0.5 h-3 bg-priority-medium rounded-full" />
          <div className="w-0.5 h-3 bg-priority-medium rounded-full" />
          <div className="w-0.5 h-3 bg-muted rounded-full" />
          <div className="w-0.5 h-3 bg-muted rounded-full" />
        </div>
      );
    case 'low':
      return (
        <div className={cn('flex gap-0.5', className)}>
          <div className="w-0.5 h-3 bg-priority-low rounded-full" />
          <div className="w-0.5 h-3 bg-muted rounded-full" />
          <div className="w-0.5 h-3 bg-muted rounded-full" />
          <div className="w-0.5 h-3 bg-muted rounded-full" />
        </div>
      );
    case 'none':
      return <Minus {...iconProps} className={cn(iconProps.className, 'text-priority-none')} />;
    default:
      return <Minus {...iconProps} />;
  }
}

export const priorityLabels: Record<IssuePriority, string> = {
  'urgent': 'Urgent',
  'high': 'High',
  'medium': 'Medium',
  'low': 'Low',
  'none': 'No Priority',
};

export const allPriorities: IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
];
