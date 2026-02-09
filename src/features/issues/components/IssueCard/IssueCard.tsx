import React from 'react';
import type { Issue, IssueType } from '@/types';
import { PriorityIcon } from '@/features/issues/components/shared/IssueIcons';
import { IssueTypeIcon, issueTypeConfig } from '@/features/issues/components/shared/IssueTypeIcon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IssueFocusIndicator } from '@/components/collaboration';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IssueCardProps {
  issue: Issue;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export function IssueCard({ issue, onClick, onDragStart, onDragEnd, isDragging }: IssueCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-md p-3 cursor-pointer",
        "hover:border-primary/50 hover:shadow-sm transition-all",
        "active:cursor-grabbing",
        isDragging && "opacity-50 scale-95 rotate-1"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Issue Type with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <IssueTypeIcon type={((issue as any).type as IssueType) || 'task'} size="sm" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {issueTypeConfig[((issue as any).type as IssueType) || 'task']?.label || 'Task'}
          </TooltipContent>
        </Tooltip>
        <PriorityIcon priority={issue.priority} className="flex-shrink-0" />
        <span className="text-xs text-muted-foreground font-mono">
          {issue.identifier}
        </span>
        {/* Show who's viewing this issue */}
        <div className="ml-auto">
          <IssueFocusIndicator issueId={issue.id} />
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium line-clamp-2 mb-3">
        {issue.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Labels */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {issue.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium truncate max-w-20"
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color
              }}
            >
              {label.name}
            </span>
          ))}
        </div>

        {/* Assignee */}
        {issue.assignee ? (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={issue.assignee.avatarUrl} />
            <AvatarFallback className="text-2xs">
              {issue.assignee.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}
