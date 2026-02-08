/**
 * MentionSuggestion - Dropdown component for @mention in BlockEditor
 * 
 * Displays team members matching the search query with avatar, name, and email.
 * Supports keyboard navigation (Up/Down/Enter/Escape).
 */

import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useState,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/database';

export interface MentionSuggestionProps {
    items: Profile[];
    command: (props: { id: string; label: string }) => void;
}

export interface MentionSuggestionRef {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
    ({ items, command }, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);

        useEffect(() => {
            setSelectedIndex(0);
        }, [items]);

        const selectItem = (index: number) => {
            const item = items[index];
            if (item) {
                command({
                    id: item.id,
                    label: item.name || item.email || 'User'
                });
            }
        };

        const upHandler = () => {
            setSelectedIndex((prev) =>
                prev === 0 ? items.length - 1 : prev - 1
            );
        };

        const downHandler = () => {
            setSelectedIndex((prev) =>
                prev === items.length - 1 ? 0 : prev + 1
            );
        };

        const enterHandler = () => {
            selectItem(selectedIndex);
        };

        useImperativeHandle(ref, () => ({
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
                if (event.key === 'ArrowUp') {
                    upHandler();
                    return true;
                }

                if (event.key === 'ArrowDown') {
                    downHandler();
                    return true;
                }

                if (event.key === 'Enter') {
                    enterHandler();
                    return true;
                }

                return false;
            },
        }));

        if (items.length === 0) {
            return (
                <div className="bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                    No members found
                </div>
            );
        }

        return (
            <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden max-w-[280px]">
                <ScrollArea className="max-h-32">
                    <div className="p-1">
                        {items.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                className={cn(
                                    'w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left',
                                    index === selectedIndex
                                        ? 'bg-accent text-accent-foreground'
                                        : 'hover:bg-accent/50'
                                )}
                                onClick={() => selectItem(index)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <Avatar className="h-5 w-5 flex-shrink-0">
                                    <AvatarImage src={item.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {item.name?.charAt(0) || item.email?.charAt(0) || '?'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                        {item.name || 'User'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {item.email}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        );
    }
);

MentionSuggestion.displayName = 'MentionSuggestion';
