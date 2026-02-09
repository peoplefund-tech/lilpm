// File handling logic for Lily Chat
import { useState, useRef, useCallback, useEffect } from 'react';
import { UploadedFile, FILE_TYPE_MAP } from '../types';

export interface UseLilyFileUploadReturn {
    uploadedFiles: UploadedFile[];
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    removeFile: (id: string) => void;
    clearFiles: () => void;
    getFilesForMessage: () => {
        name: string;
        type: string;
        size: number;
        base64: string;
        category: string;
    }[];
}

export function useLilyFileUpload(): UseLilyFileUploadReturn {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newFiles: UploadedFile[] = [];

        for (const file of Array.from(files)) {
            const type = FILE_TYPE_MAP[file.type] || 'other';
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Read file as base64 for API submission
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64Content = result.split(',')[1] || result;
                    resolve(base64Content);
                };
                reader.readAsDataURL(file);
            });

            // Create preview URL for images
            let preview: string | undefined;
            if (type === 'image') {
                preview = URL.createObjectURL(file);
            }

            newFiles.push({
                id,
                file,
                preview,
                base64,
                type,
            });
        }

        setUploadedFiles(prev => [...prev, ...newFiles]);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const removeFile = useCallback((id: string) => {
        setUploadedFiles(prev => {
            const file = prev.find(f => f.id === id);
            if (file?.preview) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter(f => f.id !== id);
        });
    }, []);

    const clearFiles = useCallback(() => {
        uploadedFiles.forEach(file => {
            if (file.preview) {
                URL.revokeObjectURL(file.preview);
            }
        });
        setUploadedFiles([]);
    }, [uploadedFiles]);

    const getFilesForMessage = useCallback(() => {
        return uploadedFiles.map(f => ({
            name: f.file.name,
            type: f.file.type,
            size: f.file.size,
            base64: f.base64,
            category: f.type,
        }));
    }, [uploadedFiles]);

    // Cleanup previews on unmount
    useEffect(() => {
        return () => {
            uploadedFiles.forEach(file => {
                if (file.preview) {
                    URL.revokeObjectURL(file.preview);
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        uploadedFiles,
        fileInputRef,
        handleFileSelect,
        removeFile,
        clearFiles,
        getFilesForMessage,
    };
}
