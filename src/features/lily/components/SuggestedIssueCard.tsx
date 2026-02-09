import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Ticket,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { IssueTypeIcon, allIssueTypes } from '@/components/issues';
import { TicketDetailModal } from './TicketDetailModal';
import type { Issue, IssuePriority, IssueStatus, IssueType } from '@/types';

interface SuggestedIssue {
  title?: string;
  description?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  estimate?: number;
  type?: IssueType;
}

interface SuggestedIssueCardProps {
  issue: SuggestedIssue;
  index: number;
  onAccept: (issue: SuggestedIssue) => void;
  onReject: () => void;
  isCreating?: boolean;
}

export function SuggestedIssueCard({
  issue,
  index,
  onAccept,
  onReject,
  isCreating
}: SuggestedIssueCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedIssue, setEditedIssue] = useState<SuggestedIssue>(issue);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    setEditedIssue(issue);
  }, [issue]);

  const handleAccept = () => {
    onAccept(isEditing ? editedIssue : issue);
    setIsEditing(false);
  };

  const priorityColors: Record<string, string> = {
    urgent: 'border-red-500 text-red-500 bg-red-500/10',
    high: 'border-orange-500 text-orange-500 bg-orange-500/10',
    medium: 'border-yellow-500 text-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 text-blue-500 bg-blue-500/10',
    none: 'border-muted-foreground text-muted-foreground',
  };

  return (
    <>
      <TicketDetailModal
        issue={editedIssue}
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onSave={async (updated) => {
          setEditedIssue(updated as SuggestedIssue);
        }}
      />
      <Card className={cn(
        "transition-all",
        isExpanded && "ring-2 ring-primary/20"
      )}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="p-3 pb-2">
            <div className="flex items-start gap-3">
              <IssueTypeIcon type={issue.type || 'task'} size="sm" />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={editedIssue.type || 'task'}
                        onValueChange={(v) => setEditedIssue({ ...editedIssue, type: v as IssueType })}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue>
                            <IssueTypeIcon type={editedIssue.type || 'task'} size="sm" showLabel />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allIssueTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              <IssueTypeIcon type={type} size="sm" showLabel />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={editedIssue.title || ''}
                      onChange={(e) => setEditedIssue({ ...editedIssue, title: e.target.value })}
                      className="h-8 text-sm font-medium"
                      placeholder={t('issues.issueTitle')}
                    />
                  </div>
                ) : (
                  <CardTitle className="text-sm font-medium leading-tight">
                    {issue.title || t('issues.untitled', 'Untitled Issue')}
                  </CardTitle>
                )}

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {!isEditing && issue.type && (
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      {t(`issueType.${issue.type}`, issue.type)}
                    </Badge>
                  )}
                  {isEditing ? (
                    <Select
                      value={editedIssue.priority || 'medium'}
                      onValueChange={(v) => setEditedIssue({ ...editedIssue, priority: v as IssuePriority })}
                    >
                      <SelectTrigger className="h-6 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
                        <SelectItem value="high">{t('priority.high')}</SelectItem>
                        <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                        <SelectItem value="low">{t('priority.low')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : issue.priority && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs py-0 h-5", priorityColors[issue.priority])}
                    >
                      {t(`priority.${issue.priority}`)}
                    </Badge>
                  )}

                  {issue.estimate && (
                    <Badge variant="secondary" className="text-xs py-0 h-5">
                      {issue.estimate} {t('issues.points', 'pts')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="p-3 pt-0">
              {isEditing ? (
                <Textarea
                  value={editedIssue.description || ''}
                  onChange={(e) => setEditedIssue({ ...editedIssue, description: e.target.value })}
                  placeholder={t('issues.addDescription')}
                  className="text-sm min-h-[80px]"
                  rows={4}
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {issue.description || t('issues.noDescription', 'No description provided')}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="gap-1.5 h-8"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditing ? t('common.cancel') : t('common.edit')}
                </Button>

                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReject}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('lily.reject', 'Reject')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAccept}
                    disabled={isCreating || !editedIssue.title?.trim()}
                    className="h-8 gap-1.5"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {t('lily.createIssue', 'Create Issue')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>

          {/* Collapsed state action buttons */}
          {!isExpanded && (
            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject();
                  }}
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAccept();
                  }}
                  disabled={isCreating}
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Collapsible>
      </Card>
    </>
  );
}

interface SuggestedIssuesListProps {
  issues: SuggestedIssue[];
  onAcceptIssue: (index: number, issue: SuggestedIssue) => Promise<void>;
  onRejectIssue: (index: number) => void;
  onAcceptAll: () => Promise<void>;
}

export function SuggestedIssuesList({
  issues,
  onAcceptIssue,
  onRejectIssue,
  onAcceptAll,
}: SuggestedIssuesListProps) {
  const { t } = useTranslation();
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);

  const handleAccept = async (index: number, issue: SuggestedIssue) => {
    setCreatingIndex(index);
    try {
      await onAcceptIssue(index, issue);
    } finally {
      setCreatingIndex(null);
    }
  };

  const handleAcceptAll = async () => {
    setIsAcceptingAll(true);
    try {
      await onAcceptAll();
    } finally {
      setIsAcceptingAll(false);
    }
  };

  if (issues.length === 0) return null;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          {t('lily.suggestedIssues', 'Suggested Issues')} ({issues.length})
        </h4>

        {issues.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcceptAll}
            disabled={isAcceptingAll}
            className="gap-1.5 h-8"
          >
            {isAcceptingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t('lily.createAll', 'Create All')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {issues.map((issue, index) => (
          <SuggestedIssueCard
            key={index}
            issue={issue}
            index={index}
            onAccept={(editedIssue) => handleAccept(index, editedIssue)}
            onReject={() => onRejectIssue(index)}
            isCreating={creatingIndex === index}
          />
        ))}
      </div>
    </div>
  );
}
