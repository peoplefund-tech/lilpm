import React from 'react';
import { 
  Zap, 
  BookOpen, 
  CheckSquare, 
  ListTodo,
  Bug,
} from 'lucide-react';
import type { IssueType } from '@/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface IssueTypeIconProps {
  type: IssueType;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const issueTypeConfig: Record<IssueType, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  epic: { 
    icon: Zap, 
    label: 'Epic', 
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  user_story: { 
    icon: BookOpen, 
    label: 'User Story', 
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  task: { 
    icon: CheckSquare, 
    label: 'Task', 
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  subtask: { 
    icon: ListTodo, 
    label: 'Subtask', 
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  },
  bug: { 
    icon: Bug, 
    label: 'Bug', 
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

export function IssueTypeIcon({ type, className, showLabel = false, size = 'md' }: IssueTypeIconProps) {
  const config = issueTypeConfig[type] || issueTypeConfig.task;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: { icon: 'h-3 w-3', padding: 'p-0.5', iconLabel: 'h-3 w-3' },
    md: { icon: 'h-4 w-4', padding: 'p-1', iconLabel: 'h-3.5 w-3.5' },
    lg: { icon: 'h-5 w-5', padding: 'p-1.5', iconLabel: 'h-4 w-4' },
  };
  
  const sizes = sizeClasses[size];
  
  if (showLabel) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <div className={cn('rounded', sizes.padding, config.bgColor)}>
          <Icon className={cn(sizes.iconLabel, config.color)} />
        </div>
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
      </div>
    );
  }
  
  // Show tooltip when label is not visible
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('rounded cursor-default', sizes.padding, config.bgColor, className)}>
          <Icon className={cn(sizes.icon, config.color)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}

export const allIssueTypes: IssueType[] = ['epic', 'user_story', 'task', 'subtask', 'bug'];
