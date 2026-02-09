/**
 * PRD-related types and utilities
 */

/**
 * Version history entry
 */
export interface VersionEntry {
    id: string;
    content: string;
    timestamp: Date;
    description: string;
}

/**
 * AI suggestion for PRD content
 */
export interface AISuggestion {
    id: string;
    originalContent: string;
    suggestedContent: string;
    description: string;
    status: 'pending' | 'accepted' | 'rejected';
}

/**
 * AI Message in panel
 */
export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suggestion?: AISuggestion;
}

export type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';

/**
 * Extract plain text preview from HTML content for overview field
 */
export function extractOverview(htmlContent: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.substring(0, 500);
}
