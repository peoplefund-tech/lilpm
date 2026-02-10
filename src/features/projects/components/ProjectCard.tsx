import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@/types/database';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Archive, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onArchive?: (project: Project) => void;
  onClick?: (project: Project) => void;
}

const PROJECT_ICONS: Record<string, string> = {
  folder: '📁',
  rocket: '🚀',
  star: '⭐',
  lightning: '⚡',
  target: '🎯',
  gem: '💎',
  fire: '🔥',
  heart: '❤️',
};

export function ProjectCard({ project, onEdit, onDelete, onArchive, onClick }: ProjectCardProps) {
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    planned: { label: t('projects.planned', 'Planned'), variant: 'outline' },
    in_progress: { label: t('projects.in_progress', 'In Progress'), variant: 'default' },
    paused: { label: t('projects.paused', 'Paused'), variant: 'secondary' },
    completed: { label: t('projects.completed', 'Completed'), variant: 'secondary' },
    cancelled: { label: t('projects.cancelled', 'Cancelled'), variant: 'destructive' },
  };

  const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.planned;
  const icon = PROJECT_ICONS[project.icon || 'folder'] || '📁';

  return (
    <Card 
      className="group hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => onClick?.(project)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${project.color}20` }}
            >
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-white">{project.name}</h3>
              <Badge variant={statusInfo.variant} className="mt-1">
                {statusInfo.label}
              </Badge>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit?.(project)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('common.edit', 'Edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive?.(project)}>
                <Archive className="h-4 w-4 mr-2" />
                {t('common.archive', 'Archive')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete?.(project)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common.delete', 'Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        {project.description && (
          <p className="text-sm text-slate-400 line-clamp-2 mb-3">
            {project.description}
          </p>
        )}
        
        {(project.start_date || project.target_date) && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="h-3 w-3" />
            {project.start_date && (
              <span>
                {format(new Date(project.start_date), 'MMM d일', { locale: ko })}
              </span>
            )}
            {project.start_date && project.target_date && <span>→</span>}
            {project.target_date && (
              <span>
                {format(new Date(project.target_date), 'MMM d일', { locale: ko })}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
