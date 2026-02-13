import React, { useEffect, useState } from 'react';
import { Bell, X, Check, Mail, FileText, Ticket, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { notificationService, type Notification, type NotificationType } from '@/lib/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Icons for notification types
const notificationIcons: Record<NotificationType, React.ReactNode> = {
    issue_assigned: <Ticket className="h-4 w-4 text-blue-500" />,
    issue_mentioned: <Mail className="h-4 w-4 text-purple-500" />,
    comment_added: <Mail className="h-4 w-4 text-green-500" />,
    status_changed: <Check className="h-4 w-4 text-amber-500" />,
    due_date_reminder: <Bell className="h-4 w-4 text-red-500" />,
    invite_accepted: <UserPlus className="h-4 w-4 text-green-500" />,
    invite_rejected: <UserPlus className="h-4 w-4 text-red-500" />,
    invite_expired: <UserPlus className="h-4 w-4 text-slate-400" />,
    prd_created: <FileText className="h-4 w-4 text-blue-500" />,
    issue_created: <Ticket className="h-4 w-4 text-green-500" />,
    mention_notification: <Mail className="h-4 w-4 text-purple-500" />,
};

interface InboxToastProps {
    className?: string;
}

// Show toast notification for new notifications
export function showNotificationToast(notification: Notification) {
    toast.custom(
        (t) => (
            <div className={cn(
                "flex items-start gap-3 p-4 bg-[#0d0d0f] border border-white/10 rounded-lg shadow-lg max-w-sm",
                "animate-in slide-in-from-right-full duration-300"
            )}>
                <div className="flex-shrink-0 mt-0.5">
                    {notificationIcons[notification.type]}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{notification.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{notification.body}</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => toast.dismiss(t)}
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        ),
        {
            duration: 5000,
            position: 'top-right',
        }
    );
}

// Hook to subscribe to real-time notifications and show toasts
export function useInboxToast() {
    const { user } = useAuthStore();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;

        // Get initial unread count
        (async () => {
            try {
                const response = await notificationService.getNotifications(user.id, { unreadOnly: false });
                setUnreadCount(response.unreadCount);
            } catch (error) {
                console.error('Failed to fetch initial unread count:', error);
            }
        })();

        // Poll for new notifications every 30 seconds
        const interval = setInterval(async () => {
            try {
                const response = await notificationService.getNotifications(user.id, { unreadOnly: false });
                const newUnread = response.unreadCount;

                // If there are new notifications, show toast
                if (newUnread > unreadCount) {
                    const newNotifications = response.notifications
                        .filter(n => !n.read)
                        .slice(0, newUnread - unreadCount);

                    newNotifications.forEach((notification) => {
                        showNotificationToast(notification);
                    });
                }

                setUnreadCount(newUnread);
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [user?.id, unreadCount]);

    return { unreadCount };
}

// Simple component that initializes the inbox toast hook
export function InboxToast({ className }: InboxToastProps) {
    useInboxToast();
    return null; // This component just initializes the hook, no UI
}
