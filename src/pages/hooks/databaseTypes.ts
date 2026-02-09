import React from 'react';
import {
    Hash, Type, CalendarIcon, User, Link, CheckSquare,
    Percent, ArrowUpDown, Clock, Mail, Phone, Tag, FileText
} from 'lucide-react';

// Database property types (Notion-style)
export type PropertyType =
    | 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'person'
    | 'checkbox' | 'url' | 'email' | 'phone' | 'formula' | 'relation'
    | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time'
    | 'last_edited_by' | 'files' | 'status';

export interface DatabaseProperty {
    id: string;
    name: string;
    type: PropertyType;
    options?: { id: string; name: string; color: string }[];
    formula?: string;
    relationDatabaseId?: string;
    rollupProperty?: string;
}

export interface DatabaseRow {
    id: string;
    properties: Record<string, unknown>;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}

export interface Database {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    properties: DatabaseProperty[];
    rows: DatabaseRow[];
    views: DatabaseView[];
    createdAt: string;
    teamId: string;
}

export interface DatabaseView {
    id: string;
    name: string;
    type: 'table' | 'board' | 'calendar' | 'list' | 'gallery' | 'timeline';
    filters?: unknown[];
    sorts?: unknown[];
    groupBy?: string;
    visibleProperties?: string[];
}

export const PROPERTY_ICONS: Record<PropertyType, React.ElementType> = {
    text: Type,
    number: Hash,
    select: Tag,
    multi_select: Tag,
    date: CalendarIcon,
    person: User,
    checkbox: CheckSquare,
    url: Link,
    email: Mail,
    phone: Phone,
    formula: Percent,
    relation: Link,
    rollup: ArrowUpDown,
    created_time: Clock,
    created_by: User,
    last_edited_time: Clock,
    last_edited_by: User,
    files: FileText,
    status: Tag,
};

export const PROPERTY_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
];
