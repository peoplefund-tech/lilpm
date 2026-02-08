import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
}

/**
 * Toolbar Button Component for BlockEditor
 * Styled button for editor toolbar actions
 */
export function ToolbarButton({
    onClick,
    active,
    disabled,
    children,
    title
}: ToolbarButtonProps) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "h-8 w-8 p-0",
                active && "bg-accent text-accent-foreground"
            )}
        >
            {children}
        </Button>
    );
}

export default ToolbarButton;
