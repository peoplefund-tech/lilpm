/**
 * Block Comment Service
 *
 * Handles inline comments on blocks within PRD and Issue editors.
 * Supports comments, replies, reactions, and resolution.
 */

import { apiClient } from '@/lib/api/client';
import type { BlockComment, BlockCommentReply, BlockCommentReaction, BlockCommentPageType } from '@/types/database';

// ─── Comments ───────────────────────────────────────────────────────────────

export async function getComments(pageId: string, pageType: BlockCommentPageType): Promise<BlockComment[]> {
    const res = await apiClient.get<BlockComment[]>(
        `/block-comments?pageId=${encodeURIComponent(pageId)}&pageType=${encodeURIComponent(pageType)}`
    );

    if (!res.success) {
        console.error('Failed to fetch block comments:', res.error);
        throw new Error(res.error || 'Failed to fetch block comments');
    }

    return res.data || [];
}

export async function getCommentsByBlock(pageId: string, pageType: BlockCommentPageType, blockId: string): Promise<BlockComment[]> {
    const res = await apiClient.get<BlockComment[]>(
        `/block-comments/by-block?pageId=${encodeURIComponent(pageId)}&pageType=${encodeURIComponent(pageType)}&blockId=${encodeURIComponent(blockId)}`
    );

    if (!res.success) {
        throw new Error(res.error || 'Failed to fetch block comments');
    }

    return res.data || [];
}

export async function addComment(
    pageId: string,
    pageType: BlockCommentPageType,
    blockId: string,
    content: string,
): Promise<BlockComment> {
    const res = await apiClient.post<BlockComment>('/block-comments', {
        pageId,
        pageType,
        blockId,
        content,
    });

    if (!res.success) {
        throw new Error(res.error || 'Failed to create comment');
    }

    return res.data;
}

export async function resolveComment(commentId: string): Promise<void> {
    const res = await apiClient.put<void>(`/block-comments/${commentId}`, {
        resolved: true,
    });

    if (!res.success) {
        throw new Error(res.error || 'Failed to resolve comment');
    }
}

export async function unresolveComment(commentId: string): Promise<void> {
    const res = await apiClient.put<void>(`/block-comments/${commentId}`, {
        resolved: false,
    });

    if (!res.success) {
        throw new Error(res.error || 'Failed to unresolve comment');
    }
}

export async function deleteComment(commentId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/block-comments/${commentId}`);

    if (!res.success) {
        throw new Error(res.error || 'Failed to delete comment');
    }
}

// ─── Replies ────────────────────────────────────────────────────────────────

export async function addReply(commentId: string, content: string): Promise<BlockCommentReply> {
    const res = await apiClient.post<BlockCommentReply>(
        `/block-comments/${commentId}/replies`,
        { content }
    );

    if (!res.success) {
        throw new Error(res.error || 'Failed to add reply');
    }

    return res.data;
}

export async function deleteReply(replyId: string): Promise<void> {
    // Note: This endpoint requires commentId, but we only have replyId
    // We'll need to store the commentId context or modify the API
    // For now, create a compound endpoint or fetch comment first
    const res = await apiClient.delete<void>(`/block-comments/reply/${replyId}`);

    if (!res.success) {
        throw new Error(res.error || 'Failed to delete reply');
    }
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export async function toggleReaction(commentId: string, emoji: string): Promise<{ added: boolean }> {
    // TODO: Implement once block_comment_reactions table is added to schema
    // For now, return a placeholder response or skip this feature
    const res = await apiClient.post<{ added: boolean }>(
        `/block-comments/${commentId}/reactions`,
        { emoji }
    );

    if (!res.success) {
        throw new Error(res.error || 'Failed to toggle reaction');
    }

    return res.data;
}

// ─── Real-time Subscription ────────────────────────────────────────────────

export function subscribeToComments(
    pageId: string,
    pageType: BlockCommentPageType,
    onUpdate: () => void,
) {
    // TODO: Implement WebSocket-based realtime updates to collab-server
    // For now, this returns a no-op unsubscribe function
    // Components should poll or listen to WebSocket events instead

    // Placeholder: Return unsubscribe function that does nothing
    return () => {
        // No-op unsubscribe
    };
}

// ─── Export as namespace ────────────────────────────────────────────────────

export const blockCommentService = {
    getComments,
    getCommentsByBlock,
    addComment,
    resolveComment,
    unresolveComment,
    deleteComment,
    addReply,
    deleteReply,
    toggleReaction,
    subscribeToComments,
};
