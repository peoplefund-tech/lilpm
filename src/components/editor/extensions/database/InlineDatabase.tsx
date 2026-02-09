import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState, useCallback } from 'react';
import {
    Database, Plus, Trash2, GripVertical, Settings,
    Type, Hash, Calendar, CheckSquare, Link, Tag,
    ChevronDown, MoreHorizontal
} from 'lucide-react';

// Use native crypto.randomUUID for ID generation
const generateId = () => crypto.randomUUID();

/**
 * InlineDatabase Extension
 * Creates a new inline database directly in the editor
 */

export interface InlineColumn {
    id: string;
    name: string;
    type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url';
    options?: { id: string; name: string; color: string }[];
    width: number;
}

export interface InlineRow {
    id: string;
    cells: Record<string, any>;
}

export interface InlineDatabaseOptions {
    onDatabaseChange?: (databaseId: string, columns: InlineColumn[], rows: InlineRow[]) => void;
}

const defaultColumns: InlineColumn[] = [
    { id: 'title', name: 'Title', type: 'text', width: 200 },
    {
        id: 'status', name: 'Status', type: 'select', width: 120, options: [
            { id: 'todo', name: 'To Do', color: '#6B7280' },
            { id: 'progress', name: 'In Progress', color: '#3B82F6' },
            { id: 'done', name: 'Done', color: '#10B981' },
        ]
    },
    { id: 'date', name: 'Date', type: 'date', width: 120 },
];

const defaultRows: InlineRow[] = [
    { id: generateId(), cells: { title: 'Task 1', status: 'todo', date: '' } },
    { id: generateId(), cells: { title: 'Task 2', status: 'progress', date: '' } },
];

const columnTypeIcons: Record<string, React.ReactNode> = {
    text: <Type className="h-3 w-3" />,
    number: <Hash className="h-3 w-3" />,
    select: <Tag className="h-3 w-3" />,
    date: <Calendar className="h-3 w-3" />,
    checkbox: <CheckSquare className="h-3 w-3" />,
    url: <Link className="h-3 w-3" />,
};

const selectColors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
    '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'
];

// Editable Cell Component
const EditableCell: React.FC<{
    column: InlineColumn;
    value: any;
    onChange: (value: any) => void;
}> = ({ column, value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    switch (column.type) {
        case 'checkbox':
            return (
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded"
                />
            );

        case 'select': {
            const selected = column.options?.find(o => o.id === value);
            return (
                <div className="relative">
                    <button
                        onClick={() => setShowOptions(!showOptions)}
                        className="w-full text-left"
                    >
                        {selected ? (
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: selected.color + '20', color: selected.color }}
                            >
                                {selected.name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-xs">Select...</span>
                        )}
                    </button>
                    {showOptions && (
                        <div className="absolute top-full left-0 mt-1 w-32 bg-popover border rounded shadow-lg z-20 p-1">
                            {column.options?.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onChange(opt.id);
                                        setShowOptions(false);
                                    }}
                                    className="w-full px-2 py-1 text-left hover:bg-accent rounded text-xs flex items-center gap-2"
                                >
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: opt.color }}
                                    />
                                    {opt.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        case 'date':
            return (
                <input
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                />
            );

        case 'number':
            return (
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    placeholder="0"
                />
            );

        case 'url':
            return isEditing ? (
                <input
                    type="url"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    placeholder="https://"
                    autoFocus
                />
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    className="truncate text-xs text-primary underline cursor-pointer"
                >
                    {value || <span className="text-muted-foreground no-underline">Add URL</span>}
                </div>
            );

        default: // text
            return isEditing ? (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full bg-transparent border-none outline-none text-xs"
                    autoFocus
                />
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    className="truncate text-xs cursor-text min-h-[20px]"
                >
                    {value || <span className="text-muted-foreground">Empty</span>}
                </div>
            );
    }
};

// Main Component
const InlineDatabaseComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    selected,
    deleteNode,
    extension,
}) => {
    const { title, columns: savedColumns, rows: savedRows } = node.attrs;

    const [columns, setColumns] = useState<InlineColumn[]>(
        savedColumns ? JSON.parse(savedColumns) : defaultColumns
    );
    const [rows, setRows] = useState<InlineRow[]>(
        savedRows ? JSON.parse(savedRows) : defaultRows
    );
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showAddColumn, setShowAddColumn] = useState(false);

    const saveChanges = useCallback((newColumns: InlineColumn[], newRows: InlineRow[]) => {
        updateAttributes({
            columns: JSON.stringify(newColumns),
            rows: JSON.stringify(newRows),
        });
        const options = extension.options as InlineDatabaseOptions;
        options.onDatabaseChange?.(node.attrs.databaseId, newColumns, newRows);
    }, [updateAttributes, extension.options, node.attrs.databaseId]);

    const updateCell = (rowId: string, columnId: string, value: any) => {
        const newRows = rows.map(row =>
            row.id === rowId
                ? { ...row, cells: { ...row.cells, [columnId]: value } }
                : row
        );
        setRows(newRows);
        saveChanges(columns, newRows);
    };

    const addRow = () => {
        const newRow: InlineRow = {
            id: generateId(),
            cells: columns.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {}),
        };
        const newRows = [...rows, newRow];
        setRows(newRows);
        saveChanges(columns, newRows);
    };

    const deleteRow = (rowId: string) => {
        const newRows = rows.filter(row => row.id !== rowId);
        setRows(newRows);
        saveChanges(columns, newRows);
    };

    const addColumn = (type: InlineColumn['type']) => {
        const newColumn: InlineColumn = {
            id: generateId(),
            name: `Column ${columns.length + 1}`,
            type,
            width: 120,
            ...(type === 'select' ? {
                options: [
                    { id: generateId(), name: 'Option 1', color: selectColors[0] },
                ]
            } : {}),
        };
        const newColumns = [...columns, newColumn];
        setColumns(newColumns);
        saveChanges(newColumns, rows);
        setShowAddColumn(false);
    };

    return (
        <NodeViewWrapper>
            <div className={`my-4 rounded-lg border ${selected ? 'ring-2 ring-primary' : ''} bg-card overflow-hidden`}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={title || 'Untitled Database'}
                            onChange={(e) => updateAttributes({ title: e.target.value })}
                            onBlur={() => setIsEditingTitle(false)}
                            className="font-medium bg-transparent border-none outline-none"
                            autoFocus
                        />
                    ) : (
                        <h3
                            className="font-medium cursor-pointer hover:bg-accent px-1 rounded"
                            onClick={() => setIsEditingTitle(true)}
                        >
                            {title || 'Untitled Database'}
                        </h3>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/20">
                                <th className="w-8"></th>
                                {columns.map((col) => (
                                    <th
                                        key={col.id}
                                        className="px-3 py-2 text-left font-medium text-muted-foreground text-xs"
                                        style={{ width: col.width }}
                                    >
                                        <div className="flex items-center gap-1">
                                            {columnTypeIcons[col.type]}
                                            {col.name}
                                        </div>
                                    </th>
                                ))}
                                <th className="w-10">
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowAddColumn(!showAddColumn)}
                                            className="p-1 hover:bg-accent rounded"
                                        >
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                        {showAddColumn && (
                                            <div className="absolute right-0 top-full mt-1 w-40 bg-popover border rounded shadow-lg z-20 p-1">
                                                {Object.entries(columnTypeIcons).map(([type, icon]) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => addColumn(type as InlineColumn['type'])}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent rounded"
                                                    >
                                                        {icon}
                                                        <span className="capitalize">{type}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id} className="border-b hover:bg-muted/30 group">
                                    <td className="px-2">
                                        <div className="flex items-center opacity-0 group-hover:opacity-100">
                                            <button className="p-0.5 hover:bg-accent rounded cursor-grab">
                                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </td>
                                    {columns.map((col) => (
                                        <td key={col.id} className="px-3 py-2">
                                            <EditableCell
                                                column={col}
                                                value={row.cells[col.id]}
                                                onChange={(value) => updateCell(row.id, col.id, value)}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-2">
                                        <button
                                            onClick={() => deleteRow(row.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Add Row */}
                <button
                    onClick={addRow}
                    className="w-full py-2 text-xs text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1"
                >
                    <Plus className="h-3 w-3" />
                    New row
                </button>
            </div>
        </NodeViewWrapper>
    );
};

export const InlineDatabase = Node.create<InlineDatabaseOptions>({
    name: 'inlineDatabase',

    group: 'block',

    atom: true,

    addOptions() {
        return {
            onDatabaseChange: undefined,
        };
    },

    addAttributes() {
        return {
            databaseId: { default: () => generateId() },
            title: { default: 'Untitled Database' },
            columns: { default: null },
            rows: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="inline-database"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'inline-database' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(InlineDatabaseComponent);
    },
});

export default InlineDatabase;
