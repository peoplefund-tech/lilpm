import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Issue, IssueStatus } from '@/types';
import { IssueRow } from './IssueRow';
import { StatusIcon, statusLabels, allStatuses } from '@/features/issues/components/shared/IssueIcons';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IssueListProps {
  issues: Issue[];
  groupBy: 'status' | 'priority' | 'assignee' | 'project' | 'cycle' | 'none';
  selectedIssues: Set<string>;
  onSelectIssue: (issueId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onCreateIssue?: (status?: IssueStatus) => void;
  onStatusChange?: (issueId: string, newStatus: IssueStatus) => void;
}

export function IssueList({
  issues,
  groupBy,
  selectedIssues,
  onSelectIssue,
  onSelectAll,
  onCreateIssue,
  onStatusChange,
}: IssueListProps) {
  const { t } = useTranslation();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('issueId', issueId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIssueId(issueId);
  };

  const handleDragEnd = () => {
    setDraggingIssueId(null);
    setDragOverGroup(null);
  };

  const handleDragOver = (e: React.DragEvent, groupKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroup !== groupKey) {
      setDragOverGroup(groupKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverGroup(null);
    }
  };

  const handleDrop = (e: React.DragEvent, groupKey: string) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('issueId');
    setDragOverGroup(null);
    setDraggingIssueId(null);

    if (issueId && onStatusChange && groupBy === 'status') {
      const issue = issues.find(i => i.id === issueId);
      if (issue && issue.status !== groupKey) {
        onStatusChange(issueId, groupKey as IssueStatus);
      }
    }
  };

  // Group issues
  const groupedIssues = React.useMemo(() => {
    if (groupBy === 'none') {
      return { 'all': issues };
    }

    if (groupBy === 'status') {
      const groups: Record<string, Issue[]> = {};
      allStatuses.forEach((status) => {
        groups[status] = [];
      });
      issues.forEach((issue) => {
        if (!groups[issue.status]) {
          groups[issue.status] = [];
        }
        groups[issue.status].push(issue);
      });
      return groups;
    }

    // Default grouping
    return issues.reduce((acc, issue) => {
      const key = groupBy === 'priority' ? issue.priority :
        groupBy === 'assignee' ? (issue.assignee?.id || 'unassigned') :
          groupBy === 'project' ? (issue.projectId || 'no-project') :
            groupBy === 'cycle' ? (issue.cycleId || 'no-cycle') : 'all';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(issue);
      return acc;
    }, {} as Record<string, Issue[]>);
  }, [issues, groupBy]);

  if (groupBy === 'none') {
    return (
      <div className="divide-y divide-border">
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            isSelected={selectedIssues.has(issue.id)}
            onSelect={onSelectIssue}
          />
        ))}
        {issues.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p>{t('issues.noIssues')}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => onCreateIssue?.()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('issues.newIssue')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const isDragEnabled = groupBy === 'status' && !!onStatusChange;

  return (
    <div className="space-y-2">
      {Object.entries(groupedIssues).map(([groupKey, groupIssues]) => {
        const isCollapsed = collapsedGroups.has(groupKey);
        const count = groupIssues.length;
        const isDragOver = dragOverGroup === groupKey;

        return (
          <div
            key={groupKey}
            className={cn(
              "border rounded-lg overflow-hidden transition-colors",
              isDragOver
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border"
            )}
            onDragOver={isDragEnabled ? (e) => handleDragOver(e, groupKey) : undefined}
            onDragLeave={isDragEnabled ? handleDragLeave : undefined}
            onDrop={isDragEnabled ? (e) => handleDrop(e, groupKey) : undefined}
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(groupKey)}
              className={cn(
                "flex items-center gap-2 w-full px-4 py-2 hover:bg-muted transition-colors text-left group",
                isDragOver ? "bg-primary/10" : "bg-muted/50"
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}

              {groupBy === 'status' && (
                <>
                  <StatusIcon status={groupKey as IssueStatus} />
                  <span className="font-medium text-sm">
                    {statusLabels[groupKey as IssueStatus]}
                  </span>
                </>
              )}

              {groupBy === 'cycle' && (
                <span className="font-medium text-sm">
                  {groupKey === 'no-cycle' ? t('issues.backlog', 'Backlog') : groupKey}
                </span>
              )}

              {groupBy !== 'status' && groupBy !== 'cycle' && (
                <span className="font-medium text-sm capitalize">
                  {groupKey}
                </span>
              )}

              <span className="text-xs text-muted-foreground ml-1">
                {count}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateIssue?.(groupBy === 'status' ? groupKey as IssueStatus : undefined);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </button>

            {/* Group Content */}
            {!isCollapsed && (
              <div className="divide-y divide-border">
                {groupIssues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    isSelected={selectedIssues.has(issue.id)}
                    onSelect={onSelectIssue}
                    draggable={isDragEnabled}
                    onDragStart={isDragEnabled ? (e) => handleDragStart(e, issue.id) : undefined}
                    onDragEnd={isDragEnabled ? handleDragEnd : undefined}
                    isDragging={draggingIssueId === issue.id}
                  />
                ))}
                {groupIssues.length === 0 && (
                  <div className={cn(
                    "py-8 text-center text-sm transition-colors",
                    isDragOver ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {isDragOver
                      ? t('issues.dropHere', 'Drop here')
                      : t('issues.noIssues')
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
