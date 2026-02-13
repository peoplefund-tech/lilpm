/**
 * Archive Page
 * 
 * Displays all archived items (issues, PRDs) with 30-day retention countdown.
 * Allows users to restore or permanently delete items.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import {
    Archive,
    ArchiveRestore,
    Trash2,
    Loader2,
    FileText,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

interface ArchivedItem {
    item_type: 'issue' | 'prd';
    id: string;
    title: string;
    archived_at: string;
    days_until_deletion: number;
}

export function ArchivePage() {
    const { t, i18n } = useTranslation();
    const { currentTeam } = useTeamStore();
    const dateLocale = i18n.language === 'ko' ? ko : enUS;

    const [items, setItems] = useState<ArchivedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showRestoreDialog, setShowRestoreDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Load archived items
    const loadArchivedItems = useCallback(async () => {
        if (!currentTeam?.id) return;

        setLoading(true);
        try {
            // Fetch archived issues and PRDs in parallel
            const [issuesRes, prdsRes] = await Promise.all([
                apiClient.get<any>(`/teams/${currentTeam.id}/issues?archived=true`),
                apiClient.get<any>(`/${currentTeam.id}/prd?includeArchived=true`),
            ]);

            const items: ArchivedItem[] = [];

            // Process archived issues
            if (issuesRes.success && issuesRes.data?.data) {
                const issues = Array.isArray(issuesRes.data.data) ? issuesRes.data.data : [];
                issues.forEach((issue: any) => {
                    if (issue.archivedAt) {
                        const archivedDate = new Date(issue.archivedAt);
                        const now = new Date();
                        const daysUntilDeletion = Math.max(0, 30 - Math.floor((now.getTime() - archivedDate.getTime()) / (1000 * 60 * 60 * 24)));

                        items.push({
                            item_type: 'issue',
                            id: issue.id,
                            title: issue.title || issue.identifier,
                            archived_at: issue.archivedAt,
                            days_until_deletion: daysUntilDeletion,
                        });
                    }
                });
            }

            // Process archived PRDs
            if (prdsRes.success && prdsRes.data) {
                const prds = Array.isArray(prdsRes.data) ? prdsRes.data : [];
                prds.forEach((prd: any) => {
                    if (prd.archivedAt) {
                        const archivedDate = new Date(prd.archivedAt);
                        const now = new Date();
                        const daysUntilDeletion = Math.max(0, 30 - Math.floor((now.getTime() - archivedDate.getTime()) / (1000 * 60 * 60 * 24)));

                        items.push({
                            item_type: 'prd',
                            id: prd.id,
                            title: prd.title || 'Untitled PRD',
                            archived_at: prd.archivedAt,
                            days_until_deletion: daysUntilDeletion,
                        });
                    }
                });
            }

            setItems(items);
        } catch (error) {
            console.error('Failed to load archived items:', error);
            toast.error(t('archive.loadError', 'Failed to load archived items'));
        } finally {
            setLoading(false);
        }
    }, [currentTeam?.id, t]);

    useEffect(() => {
        loadArchivedItems();
    }, [loadArchivedItems]);

    // Toggle selection
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    // Toggle all
    const toggleAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map((item) => item.id)));
        }
    };

    // Restore selected items
    const handleRestore = async () => {
        setProcessing(true);
        try {
            const selectedItems = items.filter((item) => selectedIds.has(item.id));

            for (const item of selectedItems) {
                if (item.item_type === 'issue') {
                    // For issues, update with archivedAt: null
                    const res = await apiClient.put(`/teams/${currentTeam?.id}/issues/${item.id}`, {
                        archivedAt: null,
                    });
                    if (!res.success) throw new Error(res.error || 'Failed to restore issue');
                } else if (item.item_type === 'prd') {
                    // For PRDs, update with archivedAt: null
                    const res = await apiClient.put(`/prd/${item.id}`, {
                        archivedAt: null,
                    });
                    if (!res.success) throw new Error(res.error || 'Failed to restore PRD');
                }
            }

            toast.success(
                t('archive.restored', { count: selectedItems.length }),
                { description: t('archive.restoredDesc', 'Items have been restored') }
            );

            setSelectedIds(new Set());
            loadArchivedItems();
        } catch (error) {
            console.error('Failed to restore items:', error);
            toast.error(t('archive.restoreError', 'Failed to restore items'));
        } finally {
            setProcessing(false);
            setShowRestoreDialog(false);
        }
    };

    // Permanently delete selected items
    const handlePermanentDelete = async () => {
        setProcessing(true);
        try {
            const selectedItems = items.filter((item) => selectedIds.has(item.id));

            for (const item of selectedItems) {
                if (item.item_type === 'issue') {
                    // Permanently delete issue
                    const res = await apiClient.delete(`/teams/${currentTeam?.id}/issues/${item.id}`);
                    if (!res.success) throw new Error(res.error || 'Failed to delete issue');
                } else if (item.item_type === 'prd') {
                    // Permanently delete PRD
                    const res = await apiClient.delete(`/prd/${item.id}`);
                    if (!res.success) throw new Error(res.error || 'Failed to delete PRD');
                }
            }

            toast.success(
                t('archive.deleted', { count: selectedItems.length }),
                { description: t('archive.deletedDesc', 'Items have been permanently deleted') }
            );

            setSelectedIds(new Set());
            loadArchivedItems();
        } catch (error) {
            console.error('Failed to delete items:', error);
            toast.error(t('archive.deleteError', 'Failed to delete items'));
        } finally {
            setProcessing(false);
            setShowDeleteDialog(false);
        }
    };

    return (
        <AppLayout>
            <div className="p-6 max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Archive className="h-8 w-8 text-orange-500" />
                        <h1 className="text-2xl font-bold">{t('archive.title', 'Archive')}</h1>
                    </div>
                    <p className="text-slate-400">
                        {t('archive.description', 'Archived items are kept for 30 days before permanent deletion.')}
                    </p>
                </div>

                {/* Actions Bar */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-[#121215] rounded-lg">
                        <span className="text-sm font-medium">
                            {t('archive.selected', { count: selectedIds.size })}
                        </span>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowRestoreDialog(true)}
                            disabled={processing}
                        >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            {t('archive.restore', 'Restore')}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={processing}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('archive.deleteForever', 'Delete Forever')}
                        </Button>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500/50 mb-4" />
                        <h2 className="text-xl font-medium mb-2">
                            {t('archive.empty', 'No archived items')}
                        </h2>
                        <p className="text-slate-400">
                            {t('archive.emptyDesc', 'Archived items will appear here.')}
                        </p>
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={selectedIds.size === items.length}
                                            onCheckedChange={toggleAll}
                                        />
                                    </TableHead>
                                    <TableHead>{t('archive.type', 'Type')}</TableHead>
                                    <TableHead>{t('archive.name', 'Name')}</TableHead>
                                    <TableHead>{t('archive.archivedAt', 'Archived')}</TableHead>
                                    <TableHead className="text-right">
                                        {t('archive.daysLeft', 'Days Left')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(item.id)}
                                                onCheckedChange={() => toggleSelection(item.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {item.item_type === 'issue' ? (
                                                    <AlertCircle className="h-3 w-3 mr-1" />
                                                ) : (
                                                    <FileText className="h-3 w-3 mr-1" />
                                                )}
                                                {item.item_type === 'issue' ? 'Issue' : 'PRD'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{item.title}</TableCell>
                                        <TableCell className="text-slate-400">
                                            {format(new Date(item.archived_at), 'PPP', { locale: dateLocale })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge
                                                variant={item.days_until_deletion <= 7 ? 'destructive' : 'secondary'}
                                            >
                                                {item.days_until_deletion} {t('archive.days', 'days')}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Restore Confirmation Dialog */}
            <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('archive.restoreConfirm', 'Restore items?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('archive.restoreConfirmDesc',
                                'These items will be restored to their original location.'
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>
                            {t('common.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} disabled={processing}>
                            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('archive.restore', 'Restore')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            {t('archive.deleteConfirm', 'Permanently delete items?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('archive.deleteConfirmDesc',
                                'This action cannot be undone. These items will be permanently deleted.'
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>
                            {t('common.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handlePermanentDelete}
                            disabled={processing}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t('archive.deleteForever', 'Delete Forever')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

export default ArchivePage;
