import { apiClient } from '@/lib/api/client';
import type { Issue } from '@/types/database';

export interface IssueTemplate {
    id: string;
    team_id: string;
    name: string;
    description: string | null;
    icon: string;
    default_title: string | null;
    default_description: string | null;
    default_status: string;
    default_priority: string;
    default_labels: string[];
    default_estimate: number | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export type CreateTemplateInput = Omit<IssueTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export const issueTemplateService = {
    /**
     * Get all templates for a team
     */
    async getTemplates(teamId: string): Promise<IssueTemplate[]> {
        const res = await apiClient.get<IssueTemplate[]>(`/${teamId}/issue-templates`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    /**
     * Get a single template by ID
     */
    async getTemplate(templateId: string): Promise<IssueTemplate | null> {
        const res = await apiClient.get<IssueTemplate>(`/issue-templates/${templateId}`);
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    /**
     * Create a new template
     */
    async createTemplate(template: CreateTemplateInput): Promise<IssueTemplate> {
        const res = await apiClient.post<IssueTemplate>(
            `/${template.team_id}/issue-templates`,
            template
        );
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    /**
     * Update a template
     */
    async updateTemplate(templateId: string, updates: UpdateTemplateInput): Promise<IssueTemplate> {
        const res = await apiClient.put<IssueTemplate>(
            `/issue-templates/${templateId}`,
            updates
        );
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    /**
     * Delete a template (soft delete by deactivating)
     */
    async deleteTemplate(templateId: string): Promise<void> {
        const res = await apiClient.delete(`/issue-templates/${templateId}`);
        if (res.error) throw new Error(res.error);
    },

    /**
     * Apply a template to create issue defaults
     */
    applyTemplate(template: IssueTemplate): { title: string; description: string; status: string; priority: string; estimate?: number } {
        return {
            title: template.default_title || '',
            description: template.default_description || '',
            status: template.default_status,
            priority: template.default_priority,
            estimate: template.default_estimate || undefined,
        };
    },

    /**
     * Get built-in template suggestions (for teams without templates)
     */
    getBuiltInTemplates(): Omit<IssueTemplate, 'id' | 'team_id' | 'created_at' | 'updated_at' | 'created_by'>[] {
        return [
            {
                name: 'Bug Report',
                description: 'Report a bug or issue',
                icon: '🐛',
                default_title: '[Bug] ',
                default_description: '## Description\nDescribe the bug\n\n## Steps to Reproduce\n1. \n2. \n\n## Expected Behavior\n\n## Actual Behavior\n',
                default_status: 'backlog',
                default_priority: 'high',
                default_labels: ['bug'],
                default_estimate: null,
                is_active: true,
                sort_order: 0,
            },
            {
                name: 'Feature Request',
                description: 'Request a new feature',
                icon: '✨',
                default_title: '[Feature] ',
                default_description: '## Feature Description\n\n## Use Case\n\n## Acceptance Criteria\n- [ ] \n- [ ] \n',
                default_status: 'backlog',
                default_priority: 'medium',
                default_labels: ['feature'],
                default_estimate: null,
                is_active: true,
                sort_order: 1,
            },
            {
                name: 'Task',
                description: 'General task or todo item',
                icon: '📝',
                default_title: '',
                default_description: '## Task Description\n\n## Checklist\n- [ ] \n',
                default_status: 'todo',
                default_priority: 'none',
                default_labels: [],
                default_estimate: null,
                is_active: true,
                sort_order: 2,
            },
            {
                name: 'User Story',
                description: 'User story format',
                icon: '👤',
                default_title: '[Story] ',
                default_description: '## User Story\n**As a** [user type]\n**I want** [action]\n**So that** [benefit]\n\n## Acceptance Criteria\n- [ ] \n- [ ] \n',
                default_status: 'backlog',
                default_priority: 'medium',
                default_labels: ['story'],
                default_estimate: null,
                is_active: true,
                sort_order: 3,
            },
        ];
    },
};
