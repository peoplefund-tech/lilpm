/**
 * Bulk Archive Dialog
 * Confirmation dialog for archiving multiple issues at once
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Archive, AlertTriangle } from 'lucide-react';

interface BulkArchiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    issueCount: number;
    retentionDays?: number;
    onConfirm: () => void;
}

export function BulkArchiveDialog({
    open,
    onOpenChange,
    issueCount,
    retentionDays = 30,
    onConfirm,
}: BulkArchiveDialogProps) {
    const { t } = useTranslation();

    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Archive className="h-5 w-5 text-destructive" />
                        {t('issues.archiveIssues', 'Archive Issues')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <p>
                            {t('issues.archiveConfirmation', {
                                count: issueCount,
                                defaultValue: `You are about to archive ${issueCount} issue(s).`,
                            })}
                        </p>
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-medium">
                                    {t('issues.archiveRetention', {
                                        days: retentionDays,
                                        defaultValue: `Archived items will be kept for ${retentionDays} days`,
                                    })}
                                </p>
                                <p className="mt-1 text-amber-700 dark:text-amber-300">
                                    {t('issues.archivePermanentDelete', 'After this period, they will be permanently deleted.')}
                                </p>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {t('common.cancel', 'Cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        <Archive className="h-4 w-4 mr-2" />
                        {t('issues.archiveConfirm', 'Yes, archive')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
