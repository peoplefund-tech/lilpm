import { apiClient } from '@/lib/api/client';
import type { Comment, Profile } from '@/types/database';
import { issueActivityService } from './issueActivityService';

// ============================================
// COMMENT SERVICES
// ============================================

export interface CommentWithUser extends Comment {
    user: Profile;
}

export const commentService = {
    async getComments(issueId: string): Promise<CommentWithUser[]> {
        const res = await apiClient.get<CommentWithUser[]>(`/issues/${issueId}/comments`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async createComment(issueId: string, body: string): Promise<Comment> {
        const res = await apiClient.post<Comment>(`/issues/${issueId}/comments`, { body });
        if (res.error) throw new Error(res.error);
        if (!res.data) throw new Error('Failed to create comment');

        await issueActivityService.createActivity(issueId, 'comment_added', { comment_id: res.data.id });

        return res.data;
    },

    async updateComment(commentId: string, body: string): Promise<Comment> {
        const res = await apiClient.put<Comment>(`/comments/${commentId}`, { body });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async deleteComment(commentId: string): Promise<void> {
        const res = await apiClient.delete(`/comments/${commentId}`);
        if (res.error) throw new Error(res.error);
    },
};
