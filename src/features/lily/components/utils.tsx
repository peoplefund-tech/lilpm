import { Image, Film, FileText, FileSpreadsheet, FileCode, File } from 'lucide-react';
import type { UploadedFile } from './types';

// Get file type icon based on file category
export function getFileTypeIcon(type: UploadedFile['type']) {
    switch (type) {
        case 'image': return <Image className="h-4 w-4" />;
        case 'video': return <Film className="h-4 w-4" />;
        case 'pdf': return <FileText className="h-4 w-4" />;
        case 'document': return <FileText className="h-4 w-4" />;
        case 'spreadsheet': return <FileSpreadsheet className="h-4 w-4" />;
        case 'code': return <FileCode className="h-4 w-4" />;
        default: return <File className="h-4 w-4" />;
    }
}

// Detect if content looks like a PRD (Product Requirements Document)
export function isPRDLikeContent(content: string): boolean {
    if (!content || content.length < 300) return false;

    let score = 0;

    // Check for H1/H2/H3 headings
    const headingCount = (content.match(/^#{1,3}\s+.+$/gm) || []).length;
    if (headingCount >= 3) score += 2;
    if (headingCount >= 5) score += 1;

    // Check for PRD-related keywords
    const prdKeywords = [
        /\b(요구사항|requirements?|기능|features?|목표|goals?|objectives?)\b/gi,
        /\b(overview|개요|summary|요약|배경|background|context)\b/gi,
        /\b(user\s*stor(y|ies)|사용자\s*스토리|유스\s*케이스|use\s*cases?)\b/gi,
        /\b(scope|범위|constraints?|제약|assumptions?|가정)\b/gi,
        /\b(acceptance\s*criteria|인수\s*기준|테스트\s*케이스|test\s*cases?)\b/gi,
        /\b(milestone|마일스톤|timeline|일정|deliverables?|산출물)\b/gi,
    ];

    for (const pattern of prdKeywords) {
        if (pattern.test(content)) score += 1;
    }

    // Check for numbered lists or bullet points
    const listItemCount = (content.match(/^[\s]*[-*•]\s+.+$|^[\s]*\d+\.\s+.+$/gm) || []).length;
    if (listItemCount >= 5) score += 1;
    if (listItemCount >= 10) score += 1;

    // Check for tables
    if (content.includes('|') && (content.match(/\|.*\|/g) || []).length >= 3) {
        score += 1;
    }

    return score >= 4;
}

// Clean message content by removing internal tags
export function cleanMessageContent(content: string, canvasMode: boolean, showCanvasPanel: boolean): string {
    let cleanContent = content;

    // Extract thinking from content if present
    cleanContent = cleanContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    // Remove [CANVAS:...] blocks and template text
    cleanContent = cleanContent
        .replace(/\[CANVAS:[^\]]*\][\s\S]*?(?=\n\n|$)/g, '')
        .replace(/\/\/ Write a [^\n]*\n?/g, '')
        .trim();

    // Filter out internal tags
    cleanContent = cleanContent
        .replace(/\[\/?(?:ISSUE_SUGGESTION|PRD_CONTENT|CANVAS|THINKING)\]/gi, '')
        .trim();

    // Only remove code blocks from chat when canvas mode is ON
    if (canvasMode && showCanvasPanel) {
        cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '').trim();
    }

    return cleanContent;
}

// Extract thinking content from message
export function extractThinkingContent(content: string): { thinking: string; cleanContent: string } {
    const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
        return {
            thinking: thinkingMatch[1],
            cleanContent: content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim(),
        };
    }
    return { thinking: '', cleanContent: content };
}
