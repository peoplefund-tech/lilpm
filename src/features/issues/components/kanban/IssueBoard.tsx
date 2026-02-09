import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Issue, IssueStatus } from '@/types';
import { StatusIcon, statusLabels, allStatuses } from '@/features/issues/components/shared/IssueIcons';
import { IssueCard } from '../IssueCard/IssueCard';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IssueBoardProps {
  issues: Issue[];
  onIssueClick?: (issueId: string) => void;
  onStatusChange?: (issueId: string, newStatus: IssueStatus) => void;
  onCreateIssue?: (status: IssueStatus) => void;
}

export function IssueBoard({
  issues,
  onIssueClick,
  onStatusChange,
  onCreateIssue,
}: IssueBoardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);

  // Group issues by status
  const columns = React.useMemo(() => {
    const grouped: Record<IssueStatus, Issue[]> = {
      'backlog': [],
      'todo': [],
      'in_progress': [],
      'in_review': [],
      'done': [],
      'cancelled': [],
    };

    issues.forEach((issue) => {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    });

    return grouped;
  }, [issues]);

  // Simple column ordering - exclude cancelled from main view
  const visibleStatuses: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('issueId', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIssueId(issueId);

    // Add a slight delay for visual feedback
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggingIssueId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('issueId');
    setDragOverColumn(null);
    setDraggingIssueId(null);

    if (issueId && onStatusChange) {
      // Find the issue to check if status is actually changing
      const issue = issues.find(i => i.id === issueId);
      if (issue && issue.status !== status) {
        onStatusChange(issueId, status);
      }
    }
  };

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-x-auto h-full snap-x snap-mandatory sm:snap-none touch-pan-x">
      {visibleStatuses.map((status) => (
        <div
          key={status}
          className={cn(
            "flex-shrink-0 w-[280px] sm:w-72 flex flex-col rounded-lg transition-colors duration-200",
            dragOverColumn === status
              ? "bg-primary/10 ring-2 ring-primary/50"
              : "bg-muted/30"
          )}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
        >
          {/* Column Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border sticky top-0 bg-inherit backdrop-blur-sm z-10 rounded-t-lg">
            <StatusIcon status={status} />
            <span className="font-medium text-sm">{statusLabels[status]}</span>
            <span className="text-xs text-muted-foreground ml-1">
              {columns[status].length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={() => onCreateIssue?.(status)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Column Content */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
            {columns[status].map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={() => navigate(`/issue/${issue.id}`)}
                onDragStart={(e) => handleDragStart(e, issue.id)}
                onDragEnd={handleDragEnd}
                isDragging={draggingIssueId === issue.id}
              />
            ))}
            {columns[status].length === 0 && (
              <div className={cn(
                "py-8 text-center text-muted-foreground text-xs rounded-md transition-colors",
                dragOverColumn === status && "bg-primary/5"
              )}>
                {dragOverColumn === status
                  ? t('issues.dropHere', 'Drop here')
                  : t('issues.noIssues')
                }
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
