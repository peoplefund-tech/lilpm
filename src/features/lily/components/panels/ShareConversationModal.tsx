import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Link, Globe, Lock, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

interface ShareConversationModalProps {
    open: boolean;
    onClose: () => void;
    conversationId: string;
    conversationTitle?: string;
}

interface ShareInfo {
    id: string;
    shareToken: string;
    accessLevel: 'view' | 'edit';
    expiresAt: string | null;
}

export function ShareConversationModal({
    open,
    onClose,
    conversationId,
    conversationTitle,
}: ShareConversationModalProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
    const [copied, setCopied] = useState(false);
    const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');

    const shareUrl = shareInfo
        ? `${window.location.origin}/lily/shared/${shareInfo.shareToken}`
        : '';

    const createShare = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.post<{
                id: string;
                shareToken: string;
                accessLevel: 'view' | 'edit';
                expiresAt: string | null;
                createdAt: string;
            }>(`/conversations/${conversationId}/share`, {
                accessLevel,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to create share');
            }

            const data = response.data;
            setShareInfo({
                id: data.id,
                shareToken: data.shareToken,
                accessLevel: data.accessLevel,
                expiresAt: data.expiresAt,
            });

            toast.success(t('lily.shareLinkCreated', 'Share link created!'));
        } catch (error) {
            console.error('Failed to create share:', error);
            toast.error(t('lily.shareCreateFailed', 'Failed to create share link'));
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success(t('common.copied', 'Copied to clipboard!'));
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast.error(t('common.copyFailed', 'Failed to copy'));
        }
    };

    const revokeShare = async () => {
        if (!shareInfo) return;

        setIsLoading(true);
        try {
            const response = await apiClient.delete<void>(
                `/conversations/${conversationId}/share/${shareInfo.id}`
            );

            if (!response.success) {
                throw new Error(response.error || 'Failed to revoke share');
            }

            setShareInfo(null);
            toast.success(t('lily.shareRevoked', 'Share link revoked'));
        } catch (error) {
            console.error('Failed to revoke share:', error);
            toast.error(t('lily.shareRevokeFailed', 'Failed to revoke share'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5" />
                        {t('lily.shareConversation', 'Share Conversation')}
                    </DialogTitle>
                    <DialogDescription>
                        {conversationTitle || t('lily.untitledConversation', 'Untitled Conversation')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {!shareInfo ? (
                        <>
                            {/* Access Type */}
                            <div className="space-y-2">
                                <Label>{t('lily.accessType', 'Access Type')}</Label>
                                <Select
                                    value={accessLevel}
                                    onValueChange={(v) => setAccessLevel(v as 'view' | 'edit')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="view">
                                            <div className="flex items-center gap-2">
                                                <Lock className="h-4 w-4" />
                                                {t('lily.viewOnly', 'View only')}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="edit">
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                {t('lily.canEdit', 'Can edit')}
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Create Button */}
                            <Button
                                onClick={createShare}
                                disabled={isLoading}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Link className="h-4 w-4 mr-2" />
                                )}
                                {t('lily.createShareLink', 'Create Share Link')}
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Share URL */}
                            <div className="space-y-2">
                                <Label>{t('lily.shareLink', 'Share Link')}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={shareUrl}
                                        readOnly
                                        className="font-mono text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={copyToClipboard}
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Share Info */}
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                <div className="flex items-center gap-1">
                                    <Lock className="h-4 w-4" />
                                    {t('lily.shareLink', 'Share Link')}
                                </div>
                                <div className="flex items-center gap-1">
                                    {shareInfo.accessLevel === 'view'
                                        ? t('lily.viewOnly', 'View only')
                                        : t('lily.canEdit', 'Can edit')}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={revokeShare}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    {t('lily.revokeLink', 'Revoke Link')}
                                </Button>
                                <Button onClick={onClose} className="flex-1">
                                    {t('common.done', 'Done')}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
