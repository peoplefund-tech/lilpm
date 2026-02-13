import { apiClient } from '@/lib/api/client';

// Action types for activity logging
export type ActivityActionType =
    | 'invite_sent'
    | 'invite_cancelled'
    | 'invite_accepted'
    | 'invite_rejected'
    | 'invite_resent'
    | 'member_added'
    | 'member_removed'
    | 'role_changed';

// Target types for activity logging
export type ActivityTargetType =
    | 'team_member'
    | 'team_invite'
    | 'project_member';

export interface ActivityLogEntry {
    teamId?: string;
    projectId?: string;
    actionType: ActivityActionType;
    targetType: ActivityTargetType;
    targetId?: string;
    targetEmail?: string;
    targetUserId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Log an activity to the activity_logs table
 */
export async function logActivity(entry: ActivityLogEntry): Promise<void> {
    try {
        if (!entry.teamId) {
            console.warn('Activity logging skipped: teamId is required');
            return;
        }

        const res = await apiClient.post(`/${entry.teamId}/activities`, {
            actionType: entry.actionType,
            targetType: entry.targetType,
            targetId: entry.targetId,
            description: `${entry.actionType} on ${entry.targetType}`,
            metadata: {
                ...(entry.metadata || {}),
                ...(entry.targetEmail ? { target_email: entry.targetEmail } : {}),
                ...(entry.targetUserId ? { target_user_id: entry.targetUserId } : {}),
                ...(entry.oldValue ? { old_value: entry.oldValue } : {}),
                ...(entry.newValue ? { new_value: entry.newValue } : {}),
            },
        });

        if (res.error) {
            console.error('Failed to log activity:', res.error);
        }
    } catch (err) {
        // Don't throw - activity logging should not break the main flow
        console.error('Error logging activity:', err);
    }
}

/**
 * Log team invite sent
 */
export function logInviteSent(
    teamId: string,
    inviteId: string,
    email: string,
    role: string,
    isExistingUser: boolean
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'invite_sent',
        targetType: 'team_invite',
        targetId: inviteId,
        targetEmail: email,
        newValue: { role, isExistingUser },
    });
}

/**
 * Log team invite cancelled
 */
export function logInviteCancelled(
    teamId: string,
    inviteId: string,
    email: string
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'invite_cancelled',
        targetType: 'team_invite',
        targetId: inviteId,
        targetEmail: email,
    });
}

/**
 * Log invite accepted
 */
export function logInviteAccepted(
    teamId: string,
    inviteId: string,
    userId: string
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'invite_accepted',
        targetType: 'team_invite',
        targetId: inviteId,
        targetUserId: userId,
    });
}

/**
 * Log member role changed
 */
export function logRoleChanged(
    teamId: string,
    memberId: string,
    userId: string,
    oldRole: string,
    newRole: string
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'role_changed',
        targetType: 'team_member',
        targetId: memberId,
        targetUserId: userId,
        oldValue: { role: oldRole },
        newValue: { role: newRole },
    });
}

/**
 * Log member removed from team
 */
export function logMemberRemoved(
    teamId: string,
    memberId: string,
    userId: string,
    role: string
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'member_removed',
        targetType: 'team_member',
        targetId: memberId,
        targetUserId: userId,
        oldValue: { role },
    });
}

/**
 * Log invite resent
 */
export function logInviteResent(
    teamId: string,
    inviteId: string,
    email: string
): Promise<void> {
    return logActivity({
        teamId,
        actionType: 'invite_resent',
        targetType: 'team_invite',
        targetId: inviteId,
        targetEmail: email,
    });
}
