import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeamStore } from '@/stores/teamStore';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Database, DatabaseProperty, DatabaseRow, DatabaseView, PropertyType, FilterGroup, SortCondition } from './databaseTypes';
import { evaluateFilterGroup } from './DatabaseFilterBuilder';
import { evaluateFormula } from './DatabaseFormulaEngine';

// Debounced DB write to batch rapid cell updates
const pendingUpdates = new Map<string, { properties: Record<string, unknown>; timer: ReturnType<typeof setTimeout> }>();

function debouncedRowUpdate(rowId: string, properties: Record<string, unknown>, delay = 300) {
    const existing = pendingUpdates.get(rowId);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(async () => {
        pendingUpdates.delete(rowId);
        try {
            const res = await apiClient.put(`/databases/rows/${rowId}`, { properties });
            if (res.error) {
                console.error('Debounced update failed:', res.error);
            }
        } catch (err) {
            console.error('Debounced update failed:', err);
        }
    }, delay);

    pendingUpdates.set(rowId, { properties, timer });
}

export function useDatabaseHandlers() {
    const { t } = useTranslation();
    const { currentTeam } = useTeamStore();
    const [databases, setDatabases] = useState<Database[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewDatabaseDialog, setShowNewDatabaseDialog] = useState(false);
    const [newDatabaseName, setNewDatabaseName] = useState('');
    const [filterGroup, setFilterGroup] = useState<FilterGroup>({ combinator: 'and', conditions: [] });
    const [sortConditions, setSortConditions] = useState<SortCondition[]>([]);
    const [activeViewId, setActiveViewId] = useState<string | null>(null);
    const [visibleProperties, setVisibleProperties] = useState<string[]>([]);
    const [groupByPropertyId, setGroupByPropertyId] = useState<string | null>(null);

    const loadDatabases = useCallback(async () => {
        if (!currentTeam) return;
        setIsLoading(true);

        try {
            const dbRes = await apiClient.get<any[]>(`/${currentTeam.id}/databases`);
            if (dbRes.error) throw new Error(dbRes.error);

            const dbData = dbRes.data || [];

            if (dbData.length === 0) {
                const createRes = await apiClient.post<any>(`/${currentTeam.id}/databases`, {
                    name: t('database.sampleTasks'),
                    description: t('database.sampleTasksDesc'),
                    icon: '📋',
                });

                if (createRes.error) throw new Error(createRes.error);
                const newDb = createRes.data;

                const defaultProperties = [
                    { name: 'Title', type: 'text', position: 0 },
                    {
                        name: 'Status', type: 'select', position: 1, config: {
                            options: [
                                { id: '1', name: 'To Do', color: '#ef4444' },
                                { id: '2', name: 'In Progress', color: '#f97316' },
                                { id: '3', name: 'Done', color: '#22c55e' },
                            ]
                        }
                    },
                    {
                        name: 'Priority', type: 'select', position: 2, config: {
                            options: [
                                { id: '1', name: 'High', color: '#ef4444' },
                                { id: '2', name: 'Medium', color: '#f97316' },
                                { id: '3', name: 'Low', color: '#22c55e' },
                            ]
                        }
                    },
                    { name: 'Due Date', type: 'date', position: 3 },
                ];

                for (const prop of defaultProperties) {
                    await apiClient.post(`/databases/${newDb.id}/properties`, prop);
                }

                await apiClient.post(`/databases/${newDb.id}/views`, {
                    name: 'All Tasks', type: 'table', position: 0,
                });

                return loadDatabases();
            }

            const loadedDatabases: Database[] = await Promise.all(
                dbData.map(async (db) => {
                    const [propsRes, rowsRes, viewsRes] = await Promise.all([
                        apiClient.get<any[]>(`/databases/${db.id}/properties`),
                        apiClient.get<any[]>(`/databases/${db.id}/rows`),
                        apiClient.get<any[]>(`/databases/${db.id}/views`),
                    ]);

                    if (propsRes.error || rowsRes.error || viewsRes.error) {
                        throw new Error('Failed to load database components');
                    }

                    return {
                        id: db.id,
                        name: db.name,
                        description: db.description,
                        icon: db.icon,
                        teamId: db.teamId,
                        createdAt: db.createdAt,
                        properties: (propsRes.data || []).map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            type: p.type as PropertyType,
                            options: p.config?.options || p.options,
                            formula: p.config?.formula || p.formula,
                            relationDatabaseId: p.config?.relationDatabaseId || p.relationDatabaseId,
                            rollupProperty: p.config?.rollupProperty || p.rollupProperty,
                            rollupRelationId: p.config?.rollupRelationId || p.rollupRelationId,
                            rollupAggregation: p.config?.rollupAggregation || p.rollupAggregation,
                        })),
                        rows: (rowsRes.data || []).map((r: any) => ({
                            id: r.id,
                            properties: r.properties || {},
                            createdAt: r.createdAt,
                            createdBy: r.createdBy,
                            updatedAt: r.updatedAt,
                            updatedBy: r.updatedBy,
                            parentId: r.parentId || null,
                            position: r.position || 0,
                        })),
                        views: (viewsRes.data || []).map((v: any) => ({
                            id: v.id,
                            name: v.name,
                            type: v.type as DatabaseView['type'],
                            filters: v.config?.filters || v.filters,
                            sorts: v.config?.sorts || v.sorts,
                            groupBy: v.config?.groupBy || v.groupBy,
                            visibleProperties: v.config?.visibleProperties || v.visibleProperties,
                        })),
                    };
                })
            );

            setDatabases(loadedDatabases);
            setSelectedDatabase(prev => {
                if (prev && loadedDatabases.some(db => db.id === prev.id)) {
                    // Keep current selection but update data
                    return loadedDatabases.find(db => db.id === prev.id) || loadedDatabases[0];
                }
                return loadedDatabases[0] || null;
            });
        } catch (error) {
            console.error('Failed to load databases:', error);
            toast.error(t('database.loadError'));
        } finally {
            setIsLoading(false);
        }
    }, [currentTeam, t]);

    // Load databases on team change
    useEffect(() => {
        if (currentTeam) {
            loadDatabases();
        }
    }, [currentTeam]);

    const handleCreateDatabase = useCallback(async () => {
        if (!newDatabaseName.trim() || !currentTeam) return;

        try {
            const dbRes = await apiClient.post<any>(`/${currentTeam.id}/databases`, {
                name: newDatabaseName,
                icon: '📊'
            });

            if (dbRes.error) throw new Error(dbRes.error);
            const newDb = dbRes.data;

            const defaultProps = [
                { name: 'Name', type: 'text', position: 0 },
                { name: 'Tags', type: 'multi_select', position: 1, config: { options: [] } },
            ];

            for (const prop of defaultProps) {
                await apiClient.post(`/databases/${newDb.id}/properties`, prop);
            }

            await apiClient.post(`/databases/${newDb.id}/views`, {
                name: 'All', type: 'table', position: 0,
            });

            setShowNewDatabaseDialog(false);
            setNewDatabaseName('');
            toast.success(t('database.created'));
            await loadDatabases();
        } catch (error) {
            console.error('Failed to create database:', error);
            toast.error(t('database.loadError'));
        }
    }, [newDatabaseName, currentTeam, t, loadDatabases]);

    const handleAddRow = useCallback(async () => {
        if (!selectedDatabase) return;

        try {
            const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/rows`, {
                properties: {}
            });

            if (res.error) throw new Error(res.error);
            const newRow = res.data;

            const updatedRow: DatabaseRow = {
                id: newRow.id,
                properties: newRow.properties || {},
                createdAt: newRow.createdAt,
                createdBy: newRow.createdBy,
                updatedAt: newRow.updatedAt,
                updatedBy: newRow.updatedBy,
                parentId: newRow.parentId || null,
                position: newRow.position || 0,
            };

            const updatedDatabase = {
                ...selectedDatabase,
                rows: [...selectedDatabase.rows, updatedRow]
            };

            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
        } catch (error) {
            console.error('Failed to add row:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    const handleAddProperty = useCallback(async (type: PropertyType) => {
        if (!selectedDatabase) return;

        try {
            const position = selectedDatabase.properties.length;
            const config: any = {};
            if (type === 'select' || type === 'multi_select' || type === 'status') {
                config.options = [];
            }

            const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/properties`, {
                name: `New ${type}`,
                type,
                position,
                config,
            });

            if (res.error) throw new Error(res.error);
            const newProp = res.data;

            const newProperty: DatabaseProperty = {
                id: newProp.id,
                name: newProp.name,
                type: newProp.type as PropertyType,
                options: newProp.config?.options || newProp.options,
            };

            const updatedDatabase = {
                ...selectedDatabase,
                properties: [...selectedDatabase.properties, newProperty]
            };

            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
        } catch (error) {
            console.error('Failed to add property:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    const handleUpdateCell = useCallback(async (rowId: string, propertyId: string, value: unknown) => {
        if (!selectedDatabase) return;

        const row = selectedDatabase.rows.find(r => r.id === rowId);
        if (!row) return;

        const updatedProperties = { ...row.properties, [propertyId]: value };

        // Optimistic local update (instant)
        const updatedRows = selectedDatabase.rows.map(r =>
            r.id === rowId ? { ...r, properties: updatedProperties } : r
        );
        const updatedDatabase = { ...selectedDatabase, rows: updatedRows };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        // Debounced DB write (batches rapid edits)
        debouncedRowUpdate(rowId, updatedProperties);
    }, [selectedDatabase]);

    const handleDeleteRow = useCallback(async (rowId: string) => {
        if (!selectedDatabase) return;

        const updatedRows = selectedDatabase.rows.filter(r => r.id !== rowId);
        const updatedDatabase = { ...selectedDatabase, rows: updatedRows };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        try {
            const res = await apiClient.delete(`/databases/rows/${rowId}`);
            if (res.error) throw new Error(res.error);
        } catch (error) {
            console.error('Failed to delete row:', error);
            toast.error(t('database.loadError'));
            setSelectedDatabase(selectedDatabase);
        }
    }, [selectedDatabase, t]);

    const handleDuplicateRow = useCallback(async (rowId: string) => {
        if (!selectedDatabase) return;

        const row = selectedDatabase.rows.find(r => r.id === rowId);
        if (!row) return;

        try {
            const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/rows`, {
                properties: { ...row.properties }
            });

            if (res.error) throw new Error(res.error);
            const newRow = res.data;

            const duplicatedRow: DatabaseRow = {
                id: newRow.id,
                properties: newRow.properties || {},
                createdAt: newRow.createdAt,
                createdBy: newRow.createdBy,
                updatedAt: newRow.updatedAt,
                updatedBy: newRow.updatedBy,
                parentId: newRow.parentId || null,
                position: newRow.position || 0,
            };

            const updatedDatabase = {
                ...selectedDatabase,
                rows: [...selectedDatabase.rows, duplicatedRow]
            };

            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
        } catch (error) {
            console.error('Failed to duplicate row:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    const handleAddSelectOption = useCallback(async (propertyId: string, optionName: string) => {
        if (!selectedDatabase) return;

        const property = selectedDatabase.properties.find(p => p.id === propertyId);
        if (!property) return;

        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'];
        const newOption = {
            id: Date.now().toString(),
            name: optionName,
            color: colors[(property.options?.length || 0) % colors.length],
        };

        const updatedOptions = [...(property.options || []), newOption];

        // Optimistic update
        const updatedProperties = selectedDatabase.properties.map(p =>
            p.id === propertyId ? { ...p, options: updatedOptions } : p
        );
        const updatedDatabase = { ...selectedDatabase, properties: updatedProperties };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        try {
            const res = await apiClient.put(`/databases/properties/${propertyId}`, {
                config: { options: updatedOptions }
            });

            if (res.error) throw new Error(res.error);
        } catch (error) {
            console.error('Failed to add option:', error);
            toast.error(t('database.loadError'));
        }

        return newOption;
    }, [selectedDatabase, t]);

    // ── View Management ────────────────────────────────────
    const handleCreateView = useCallback(async (name: string, type: DatabaseView['type']) => {
        if (!selectedDatabase) return;

        try {
            const position = selectedDatabase.views.length;
            const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/views`, {
                name,
                type,
                position,
            });

            if (res.error) throw new Error(res.error);
            const newView = res.data;

            const view: DatabaseView = {
                id: newView.id,
                name: newView.name,
                type: newView.type as DatabaseView['type'],
                filters: newView.config?.filters || newView.filters,
                sorts: newView.config?.sorts || newView.sorts,
                groupBy: newView.config?.groupBy || newView.groupBy,
                visibleProperties: newView.config?.visibleProperties || newView.visibleProperties,
            };

            const updatedDatabase = {
                ...selectedDatabase,
                views: [...selectedDatabase.views, view],
            };

            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
            setActiveViewId(view.id);
        } catch (error) {
            console.error('Failed to create view:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    const handleDeleteView = useCallback(async (viewId: string) => {
        if (!selectedDatabase || selectedDatabase.views.length <= 1) return;

        const updatedViews = selectedDatabase.views.filter(v => v.id !== viewId);
        const updatedDatabase = { ...selectedDatabase, views: updatedViews };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        if (activeViewId === viewId) {
            setActiveViewId(updatedViews[0]?.id || null);
        }

        try {
            const res = await apiClient.delete(`/databases/views/${viewId}`);
            if (res.error) throw new Error(res.error);
        } catch (error) {
            console.error('Failed to delete view:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, activeViewId, t]);

    const handleRenameView = useCallback(async (viewId: string, name: string) => {
        if (!selectedDatabase) return;

        const updatedViews = selectedDatabase.views.map(v =>
            v.id === viewId ? { ...v, name } : v
        );
        const updatedDatabase = { ...selectedDatabase, views: updatedViews };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        try {
            const res = await apiClient.put(`/databases/views/${viewId}`, { name });
            if (res.error) throw new Error(res.error);
        } catch (error) {
            console.error('Failed to rename view:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    // ── Sub-items ───────────────────────────────────────────
    const handleAddSubItem = useCallback(async (parentId: string) => {
        if (!selectedDatabase) return;

        try {
            const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/rows`, {
                properties: {},
                parentId,
            });

            if (res.error) throw new Error(res.error);
            const newRow = res.data;

            const subItem: DatabaseRow = {
                id: newRow.id,
                properties: newRow.properties || {},
                createdAt: newRow.createdAt,
                createdBy: newRow.createdBy,
                updatedAt: newRow.updatedAt,
                updatedBy: newRow.updatedBy,
                parentId: newRow.parentId || null,
                position: newRow.position || 0,
            };

            const updatedDatabase = {
                ...selectedDatabase,
                rows: [...selectedDatabase.rows, subItem],
            };
            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
        } catch (error) {
            console.error('Failed to add sub-item:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    // ── CSV Import (bulk add rows) ─────────────────────────
    const handleImportRows = useCallback(async (rowsData: Record<string, unknown>[]) => {
        if (!selectedDatabase) return;

        try {
            // Import rows one by one (server doesn't support bulk insert)
            const importedRows: DatabaseRow[] = [];

            for (const properties of rowsData) {
                const res = await apiClient.post<any>(`/databases/${selectedDatabase.id}/rows`, {
                    properties,
                });

                if (res.error) throw new Error(res.error);

                importedRows.push({
                    id: res.data.id,
                    properties: res.data.properties || {},
                    createdAt: res.data.createdAt,
                    createdBy: res.data.createdBy,
                    updatedAt: res.data.updatedAt,
                    updatedBy: res.data.updatedBy,
                    parentId: res.data.parentId || null,
                    position: res.data.position || 0,
                });
            }

            const updatedDatabase = {
                ...selectedDatabase,
                rows: [...selectedDatabase.rows, ...importedRows],
            };
            setSelectedDatabase(updatedDatabase);
            setDatabases(prev => prev.map(db =>
                db.id === selectedDatabase.id ? updatedDatabase : db
            ));
        } catch (error) {
            console.error('Failed to import rows:', error);
            toast.error(t('database.loadError'));
        }
    }, [selectedDatabase, t]);

    // ── Row Reorder ────────────────────────────────────────
    const handleReorderRows = useCallback(async (oldIndex: number, newIndex: number) => {
        if (!selectedDatabase) return;

        const newRows = [...selectedDatabase.rows];
        const [moved] = newRows.splice(oldIndex, 1);
        newRows.splice(newIndex, 0, moved);

        const updatedDatabase = { ...selectedDatabase, rows: newRows };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        // Persist positions to DB
        try {
            const updates = newRows.map((r, i) =>
                apiClient.put(`/databases/rows/${r.id}`, { position: i })
            );
            await Promise.all(updates);
        } catch (error) {
            console.error('Failed to persist row order:', error);
        }
    }, [selectedDatabase]);

    // ── Property Reorder ───────────────────────────────────
    const handleReorderProperties = useCallback(async (oldIndex: number, newIndex: number) => {
        if (!selectedDatabase) return;

        const newProps = [...selectedDatabase.properties];
        const [moved] = newProps.splice(oldIndex, 1);
        newProps.splice(newIndex, 0, moved);

        const updatedDatabase = { ...selectedDatabase, properties: newProps };
        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));

        // Persist new positions
        try {
            const updates = newProps.map((p, i) =>
                apiClient.put(`/databases/properties/${p.id}`, { position: i })
            );
            await Promise.all(updates);
        } catch (error) {
            console.error('Failed to reorder properties:', error);
        }
    }, [selectedDatabase]);

    // Active view
    const activeView = useMemo(() => {
        if (!selectedDatabase) return null;
        return selectedDatabase.views.find(v => v.id === activeViewId) || selectedDatabase.views[0] || null;
    }, [selectedDatabase, activeViewId]);

    const filteredRows = useMemo(() => {
        if (!selectedDatabase) return [];
        let rows = selectedDatabase.rows;

        // Apply search query
        if (searchQuery) {
            rows = rows.filter(row =>
                Object.values(row.properties).some(value =>
                    String(value).toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }

        // Apply filters
        if (filterGroup.conditions.length > 0) {
            rows = rows.filter(row =>
                evaluateFilterGroup(row.properties, filterGroup, selectedDatabase.properties)
            );
        }

        // Apply sorts
        if (sortConditions.length > 0) {
            rows = [...rows].sort((a, b) => {
                for (const sort of sortConditions) {
                    const prop = selectedDatabase.properties.find(p => p.id === sort.propertyId);
                    if (!prop) continue;

                    const aVal = a.properties[sort.propertyId];
                    const bVal = b.properties[sort.propertyId];

                    let comparison = 0;

                    // Handle nulls
                    if (aVal == null && bVal == null) continue;
                    if (aVal == null) { comparison = -1; }
                    else if (bVal == null) { comparison = 1; }
                    else if (prop.type === 'number') {
                        comparison = Number(aVal) - Number(bVal);
                    } else if (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time') {
                        comparison = new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
                    } else if (prop.type === 'checkbox') {
                        comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
                    } else if (prop.type === 'select' || prop.type === 'status') {
                        const aOption = prop.options?.find(o => o.id === aVal)?.name || '';
                        const bOption = prop.options?.find(o => o.id === bVal)?.name || '';
                        comparison = aOption.localeCompare(bOption);
                    } else {
                        comparison = String(aVal).localeCompare(String(bVal));
                    }

                    if (comparison !== 0) {
                        return sort.direction === 'desc' ? -comparison : comparison;
                    }
                }
                return 0;
            });
        }

        // Evaluate formulas
        const formulaProps = selectedDatabase.properties.filter(p => p.type === 'formula' && p.formula);
        if (formulaProps.length > 0) {
            rows = rows.map(row => {
                const computed = { ...row.properties };
                for (const fp of formulaProps) {
                    try {
                        computed[fp.id] = evaluateFormula(fp.formula!, row, selectedDatabase.properties, selectedDatabase.rows);
                    } catch {
                        computed[fp.id] = '#ERROR';
                    }
                }
                return { ...row, properties: computed };
            });
        }

        return rows;
    }, [selectedDatabase, searchQuery, filterGroup, sortConditions]);

    // Helper: get a related database by ID
    const getRelatedDatabase = useCallback((databaseId: string): Database | null => {
        return databases.find(db => db.id === databaseId) || null;
    }, [databases]);

    // Reset state when database changes
    useEffect(() => {
        if (!selectedDatabase) return;
        setFilterGroup({ combinator: 'and', conditions: [] });
        setSortConditions([]);
        setGroupByPropertyId(null);
        setVisibleProperties(selectedDatabase.properties.map(p => p.id));
        setActiveViewId(selectedDatabase.views[0]?.id || null);
    }, [selectedDatabase?.id]);

    // Update visible properties when properties change
    useEffect(() => {
        if (!selectedDatabase) return;
        setVisibleProperties(prev => {
            const currentIds = selectedDatabase.properties.map(p => p.id);
            const newProps = currentIds.filter(id => !prev.includes(id));
            const validPrev = prev.filter(id => currentIds.includes(id));
            return [...validPrev, ...newProps];
        });
    }, [selectedDatabase?.properties.length]);

    return {
        // State
        databases,
        selectedDatabase,
        setSelectedDatabase,
        isLoading,
        searchQuery,
        setSearchQuery,
        showNewDatabaseDialog,
        setShowNewDatabaseDialog,
        newDatabaseName,
        setNewDatabaseName,
        filteredRows,
        filterGroup,
        setFilterGroup,
        sortConditions,
        setSortConditions,
        activeViewId,
        setActiveViewId,
        activeView,
        visibleProperties,
        setVisibleProperties,
        groupByPropertyId,
        setGroupByPropertyId,

        // Handlers
        loadDatabases,
        handleCreateDatabase,
        handleAddRow,
        handleAddProperty,
        handleUpdateCell,
        handleDeleteRow,
        handleDuplicateRow,
        handleAddSelectOption,
        handleCreateView,
        handleDeleteView,
        handleRenameView,
        handleAddSubItem,
        handleImportRows,
        handleReorderRows,
        handleReorderProperties,
        getRelatedDatabase,
    };
}
