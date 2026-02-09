import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Edit2, Save, Loader2, User, Calendar, Flag, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { IssueTypeIcon, allIssueTypes } from '@/components/issues';
import type { Issue, IssuePriority, IssueType } from '@/types';
import { cn } from '@/lib/utils';

interface TicketDetailModalProps {
    issue: Partial<Issue>;
    open: boolean;
    onClose: () => void;
    onSave?: (issue: Partial<Issue>) => Promise<void>;
    readOnly?: boolean;
}

export function TicketDetailModal({
    issue,
    open,
    onClose,
    onSave,
    readOnly = false,
}: TicketDetailModalProps) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editedIssue, setEditedIssue] = useState<Partial<Issue>>(issue);

    useEffect(() => {
        setEditedIssue(issue);
        setIsEditing(false);
    }, [issue]);

    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true);
        try {
            await onSave(editedIssue);
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    const priorityColors: Record<string, string> = {
        urgent: 'border-red-500 text-red-500 bg-red-500/10',
        high: 'border-orange-500 text-orange-500 bg-orange-500/10',
        medium: 'border-yellow-500 text-yellow-500 bg-yellow-500/10',
        low: 'border-blue-500 text-blue-500 bg-blue-500/10',
        none: 'border-muted-foreground text-muted-foreground',
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <IssueTypeIcon type={issue.type || 'task'} size="md" />
                            <DialogTitle className="text-lg">
                                {isEditing ? (
                                    <Input
                                        value={editedIssue.title || ''}
                                        onChange={(e) => setEditedIssue({ ...editedIssue, title: e.target.value })}
                                        className="text-lg font-semibold h-9"
                                    />
                                ) : (
                                    issue.title || t('issues.untitled', 'Untitled Issue')
                                )}
                            </DialogTitle>
                        </div>
                        {!readOnly && (
                            <div className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditedIssue(issue);
                                                setIsEditing(false);
                                            }}
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                            ) : (
                                                <Save className="h-4 w-4 mr-1" />
                                            )}
                                            {t('common.save')}
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        {t('common.edit')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5" />
                                {t('issues.type', 'Type')}
                            </label>
                            {isEditing ? (
                                <Select
                                    value={editedIssue.type || 'task'}
                                    onValueChange={(v) => setEditedIssue({ ...editedIssue, type: v as IssueType })}
                                >
                                    <SelectTrigger className="h-9">
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
                            ) : (
                                <Badge variant="outline" className="text-sm">
                                    <IssueTypeIcon type={issue.type || 'task'} size="sm" showLabel />
                                </Badge>
                            )}
                        </div>

                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Flag className="h-3.5 w-3.5" />
                                {t('issues.priority', 'Priority')}
                            </label>
                            {isEditing ? (
                                <Select
                                    value={editedIssue.priority || 'medium'}
                                    onValueChange={(v) => setEditedIssue({ ...editedIssue, priority: v as IssuePriority })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
                                        <SelectItem value="high">{t('priority.high')}</SelectItem>
                                        <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                                        <SelectItem value="low">{t('priority.low')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className={cn('text-sm', priorityColors[issue.priority || 'medium'])}
                                >
                                    {t(`priority.${issue.priority || 'medium'}`)}
                                </Badge>
                            )}
                        </div>

                        {/* Estimate */}
                        {(issue.estimate || isEditing) && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {t('issues.estimate', 'Estimate')}
                                </label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={editedIssue.estimate || ''}
                                        onChange={(e) => setEditedIssue({ ...editedIssue, estimate: parseInt(e.target.value) || undefined })}
                                        placeholder="Points"
                                        className="h-9"
                                    />
                                ) : (
                                    <Badge variant="secondary">
                                        {issue.estimate} {t('issues.points', 'pts')}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                            {t('issues.description', 'Description')}
                        </label>
                        {isEditing ? (
                            <Textarea
                                value={editedIssue.description || ''}
                                onChange={(e) => setEditedIssue({ ...editedIssue, description: e.target.value })}
                                placeholder={t('issues.addDescription', 'Add a description...')}
                                className="min-h-[120px]"
                                rows={6}
                            />
                        ) : (
                            <div className="bg-muted/50 rounded-lg p-4 min-h-[80px]">
                                <p className="text-sm whitespace-pre-wrap">
                                    {issue.description || (
                                        <span className="text-muted-foreground italic">
                                            {t('issues.noDescription', 'No description provided')}
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Acceptance Criteria (if exists) */}
                    {issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0 && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                {t('issues.acceptanceCriteria', 'Acceptance Criteria')}
                            </label>
                            <div className="bg-muted/50 rounded-lg p-4">
                                <ul className="space-y-2">
                                    {issue.acceptanceCriteria.map((criteria, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span>{criteria}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
