import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
    Plus, Search, Filter, MoreHorizontal, TableIcon, Kanban,
    Calendar, List, Trash2, Copy, Edit,
    ArrowUpDown, Hash, Type, CalendarIcon,
    Link, CheckSquare, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { useDatabaseHandlers, PROPERTY_ICONS } from './hooks';
import type { DatabaseRow, DatabaseProperty } from './hooks';

export function DatabasePage() {
    const { t } = useTranslation();
    const [currentView, setCurrentView] = useState<'table' | 'board' | 'calendar' | 'list'>('table');

    const {
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
        handleCreateDatabase,
        handleAddRow,
        handleAddProperty,
    } = useDatabaseHandlers();

    const getCellValue = (row: DatabaseRow, property: DatabaseProperty) => {
        const value = row.properties[property.id];

        switch (property.type) {
            case 'select': {
                const option = property.options?.find(o => o.id === value);
                return option ? (
                    <Badge
                        style={{ backgroundColor: option.color + '20', color: option.color, borderColor: option.color }}
                        variant="outline"
                    >
                        {option.name}
                    </Badge>
                ) : null;
            }
            case 'date':
                return value ? format(new Date(value as string), 'MMM d, yyyy') : null;
            case 'checkbox':
                return value ? '✓' : '○';
            case 'url':
                return value ? (
                    <a href={value as string} target="_blank" rel="noopener" className="text-primary hover:underline">
                        {value as string}
                    </a>
                ) : null;
            default:
                return value as string;
        }
    };

    // View Components
    const TableView = () => (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        {selectedDatabase?.properties.map(prop => (
                            <TableHead key={prop.id} className="min-w-[150px]">
                                <div className="flex items-center gap-2">
                                    {React.createElement(PROPERTY_ICONS[prop.type] || Type, { className: 'h-4 w-4 text-muted-foreground' })}
                                    {prop.name}
                                </div>
                            </TableHead>
                        ))}
                        <TableHead className="w-[50px]">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleAddProperty('text')}>
                                        <Type className="h-4 w-4 mr-2" /> Text
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddProperty('number')}>
                                        <Hash className="h-4 w-4 mr-2" /> Number
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddProperty('select')}>
                                        <Tag className="h-4 w-4 mr-2" /> Select
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddProperty('date')}>
                                        <CalendarIcon className="h-4 w-4 mr-2" /> Date
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddProperty('checkbox')}>
                                        <CheckSquare className="h-4 w-4 mr-2" /> Checkbox
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddProperty('url')}>
                                        <Link className="h-4 w-4 mr-2" /> URL
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredRows.map(row => (
                        <TableRow key={row.id} className="hover:bg-muted/50 cursor-pointer">
                            {selectedDatabase?.properties.map(prop => (
                                <TableCell key={prop.id}>
                                    {getCellValue(row, prop)}
                                </TableCell>
                            ))}
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem>
                                            <Edit className="h-4 w-4 mr-2" /> {t('common.edit')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Copy className="h-4 w-4 mr-2" /> {t('common.duplicate')}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive">
                                            <Trash2 className="h-4 w-4 mr-2" /> {t('common.delete')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {/* New row button */}
                    <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={handleAddRow}>
                        <TableCell colSpan={(selectedDatabase?.properties.length || 0) + 1}>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Plus className="h-4 w-4" />
                                {t('database.newRow')}
                            </div>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );

    const BoardView = () => {
        const groupByProperty = selectedDatabase?.properties.find(p => p.type === 'select' || p.type === 'status');

        if (!groupByProperty?.options) {
            return <div className="text-center text-muted-foreground p-8">{t('database.noGroupProperty')}</div>;
        }

        return (
            <div className="flex gap-4 overflow-x-auto pb-4">
                {groupByProperty.options.map(option => {
                    const columnRows = filteredRows.filter(row => row.properties[groupByProperty.id] === option.id);

                    return (
                        <div key={option.id} className="flex-shrink-0 w-72">
                            <div
                                className="flex items-center gap-2 p-3 rounded-t-lg"
                                style={{ backgroundColor: option.color + '20' }}
                            >
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: option.color }}
                                />
                                <span className="font-medium">{option.name}</span>
                                <Badge variant="secondary" className="ml-auto">{columnRows.length}</Badge>
                            </div>
                            <div className="bg-muted/30 rounded-b-lg p-2 min-h-[200px] space-y-2">
                                {columnRows.map(row => (
                                    <Card key={row.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                        <CardContent className="p-3">
                                            <p className="font-medium">{row.properties['title'] as string || 'Untitled'}</p>
                                            <div className="flex gap-2 mt-2">
                                                {selectedDatabase?.properties
                                                    .filter(p => p.id !== 'title' && p.id !== groupByProperty.id)
                                                    .slice(0, 2)
                                                    .map(prop => (
                                                        <span key={prop.id} className="text-xs text-muted-foreground">
                                                            {getCellValue(row, prop)}
                                                        </span>
                                                    ))
                                                }
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleAddRow}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> {t('database.addCard')}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="h-full flex">
                {/* Database Sidebar */}
                <aside className="w-64 border-r bg-muted/20 p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-lg">{t('database.title')}</h2>
                        <Dialog open={showNewDatabaseDialog} onOpenChange={setShowNewDatabaseDialog}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{t('database.createNew')}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                    <Input
                                        placeholder={t('database.namePlaceholder')}
                                        value={newDatabaseName}
                                        onChange={(e) => setNewDatabaseName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateDatabase()}
                                    />
                                    <Button onClick={handleCreateDatabase} className="w-full">
                                        {t('database.create')}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <ScrollArea className="h-[calc(100vh-200px)]">
                        <div className="space-y-1">
                            {databases.map(db => (
                                <button
                                    key={db.id}
                                    onClick={() => setSelectedDatabase(db)}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${selectedDatabase?.id === db.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    <span className="text-lg">{db.icon || '📊'}</span>
                                    <span className="truncate">{db.name}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 overflow-hidden">
                    {selectedDatabase ? (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{selectedDatabase.icon || '📊'}</span>
                                    <div>
                                        <h1 className="text-2xl font-bold">{selectedDatabase.name}</h1>
                                        {selectedDatabase.description && (
                                            <p className="text-muted-foreground text-sm">{selectedDatabase.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm">
                                        <Filter className="h-4 w-4 mr-2" />
                                        {t('database.filter')}
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <ArrowUpDown className="h-4 w-4 mr-2" />
                                        {t('database.sort')}
                                    </Button>
                                </div>
                            </div>

                            {/* View Tabs & Search */}
                            <div className="flex items-center justify-between mb-4">
                                <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as typeof currentView)}>
                                    <TabsList>
                                        <TabsTrigger value="table" className="gap-2">
                                            <TableIcon className="h-4 w-4" />
                                            {t('database.tableView')}
                                        </TabsTrigger>
                                        <TabsTrigger value="board" className="gap-2">
                                            <Kanban className="h-4 w-4" />
                                            {t('database.boardView')}
                                        </TabsTrigger>
                                        <TabsTrigger value="calendar" className="gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {t('database.calendarView')}
                                        </TabsTrigger>
                                        <TabsTrigger value="list" className="gap-2">
                                            <List className="h-4 w-4" />
                                            {t('database.listView')}
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t('database.search')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <ScrollArea className="h-[calc(100vh-280px)]">
                                {currentView === 'table' && <TableView />}
                                {currentView === 'board' && <BoardView />}
                                {currentView === 'calendar' && (
                                    <div className="text-center text-muted-foreground p-8">
                                        {t('database.calendarComingSoon')}
                                    </div>
                                )}
                                {currentView === 'list' && (
                                    <div className="space-y-2">
                                        {filteredRows.map(row => (
                                            <Card key={row.id} className="cursor-pointer hover:shadow-sm transition-shadow">
                                                <CardContent className="flex items-center justify-between p-4">
                                                    <span className="font-medium">{row.properties['title'] as string || 'Untitled'}</span>
                                                    <div className="flex items-center gap-4">
                                                        {selectedDatabase.properties
                                                            .filter(p => p.id !== 'title')
                                                            .slice(0, 3)
                                                            .map(prop => (
                                                                <span key={prop.id} className="text-sm text-muted-foreground">
                                                                    {getCellValue(row, prop)}
                                                                </span>
                                                            ))
                                                        }
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Button variant="ghost" className="w-full" onClick={handleAddRow}>
                                            <Plus className="h-4 w-4 mr-2" /> {t('database.newRow')}
                                        </Button>
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h2 className="text-2xl font-bold mb-2">{t('database.noDatabase')}</h2>
                            <p className="text-muted-foreground mb-4">{t('database.noDatabaseDesc')}</p>
                            <Button onClick={() => setShowNewDatabaseDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" /> {t('database.createFirst')}
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}

export default DatabasePage;
