import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeamStore } from '@/stores/teamStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Database, DatabaseProperty, DatabaseRow, DatabaseView, PropertyType } from './databaseTypes';

export function useDatabaseHandlers() {
    const { t } = useTranslation();
    const { currentTeam } = useTeamStore();
    const [databases, setDatabases] = useState<Database[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewDatabaseDialog, setShowNewDatabaseDialog] = useState(false);
    const [newDatabaseName, setNewDatabaseName] = useState('');

    const loadDatabases = useCallback(async () => {
        if (!currentTeam) return;
        setIsLoading(true);

        try {
            const { data: dbData, error: dbError } = await supabase
                .from('databases')
                .select('*')
                .eq('team_id', currentTeam.id)
                .order('created_at', { ascending: false });

            if (dbError) throw dbError;

            if (!dbData || dbData.length === 0) {
                const { data: newDb, error: createError } = await supabase
                    .from('databases')
                    .insert({
                        team_id: currentTeam.id,
                        name: t('database.sampleTasks'),
                        description: t('database.sampleTasksDesc'),
                        icon: '📋',
                    })
                    .select()
                    .single();

                if (createError) throw createError;

                const defaultProperties = [
                    { database_id: newDb.id, name: 'Title', type: 'text', position: 0 },
                    {
                        database_id: newDb.id, name: 'Status', type: 'select', position: 1, options: [
                            { id: '1', name: 'To Do', color: '#ef4444' },
                            { id: '2', name: 'In Progress', color: '#f97316' },
                            { id: '3', name: 'Done', color: '#22c55e' },
                        ]
                    },
                    {
                        database_id: newDb.id, name: 'Priority', type: 'select', position: 2, options: [
                            { id: '1', name: 'High', color: '#ef4444' },
                            { id: '2', name: 'Medium', color: '#f97316' },
                            { id: '3', name: 'Low', color: '#22c55e' },
                        ]
                    },
                    { database_id: newDb.id, name: 'Due Date', type: 'date', position: 3 },
                ];

                await supabase.from('database_properties').insert(defaultProperties);
                await supabase.from('database_views').insert({
                    database_id: newDb.id, name: 'All Tasks', type: 'table', position: 0,
                });

                return loadDatabases();
            }

            const loadedDatabases: Database[] = await Promise.all(
                dbData.map(async (db) => {
                    const [propsRes, rowsRes, viewsRes] = await Promise.all([
                        supabase.from('database_properties').select('*').eq('database_id', db.id).order('position'),
                        supabase.from('database_rows').select('*').eq('database_id', db.id).order('created_at'),
                        supabase.from('database_views').select('*').eq('database_id', db.id).order('position'),
                    ]);

                    return {
                        id: db.id,
                        name: db.name,
                        description: db.description,
                        icon: db.icon,
                        teamId: db.team_id,
                        createdAt: db.created_at,
                        properties: (propsRes.data || []).map(p => ({
                            id: p.id,
                            name: p.name,
                            type: p.type as PropertyType,
                            options: p.options,
                            formula: p.formula,
                            relationDatabaseId: p.relation_database_id,
                            rollupProperty: p.rollup_property,
                        })),
                        rows: (rowsRes.data || []).map(r => ({
                            id: r.id,
                            properties: r.properties,
                            createdAt: r.created_at,
                            createdBy: r.created_by,
                            updatedAt: r.updated_at,
                            updatedBy: r.updated_by,
                        })),
                        views: (viewsRes.data || []).map(v => ({
                            id: v.id,
                            name: v.name,
                            type: v.type as DatabaseView['type'],
                            filters: v.filters,
                            sorts: v.sorts,
                            groupBy: v.group_by,
                            visibleProperties: v.visible_properties,
                        })),
                    };
                })
            );

            setDatabases(loadedDatabases);
            if (loadedDatabases.length > 0 && !selectedDatabase) {
                setSelectedDatabase(loadedDatabases[0]);
            }
        } catch (error) {
            console.error('Failed to load databases:', error);
            toast.error(t('database.loadError'));
        } finally {
            setIsLoading(false);
        }
    }, [currentTeam, t, selectedDatabase]);

    // Load databases on team change
    useEffect(() => {
        if (currentTeam) {
            loadDatabases();
        }
    }, [currentTeam]);

    const handleCreateDatabase = useCallback(async () => {
        if (!newDatabaseName.trim() || !currentTeam) return;

        try {
            const { data: newDb, error: dbError } = await supabase
                .from('databases')
                .insert({ team_id: currentTeam.id, name: newDatabaseName, icon: '📊' })
                .select()
                .single();

            if (dbError) throw dbError;

            const defaultProps = [
                { database_id: newDb.id, name: 'Name', type: 'text', position: 0 },
                { database_id: newDb.id, name: 'Tags', type: 'multi_select', position: 1, options: [] },
            ];
            await supabase.from('database_properties').insert(defaultProps);
            await supabase.from('database_views').insert({
                database_id: newDb.id, name: 'All', type: 'table', position: 0,
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
            const { data: newRow, error } = await supabase
                .from('database_rows')
                .insert({ database_id: selectedDatabase.id, properties: {} })
                .select()
                .single();

            if (error) throw error;

            const updatedRow: DatabaseRow = {
                id: newRow.id,
                properties: newRow.properties,
                createdAt: newRow.created_at,
                createdBy: newRow.created_by,
                updatedAt: newRow.updated_at,
                updatedBy: newRow.updated_by,
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

    const handleAddProperty = useCallback((type: PropertyType) => {
        if (!selectedDatabase) return;

        const newProperty: DatabaseProperty = {
            id: Date.now().toString(),
            name: `New ${type}`,
            type,
            options: type === 'select' || type === 'multi_select' ? [] : undefined,
        };

        const updatedDatabase = {
            ...selectedDatabase,
            properties: [...selectedDatabase.properties, newProperty]
        };

        setSelectedDatabase(updatedDatabase);
        setDatabases(prev => prev.map(db =>
            db.id === selectedDatabase.id ? updatedDatabase : db
        ));
    }, [selectedDatabase]);

    const filteredRows = useMemo(() => {
        if (!selectedDatabase || !searchQuery) return selectedDatabase?.rows || [];
        return selectedDatabase.rows.filter(row =>
            Object.values(row.properties).some(value =>
                String(value).toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [selectedDatabase, searchQuery]);

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

        // Handlers
        loadDatabases,
        handleCreateDatabase,
        handleAddRow,
        handleAddProperty,
    };
}
