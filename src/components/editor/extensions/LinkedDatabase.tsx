import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import {
    Database, Table2, LayoutGrid, Calendar, List, Filter,
    SortAsc, Plus, Settings, ChevronDown, MoreHorizontal,
    Eye, EyeOff, Trash2
} from 'lucide-react';

/**
 * LinkedDatabase Extension
 * Embeds a database view as a block within the editor
 */

export interface DatabaseColumn {
    id: string;
    name: string;
    type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'checkbox' | 'url' | 'email' | 'person';
    options?: { id: string; name: string; color: string }[];
    width?: number;
    visible?: boolean;
}

export interface DatabaseRow {
    id: string;
    cells: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface DatabaseView {
    id: string;
    name: string;
    type: 'table' | 'board' | 'calendar' | 'list' | 'gallery';
    columns: string[]; // Column IDs to show
    sortBy?: { columnId: string; direction: 'asc' | 'desc' };
    filterBy?: { columnId: string; operator: string; value: any }[];
    groupBy?: string; // Column ID for board view
}

export interface DatabaseSource {
    id: string;
    name: string;
    emoji?: string;
    columns: DatabaseColumn[];
    rows: DatabaseRow[];
    views: DatabaseView[];
}

export interface LinkedDatabaseOptions {
    onFetchDatabase?: (databaseId: string) => Promise<DatabaseSource | null>;
    onUpdateRow?: (databaseId: string, rowId: string, cells: Record<string, any>) => Promise<void>;
    onAddRow?: (databaseId: string) => Promise<DatabaseRow>;
    onDeleteRow?: (databaseId: string, rowId: string) => Promise<void>;
    availableDatabases?: { id: string; name: string; emoji?: string }[];
}

// Table View Component
const TableView: React.FC<{
    database: DatabaseSource;
    view: DatabaseView;
    onUpdateRow: (rowId: string, cells: Record<string, any>) => void;
    onAddRow: () => void;
}> = ({ database, view, onUpdateRow, onAddRow }) => {
    const visibleColumns = database.columns.filter(col =>
        view.columns.includes(col.id)
    );

    const getCellValue = (row: DatabaseRow, column: DatabaseColumn) => {
        const value = row.cells[column.id];

        switch (column.type) {
            case 'checkbox':
                return (
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={() => onUpdateRow(row.id, { [column.id]: !value })}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                );
            case 'select': {
                const option = column.options?.find(o => o.id === value);
                return option ? (
                    <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: option.color + '20', color: option.color }}
                    >
                        {option.name}
                    </span>
                ) : null;
            }
            case 'date':
                return value ? new Date(value).toLocaleDateString() : '';
            case 'url':
                return value ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate block">
                        {value}
                    </a>
                ) : '';
            default:
                return String(value || '');
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b">
                        {visibleColumns.map((col) => (
                            <th
                                key={col.id}
                                className="px-3 py-2 text-left font-medium text-muted-foreground"
                                style={{ width: col.width || 'auto' }}
                            >
                                {col.name}
                            </th>
                        ))}
                        <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {database.rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/50 group">
                            {visibleColumns.map((col) => (
                                <td key={col.id} className="px-3 py-2">
                                    {getCellValue(row, col)}
                                </td>
                            ))}
                            <td className="px-2">
                                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button
                onClick={onAddRow}
                className="w-full py-2 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1"
            >
                <Plus className="h-4 w-4" />
                New
            </button>
        </div>
    );
};

// Board View Component
const BoardView: React.FC<{
    database: DatabaseSource;
    view: DatabaseView;
    onUpdateRow: (rowId: string, cells: Record<string, any>) => void;
    onAddRow: () => void;
}> = ({ database, view, onUpdateRow, onAddRow }) => {
    const groupColumn = database.columns.find(c => c.id === view.groupBy);
    const groups = groupColumn?.options || [{ id: 'none', name: 'No Status', color: '#888' }];

    const getRowsForGroup = (groupId: string) => {
        return database.rows.filter(row =>
            (row.cells[view.groupBy || ''] || 'none') === groupId
        );
    };

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {groups.map((group) => (
                <div key={group.id} className="flex-shrink-0 w-64">
                    <div
                        className="px-3 py-2 rounded-t-lg font-medium text-sm flex items-center gap-2"
                        style={{ backgroundColor: group.color + '20', color: group.color }}
                    >
                        <span>{group.name}</span>
                        <span className="text-xs opacity-70">{getRowsForGroup(group.id).length}</span>
                    </div>
                    <div className="bg-muted/30 rounded-b-lg p-2 min-h-[100px] space-y-2">
                        {getRowsForGroup(group.id).map((row) => (
                            <div
                                key={row.id}
                                className="bg-background p-3 rounded-md shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                            >
                                <div className="font-medium text-sm truncate">
                                    {row.cells[database.columns[0]?.id] || 'Untitled'}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(row.updatedAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={onAddRow}
                            className="w-full py-2 text-xs text-muted-foreground hover:bg-muted/50 rounded flex items-center justify-center gap-1"
                        >
                            <Plus className="h-3 w-3" />
                            Add
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Main LinkedDatabase Component
const LinkedDatabaseComponent: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    selected,
    deleteNode,
    extension,
}) => {
    const { databaseId, viewId, title } = node.attrs;
    const [database, setDatabase] = useState<DatabaseSource | null>(null);
    const [currentView, setCurrentView] = useState<DatabaseView | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(!databaseId);
    const [showViewMenu, setShowViewMenu] = useState(false);

    const options = extension.options as LinkedDatabaseOptions;

    useEffect(() => {
        if (databaseId && options.onFetchDatabase) {
            setIsLoading(true);
            options.onFetchDatabase(databaseId)
                .then(db => {
                    setDatabase(db);
                    if (db && viewId) {
                        setCurrentView(db.views.find(v => v.id === viewId) || db.views[0]);
                    } else if (db) {
                        setCurrentView(db.views[0]);
                    }
                })
                .finally(() => setIsLoading(false));
        }
    }, [databaseId, viewId]);

    const handleSelectDatabase = (dbId: string, dbName: string) => {
        updateAttributes({ databaseId: dbId, title: dbName });
        setShowPicker(false);
    };

    const handleUpdateRow = async (rowId: string, cells: Record<string, any>) => {
        if (options.onUpdateRow && databaseId) {
            await options.onUpdateRow(databaseId, rowId, cells);
        }
    };

    const handleAddRow = async () => {
        if (options.onAddRow && databaseId) {
            const newRow = await options.onAddRow(databaseId);
            if (database) {
                setDatabase({
                    ...database,
                    rows: [...database.rows, newRow],
                });
            }
        }
    };

    const getViewIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            table: <Table2 className="h-4 w-4" />,
            board: <LayoutGrid className="h-4 w-4" />,
            calendar: <Calendar className="h-4 w-4" />,
            list: <List className="h-4 w-4" />,
            gallery: <LayoutGrid className="h-4 w-4" />,
        };
        return icons[type] || icons.table;
    };

    if (showPicker) {
        return (
            <NodeViewWrapper>
                <div className={`p-6 rounded-lg border-2 border-dashed ${selected ? 'border-primary' : 'border-border'} bg-muted/30`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Database className="h-6 w-6 text-muted-foreground" />
                        <div>
                            <h3 className="font-medium">Link a Database</h3>
                            <p className="text-sm text-muted-foreground">Create a linked view of an existing database</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(options.availableDatabases || []).map((db) => (
                            <button
                                key={db.id}
                                onClick={() => handleSelectDatabase(db.id, db.name)}
                                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent text-left"
                            >
                                <span className="text-lg">{db.emoji || '📊'}</span>
                                <span className="font-medium">{db.name}</span>
                            </button>
                        ))}
                        {(!options.availableDatabases || options.availableDatabases.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No databases available</p>
                                <p className="text-xs mt-1">Create a database first to link it here</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={deleteNode}
                            className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper>
            <div className={`my-4 rounded-lg border ${selected ? 'ring-2 ring-primary' : ''} bg-card`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{database?.emoji || '📊'}</span>
                        <h3 className="font-medium">{title || database?.name || 'Database'}</h3>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* View Switcher */}
                        <div className="relative">
                            <button
                                onClick={() => setShowViewMenu(!showViewMenu)}
                                className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-accent rounded"
                            >
                                {currentView && getViewIcon(currentView.type)}
                                <span>{currentView?.name || 'Table'}</span>
                                <ChevronDown className="h-3 w-3" />
                            </button>

                            {showViewMenu && database && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-lg shadow-lg p-1 z-10">
                                    {database.views.map((view) => (
                                        <button
                                            key={view.id}
                                            onClick={() => {
                                                setCurrentView(view);
                                                updateAttributes({ viewId: view.id });
                                                setShowViewMenu(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent ${currentView?.id === view.id ? 'bg-accent' : ''
                                                }`}
                                        >
                                            {getViewIcon(view.type)}
                                            {view.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="p-1.5 hover:bg-accent rounded">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="p-1.5 hover:bg-accent rounded">
                            <SortAsc className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="p-1.5 hover:bg-accent rounded">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : database && currentView ? (
                        currentView.type === 'board' ? (
                            <BoardView
                                database={database}
                                view={currentView}
                                onUpdateRow={handleUpdateRow}
                                onAddRow={handleAddRow}
                            />
                        ) : (
                            <TableView
                                database={database}
                                view={currentView}
                                onUpdateRow={handleUpdateRow}
                                onAddRow={handleAddRow}
                            />
                        )
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Failed to load database</p>
                        </div>
                    )}
                </div>
            </div>
        </NodeViewWrapper>
    );
};

export const LinkedDatabase = Node.create<LinkedDatabaseOptions>({
    name: 'linkedDatabase',

    group: 'block',

    atom: true,

    addOptions() {
        return {
            onFetchDatabase: undefined,
            onUpdateRow: undefined,
            onAddRow: undefined,
            onDeleteRow: undefined,
            availableDatabases: [],
        };
    },

    addAttributes() {
        return {
            databaseId: { default: null },
            viewId: { default: null },
            title: { default: '' },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="linked-database"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linked-database' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LinkedDatabaseComponent);
    },
});

export default LinkedDatabase;
