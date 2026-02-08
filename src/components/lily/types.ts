// File types and utilities for Lily chat

export interface UploadedFile {
    id: string;
    file: File;
    preview?: string;
    base64?: string;
    type: 'image' | 'video' | 'pdf' | 'document' | 'code' | 'spreadsheet' | 'other';
}

export const FILE_TYPE_MAP: Record<string, UploadedFile['type']> = {
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'video/mp4': 'video',
    'video/webm': 'video',
    'video/quicktime': 'video',
    'application/pdf': 'pdf',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
    'text/csv': 'spreadsheet',
    'text/plain': 'code',
    'text/javascript': 'code',
    'text/typescript': 'code',
    'text/html': 'code',
    'text/css': 'code',
    'application/json': 'code',
    'application/xml': 'code',
    'text/x-python': 'code',
    'text/x-java': 'code',
    'text/x-c': 'code',
    'text/x-cpp': 'code',
};

// Project context for AI-assisted creation from project page
export interface ProjectContext {
    projectId?: string;
    projectName?: string;
    type?: 'issue' | 'prd';
}

export const MIN_HISTORY_WIDTH = 200;
export const MAX_HISTORY_WIDTH = 400;
export const DEFAULT_HISTORY_WIDTH = 256;
