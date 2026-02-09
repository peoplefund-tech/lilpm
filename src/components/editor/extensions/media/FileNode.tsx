import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    FileText,
    FileSpreadsheet,
    FileCode,
    File,
    Download,
    X,
    Upload,
    FileImage,
    FileVideo,
    FileAudio,
    FileArchive,
} from 'lucide-react';

// Get file icon based on mime type or extension
const getFileIcon = (fileType: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Check by mime type first
    if (fileType.startsWith('image/')) return FileImage;
    if (fileType.startsWith('video/')) return FileVideo;
    if (fileType.startsWith('audio/')) return FileAudio;

    // Check by extension
    const spreadsheetExts = ['xlsx', 'xls', 'csv', 'numbers'];
    const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'md'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    const docExts = ['doc', 'docx', 'pdf', 'txt', 'rtf'];

    if (spreadsheetExts.includes(ext)) return FileSpreadsheet;
    if (codeExts.includes(ext)) return FileCode;
    if (archiveExts.includes(ext)) return FileArchive;
    if (docExts.includes(ext)) return FileText;

    return File;
};

// Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Use TipTap's NodeViewProps directly
const FileComponent: React.FC<any> = ({ node, updateAttributes, selected, deleteNode }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { fileName, fileSize, fileType, fileUrl } = node.attrs;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // In production, upload to storage and get URL
        // For now, create a local object URL (won't persist)
        const url = URL.createObjectURL(file);

        updateAttributes({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: url,
        });
    };

    const IconComponent = fileName ? getFileIcon(fileType || '', fileName) : Upload;

    return (
        <NodeViewWrapper>
            <div
                className={cn(
                    'my-4 rounded-lg border overflow-hidden',
                    selected && 'ring-2 ring-primary/50'
                )}
            >
                {!fileName ? (
                    // File Upload UI
                    <div
                        className="p-6 bg-muted/50 text-center cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Click to upload a file</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">or drag and drop</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                ) : (
                    // File Card
                    <div className="flex items-center gap-3 p-4 bg-muted/30">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-primary" />
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{fileName}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatFileSize(fileSize || 0)}
                                {fileType && ` • ${fileType.split('/').pop()?.toUpperCase()}`}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            {fileUrl && (
                                <a
                                    href={fileUrl}
                                    download={fileName}
                                    className="p-2 rounded-md hover:bg-muted transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Download className="h-4 w-4 text-muted-foreground" />
                                </a>
                            )}
                            <button
                                onClick={() => deleteNode()}
                                className="p-2 rounded-md hover:bg-destructive/10 transition-colors"
                            >
                                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap Extension
export const FileNode = Node.create({
    name: 'file',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            fileName: {
                default: '',
                parseHTML: element => element.getAttribute('data-file-name') || '',
                renderHTML: attributes => ({ 'data-file-name': attributes.fileName }),
            },
            fileSize: {
                default: 0,
                parseHTML: element => parseInt(element.getAttribute('data-file-size') || '0'),
                renderHTML: attributes => ({ 'data-file-size': attributes.fileSize?.toString() }),
            },
            fileType: {
                default: '',
                parseHTML: element => element.getAttribute('data-file-type') || '',
                renderHTML: attributes => ({ 'data-file-type': attributes.fileType }),
            },
            fileUrl: {
                default: '',
                parseHTML: element => element.getAttribute('data-file-url') || '',
                renderHTML: attributes => ({ 'data-file-url': attributes.fileUrl }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="file"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-type': 'file' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(FileComponent);
    },
});

export default FileNode;
