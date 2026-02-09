// TipTap editor extensions configuration hook
import { useMemo } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import {
    CalloutNode, ToggleNode, VideoNode, EquationNode, TableOfContentsNode,
    BookmarkNode, FileNode, UniqueId,
    AudioNode, ColumnBlock, Column, PageEmbed, BreadcrumbsNode,
    ButtonBlock, TemplateButton,
    LinkedDatabase, InlineDatabase,
    SlashCommands,
} from '../extensions';
import { CustomTableCell } from './CustomTableCell';

const lowlight = createLowlight(common);

export interface UseBlockEditorExtensionsProps {
    placeholder?: string;
    editable?: boolean;
}

export function useBlockEditorExtensions({
    placeholder = 'Type / for commands...',
    editable = true,
}: UseBlockEditorExtensionsProps) {
    const extensions = useMemo(() => [
        StarterKit.configure({
            heading: {
                levels: [1, 2, 3, 4, 5, 6],
            },
            codeBlock: false, // Use CodeBlockLowlight instead
        }),
        Placeholder.configure({
            placeholder,
            showOnlyWhenEditable: true,
            emptyEditorClass: 'is-editor-empty',
        }),
        TaskList.configure({
            HTMLAttributes: {
                class: 'not-prose pl-0',
            },
        }),
        TaskItem.configure({
            nested: true,
        }),
        // Disabled global slash commands since we handle it manually
        // SlashCommands,
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: 'text-primary underline cursor-pointer',
            },
        }),
        Highlight.configure({
            multicolor: true,
        }),
        Typography,
        Table.configure({
            resizable: true,
        }),
        TableRow,
        CustomTableCell,
        TableHeader,
        Image.configure({
            allowBase64: true,
        }),
        CodeBlockLowlight.configure({
            lowlight,
            defaultLanguage: 'typescript',
        }),
        GlobalDragHandle.configure({
            dragHandleWidth: 20,
            scrollTreshold: 100,
        }),
        TextStyle,
        Color,
        UniqueId,
        // Custom extensions
        CalloutNode,
        ToggleNode,
        VideoNode,
        EquationNode,
        TableOfContentsNode,
        BookmarkNode,
        FileNode,
        AudioNode,
        ColumnBlock,
        Column,
        PageEmbed,
        BreadcrumbsNode,
        ButtonBlock,
        TemplateButton,
        LinkedDatabase,
        InlineDatabase,
    ], [placeholder]);

    return extensions;
}
