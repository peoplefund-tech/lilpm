import React, { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { History, RotateCcw, X, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
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
import { prdVersionService, type PRDVersionWithCreator } from '@/features/prd';
import { cn } from '@/lib/utils';

interface VersionHistoryPanelProps {
    prdId: string;
    currentContent?: string;
    onRestore?: (content: string, title: string) => void;
    triggerClassName?: string;
}

export function VersionHistoryPanel({
    prdId,
    currentContent,
    onRestore,
    triggerClassName,
}: VersionHistoryPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [versions, setVersions] = useState<PRDVersionWithCreator[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<PRDVersionWithCreator | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        if (isOpen && prdId) {
            loadVersions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, prdId]);

    const loadVersions = async () => {
        setIsLoading(true);
        try {
            const data = await prdVersionService.getVersions(prdId);
            setVersions(data);
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!selectedVersion) return;

        setIsRestoring(true);
        try {
            await prdVersionService.restoreVersion(prdId, selectedVersion.id);

            if (onRestore) {
                onRestore(selectedVersion.content || '', selectedVersion.title);
            }

            setShowRestoreConfirm(false);
            setSelectedVersion(null);
            setIsOpen(false);

            // Reload versions to show the restore entry
            await loadVersions();
        } catch (error) {
            console.error('Failed to restore version:', error);
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("gap-2", triggerClassName)}>
                        <History className="h-4 w-4" />
                        Version History
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Version History
                        </SheetTitle>
                    </SheetHeader>

                    <div className="mt-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No version history yet</p>
                                <p className="text-sm mt-1">Versions are created automatically as you edit</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[calc(100vh-180px)]">
                                <div className="space-y-2 pr-4">
                                    {versions.map((version, index) => (
                                        <div
                                            key={version.id}
                                            className={cn(
                                                "p-3 rounded-lg border cursor-pointer transition-colors",
                                                selectedVersion?.id === version.id
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                                            )}
                                            onClick={() => setSelectedVersion(version)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            v{version.version_number}
                                                        </span>
                                                        {index === 0 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Latest
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                                                        {version.change_summary || version.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                        {version.creator && (
                                                            <>
                                                                <Avatar className="h-4 w-4">
                                                                    <AvatarImage src={version.creator.avatar_url || undefined} />
                                                                    <AvatarFallback className="text-[8px]">
                                                                        {version.creator.name?.charAt(0) || '?'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span>{version.creator.name || version.creator.email}</span>
                                                                <span>•</span>
                                                            </>
                                                        )}
                                                        <span title={format(new Date(version.created_at), 'PPpp')}>
                                                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {selectedVersion && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                        // Could open a preview modal here
                                    }}
                                >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                </Button>
                                <Button
                                    className="flex-1 gap-2"
                                    onClick={() => setShowRestoreConfirm(true)}
                                    disabled={versions[0]?.id === selectedVersion.id}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Restore
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore the PRD to version {selectedVersion?.version_number}.
                            Your current content will be saved as a new version before restoring.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
                            {isRestoring ? 'Restoring...' : 'Restore'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
