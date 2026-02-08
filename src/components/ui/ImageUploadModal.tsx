import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    Upload,
    X,
    Image as ImageIcon,
    ZoomIn,
    Loader2,
    Check,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpload: (files: File[]) => void;
    maxFiles?: number;
    maxSizeMB?: number;
}

interface PreviewImage {
    id: string;
    file: File;
    previewUrl: string;
    isUploading?: boolean;
    error?: string;
}

export function ImageUploadModal({
    open,
    onOpenChange,
    onUpload,
    maxFiles = 10,
    maxSizeMB = 5,
}: ImageUploadModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState<PreviewImage[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const addFiles = useCallback((files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles: PreviewImage[] = [];

        for (const file of fileArray) {
            // Check file type
            if (!file.type.startsWith('image/')) {
                toast.error(t('upload.invalidType', `${file.name} is not an image`));
                continue;
            }

            // Check file size
            if (file.size > maxSizeMB * 1024 * 1024) {
                toast.error(t('upload.tooLarge', `${file.name} exceeds ${maxSizeMB}MB limit`));
                continue;
            }

            // Check max files
            if (images.length + validFiles.length >= maxFiles) {
                toast.error(t('upload.maxFiles', `Maximum ${maxFiles} images allowed`));
                break;
            }

            validFiles.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                previewUrl: URL.createObjectURL(file),
            });
        }

        setImages(prev => [...prev, ...validFiles]);
    }, [images.length, maxFiles, maxSizeMB, t]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    }, [addFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
            e.target.value = '';
        }
    }, [addFiles]);

    const removeImage = useCallback((id: string) => {
        setImages(prev => {
            const image = prev.find(img => img.id === id);
            if (image) {
                URL.revokeObjectURL(image.previewUrl);
            }
            return prev.filter(img => img.id !== id);
        });
    }, []);

    const handleConfirm = async () => {
        if (images.length === 0) return;

        setIsUploading(true);
        try {
            const files = images.map(img => img.file);
            await onUpload(files);

            // Cleanup
            images.forEach(img => URL.revokeObjectURL(img.previewUrl));
            setImages([]);
            onOpenChange(false);
            toast.success(t('upload.success', 'Images uploaded successfully'));
        } catch (error) {
            toast.error(t('upload.error', 'Failed to upload images'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            {t('upload.title', 'Upload Images')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('upload.description', `Drag and drop or select up to ${maxFiles} images (max ${maxSizeMB}MB each)`)}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Drop Zone */}
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                            images.length >= maxFiles && "opacity-50 cursor-not-allowed"
                        )}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => images.length < maxFiles && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={images.length >= maxFiles}
                        />
                        <Upload className={cn(
                            "h-10 w-10 mx-auto mb-3",
                            isDragging ? "text-primary" : "text-muted-foreground"
                        )} />
                        <p className="text-sm text-muted-foreground">
                            {isDragging
                                ? t('upload.dropHere', 'Drop images here')
                                : t('upload.dragOrClick', 'Drag images here or click to select')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {images.length}/{maxFiles} {t('upload.imagesSelected', 'images selected')}
                        </p>
                    </div>

                    {/* Preview Grid */}
                    {images.length > 0 && (
                        <ScrollArea className="max-h-[300px]">
                            <div className="grid grid-cols-4 gap-2 p-1">
                                {images.map((image) => (
                                    <div
                                        key={image.id}
                                        className="relative aspect-square rounded-lg overflow-hidden group border border-border"
                                    >
                                        <img
                                            src={image.previewUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLightboxImage(image.previewUrl);
                                                }}
                                            >
                                                <ZoomIn className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeImage(image.id);
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {image.error && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-xs p-1 text-center">
                                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                                {image.error}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleConfirm} disabled={images.length === 0 || isUploading}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('upload.uploading', 'Uploading...')}
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    {t('upload.confirm', `Upload ${images.length} Image${images.length > 1 ? 's' : ''}`)}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
                    onClick={() => setLightboxImage(null)}
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                    <img
                        src={lightboxImage}
                        alt=""
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
