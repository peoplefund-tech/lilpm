import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Issue, IssueStatus } from '@/types';
import { StatusIcon, statusLabels } from '@/features/issues/components/shared/IssueIcons';
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

/** Individual kanban column - memoized to prevent re-render when other columns change */
const KanbanColumn = React.memo(function KanbanColumn({
  status,
  issues,
  isDragOver,
  draggingIssueId,
  onNavigate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onCreateIssue,
}: {
  status: IssueStatus;
  issues: Issue[];
  isDragOver: boolean;
  draggingIssueId: string | null;
  onNavigate: (issueId: string) => void;
  onDragStart: (e: React.DragEvent, issueId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onCreateIssue?: (status: IssueStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex-shrink-0 w-[280px] sm:w-72 flex flex-col rounded-lg transition-colors duration-200",
        isDragOver
          ? "bg-primary/10 ring-2 ring-primary/50"
          : "bg-white/5"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 sticky top-0 bg-inherit backdrop-blur-sm z-10 rounded-t-lg">
        <StatusIcon status={status} />
        <span className="font-medium text-sm">{statusLabels[status]}</span>
        <span className="text-xs text-slate-400 ml-1">
          {issues.length}
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
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onClick={() => onNavigate(issue.id)}
            onDragStart={(e) => onDragStart(e, issue.id)}
            onDragEnd={onDragEnd}
            isDragging={draggingIssueId === issue.id}
          />
        ))}
        {issues.length === 0 && (
          <div className={cn(
            "py-8 text-center text-slate-400 text-xs rounded-xl transition-colors",
            isDragOver && "bg-primary/5"
          )}>
            {isDragOver
              ? t('issues.dropHere', 'Drop here')
              : t('issues.noIssues')
            }
          </div>
        )}
      </div>
    </div>
  );
});

export function IssueBoard({
  issues,
  onIssueClick,
  onStatusChange,
  onCreateIssue,
}: IssueBoardProps) {
  const navigate = useNavigate();
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);

  // Group issues by status
  const columns = useMemo(() => {
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
  const visibleStatuses: IssueStatus[] = useMemo(
    () => ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
    []
  );

  const handleNavigate = useCallback((issueId: string) => {
    navigate(`/issue/${issueId}`);
  }, [navigate]);

  const handleDragStart = useCallback((e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('issueId', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIssueId(issueId);

    // Add a slight delay for visual feedback
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggingIssueId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn((prev) => prev !== status ? status : prev);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('issueId');
    setDragOverColumn(null);
    setDraggingIssueId(null);

    if (issueId && onStatusChange) {
      const issue = issues.find(i => i.id === issueId);
      if (issue && issue.status !== status) {
        onStatusChange(issueId, status);
      }
    }
  }, [issues, onStatusChange]);

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-x-auto h-full snap-x snap-mandatory sm:snap-none touch-pan-x">
      {visibleStatuses.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          issues={columns[status]}
          isDragOver={dragOverColumn === status}
          draggingIssueId={draggingIssueId}
          onNavigate={handleNavigate}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
          onCreateIssue={onCreateIssue}
        />
      ))}
    </div>
  );
}
