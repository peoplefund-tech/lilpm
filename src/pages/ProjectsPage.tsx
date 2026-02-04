import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { projectService } from '@/lib/services/projectService';
import { CreateProjectModal, EditProjectModal, ProjectCard } from '@/components/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@/types/database';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentTeam } = useTeamStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  const loadProjects = async () => {
    if (!currentTeam) return;
    
    setIsLoading(true);
    try {
      const data = await projectService.getProjects(currentTeam.id);
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [currentTeam?.id]);

  const handleDelete = async () => {
    if (!deleteProject) return;
    
    try {
      await projectService.deleteProject(deleteProject.id);
      toast.success(t('projects.projectDeleted'));
      setDeleteProject(null);
      loadProjects();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleArchive = async (project: Project) => {
    try {
      await projectService.updateProject(project.id, { status: 'cancelled' } as any);
      toast.success(t('projects.projectUpdated'));
      loadProjects();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t('projects.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('projects.createFirstProject')}
            </p>
          </div>
          
          <Button onClick={() => setCreateOpen(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {t('projects.newProject')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('issues.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? t('common.noData') : t('projects.noProjects')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? t('common.noData')
                : t('projects.createFirstProject')}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('projects.createProject')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
                onEdit={setEditProject}
                onDelete={setDeleteProject}
                onArchive={handleArchive}
              />
            ))}
          </div>
        )}

        {/* Create Modal */}
        <CreateProjectModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={loadProjects}
        />

        {/* Edit Modal */}
        <EditProjectModal
          project={editProject}
          open={!!editProject}
          onOpenChange={(open) => !open && setEditProject(null)}
          onSuccess={loadProjects}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteProject} onOpenChange={(open) => !open && setDeleteProject(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('common.confirm')} "{deleteProject?.name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
