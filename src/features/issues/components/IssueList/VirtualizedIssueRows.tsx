/**
 * VirtualizedIssueRows
 * Renders issue rows with virtual scrolling for large lists.
 * Only renders visible rows + overscan buffer, dramatically reducing DOM nodes.
 *
 * Uses @tanstack/react-virtual for efficient windowed rendering.
 * Falls back to regular rendering for small lists (< VIRTUALIZATION_THRESHOLD).
 */

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Issue } from '@/types';
import { IssueRow } from './IssueRow';

/** Only virtualize when the list exceeds this count */
const VIRTUALIZATION_THRESHOLD = 30;

/** Estimated height of each IssueRow in pixels */
const ESTIMATED_ROW_HEIGHT = 44;

/** Number of rows to render outside the visible area */
const OVERSCAN_COUNT = 10;

interface VirtualizedIssueRowsProps {
  issues: Issue[];
  selectedIssues: Set<string>;
  onSelectIssue: (issueId: string, selected: boolean) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, issueId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggingIssueId?: string | null;
  /** Max height of the virtualized container. Defaults to 600px. */
  maxHeight?: number;
}

export const VirtualizedIssueRows = React.memo(function VirtualizedIssueRows({
  issues,
  selectedIssues,
  onSelectIssue,
  draggable,
  onDragStart,
  onDragEnd,
  draggingIssueId,
  maxHeight = 600,
}: VirtualizedIssueRowsProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Skip virtualization for small lists
  if (issues.length < VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="divide-y divide-border">
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            isSelected={selectedIssues.has(issue.id)}
            onSelect={onSelectIssue}
            draggable={draggable}
            onDragStart={draggable && onDragStart ? (e) => onDragStart(e, issue.id) : undefined}
            onDragEnd={draggable ? onDragEnd : undefined}
            isDragging={draggingIssueId === issue.id}
          />
        ))}
      </div>
    );
  }

  return (
    <VirtualList
      parentRef={parentRef}
      issues={issues}
      selectedIssues={selectedIssues}
      onSelectIssue={onSelectIssue}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      draggingIssueId={draggingIssueId}
      maxHeight={maxHeight}
    />
  );
});

/** Inner component that uses the virtualizer */
function VirtualList({
  parentRef,
  issues,
  selectedIssues,
  onSelectIssue,
  draggable,
  onDragStart,
  onDragEnd,
  draggingIssueId,
  maxHeight,
}: VirtualizedIssueRowsProps & { parentRef: React.RefObject<HTMLDivElement | null> }) {
  const localRef = useRef<HTMLDivElement>(null);
  const scrollRef = parentRef?.current ? parentRef : localRef;

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  return (
    <div
      ref={localRef}
      className="overflow-y-auto"
      style={{ maxHeight }}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const issue = issues[virtualRow.index];
          return (
            <div
              key={issue.id}
              className="absolute top-0 left-0 w-full border-b border-border"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <IssueRow
                issue={issue}
                isSelected={selectedIssues.has(issue.id)}
                onSelect={onSelectIssue}
                draggable={draggable}
                onDragStart={draggable && onDragStart ? (e) => onDragStart(e, issue.id) : undefined}
                onDragEnd={draggable ? onDragEnd : undefined}
                isDragging={draggingIssueId === issue.id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
