import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { projectService } from '@/lib/services/projectService';
import { projectMemberService } from '@/lib/services/projectMemberService';
import type { Project, Profile, ProjectMemberRole } from '@/types/database';

interface ProjectAssignmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: {
        user_id: string;
        profile?: Profile | null;
    } | null;
    teamId: string;
}

export function ProjectAssignmentModal({
    open,
    onOpenChange,
    member,
    teamId,
}: ProjectAssignmentModalProps) {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [originalAssigned, setOriginalAssigned] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (open && member && teamId) {
            loadData();
        }
    }, [open, member, teamId]);

    const loadData = async () => {
        if (!member) return;

        setIsLoading(true);
        try {
            // Load all projects in the team
            const teamProjects = await projectService.getProjects(teamId);
            setProjects(teamProjects);

            // Load user's current project assignments
            const userProjects = await projectMemberService.getUserProjects(member.user_id, teamId);
            const assignedIds = new Set(userProjects.map(p => p.project.id));
            setAssignedProjectIds(assignedIds);
            setOriginalAssigned(new Set(assignedIds));
        } catch (error) {
            console.error('Failed to load project data:', error);
            toast.error(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleProject = (projectId: string) => {
        setAssignedProjectIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        if (!member) return;

        setIsSaving(true);
        try {
            // Find projects to add and remove
            const toAdd = [...assignedProjectIds].filter(id => !originalAssigned.has(id));
            const toRemove = [...originalAssigned].filter(id => !assignedProjectIds.has(id));

            // Process all changes
            await Promise.all([
                ...toAdd.map(projectId =>
                    projectMemberService.assignMember(projectId, member.user_id, 'member')
                ),
                ...toRemove.map(projectId =>
                    projectMemberService.unassignMember(projectId, member.user_id)
                ),
            ]);

            toast.success(t('team.projectsUpdated', '프로젝트 할당이 업데이트되었습니다'));
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to update project assignments:', error);
            toast.error(t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = () => {
        if (assignedProjectIds.size !== originalAssigned.size) return true;
        for (const id of assignedProjectIds) {
            if (!originalAssigned.has(id)) return true;
        }
        return false;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5" />
                        {t('team.manageProjects', '프로젝트 할당 관리')}
                    </DialogTitle>
                </DialogHeader>

                {member && (
                    <p className="text-sm text-muted-foreground">
                        {member.profile?.name || 'User'}님의 프로젝트 접근 권한을 설정합니다.
                    </p>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{t('projects.noProjects', '프로젝트가 없습니다')}</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {projects.map((project) => (
                            <label
                                key={project.id}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                                <Checkbox
                                    checked={assignedProjectIds.has(project.id)}
                                    onCheckedChange={() => handleToggleProject(project.id)}
                                />
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || '#6b7280' }}
                                />
                                <span className="flex-1 text-sm font-medium">{project.name}</span>
                                <Badge variant="outline" className="text-xs">
                                    {project.status}
                                </Badge>
                            </label>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges() || isSaving}
                    >
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('common.save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
