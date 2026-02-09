import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useEffect, useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumbs Extension
 * Shows the current page's location in the page hierarchy
 */

interface BreadcrumbItem {
    id: string;
    title: string;
    path: string;
    emoji?: string;
}

// React component for breadcrumbs
const BreadcrumbsComponent: React.FC<NodeViewProps> = ({
    node,
    selected,
}) => {
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

    useEffect(() => {
        // Parse current URL to build breadcrumbs
        const path = window.location.pathname;
        const segments = path.split('/').filter(Boolean);

        const items: BreadcrumbItem[] = [
            { id: 'home', title: 'Home', path: '/', emoji: '🏠' },
        ];

        // Build breadcrumb based on path
        if (segments.length > 0) {
            const type = segments[0]; // 'prd', 'issues', 'settings', etc.
            const id = segments[1];

            if (type === 'prd') {
                items.push({ id: 'prds', title: 'PRDs', path: '/prds' });
                if (id) {
                    items.push({ id, title: 'Current PRD', path: `/prd/${id}` });
                }
            } else if (type === 'issues') {
                items.push({ id: 'issues', title: 'Issues', path: '/issues' });
                if (id) {
                    items.push({ id, title: 'Current Issue', path: `/issues/${id}` });
                }
            } else if (type === 'team') {
                items.push({ id: 'team', title: 'Team', path: '/team' });
            } else if (type === 'settings') {
                items.push({ id: 'settings', title: 'Settings', path: '/settings' });
            }
        }

        setBreadcrumbs(items);
    }, []);

    const navigateTo = (path: string) => {
        window.location.href = path;
    };

    return (
        <NodeViewWrapper>
            <nav
                className={`flex items-center gap-1 py-2 px-3 rounded-md text-sm ${selected ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50'
                    }`}
                aria-label="Breadcrumb"
            >
                {breadcrumbs.map((item, index) => (
                    <React.Fragment key={item.id}>
                        {index > 0 && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <button
                            onClick={() => navigateTo(item.path)}
                            className={`flex items-center gap-1 hover:text-primary transition-colors ${index === breadcrumbs.length - 1
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground'
                                }`}
                        >
                            {index === 0 && <Home className="h-3 w-3" />}
                            <span className="truncate max-w-[120px]">{item.title}</span>
                        </button>
                    </React.Fragment>
                ))}
            </nav>
        </NodeViewWrapper>
    );
};

export const BreadcrumbsNode = Node.create({
    name: 'breadcrumbs',

    group: 'block',

    atom: true,

    parseHTML() {
        return [
            {
                tag: 'nav[data-type="breadcrumbs"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['nav', mergeAttributes(HTMLAttributes, { 'data-type': 'breadcrumbs' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(BreadcrumbsComponent);
    },
});

export default BreadcrumbsNode;
