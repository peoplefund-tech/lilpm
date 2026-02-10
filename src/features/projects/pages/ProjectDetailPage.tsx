import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { projectService } from '@/lib/services';
import { issueService } from '@/lib/services';
import { teamMemberService } from '@/lib/services/teamService';
import { prdService, type PRDWithRelations } from '@/features/prd';
import {
  ProjectStatsCard,
  ProjectProgressChart,
  ProjectMembersList,
  ProjectActivityTimeline,
  EditProjectModal
} from '@/components/projects';
import { IssueRow } from '@/components/issues';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Settings,
  Calendar,
  Loader2,
  FolderOpen,
  ListTodo,
  BarChart3,
  Users,
  FileText,
  Plus,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import type { Project, Issue, Profile } from '@/types/database';



const STATUS_COLORS: Record<string, string> = {
  backlog: '#6b7280',
  todo: '#3b82f6',
  in_progress: '#f59e0b',
  in_review: '#8b5cf6',
  done: '#22c55e',
  cancelled: '#ef4444',
};

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentTeam } = useTeamStore();

  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [prds, setPrds] = useState<PRDWithRelations[]>([]);
  const [members, setMembers] = useState<{ profile: Profile; role: string; issueCount: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // Remember last viewed tab
  const [activeTab, setActiveTab] = useState(() => {
    if (!projectId) return 'overview';
    return localStorage.getItem(`project-${projectId}-lastTab`) || 'overview';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (projectId) {
      localStorage.setItem(`project-${projectId}-lastTab`, tab);
    }
  };

  const loadProject = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const projectData = await projectService.getProject(projectId);
      setProject(projectData);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const loadIssues = useCallback(async () => {
    if (!currentTeam?.id || !projectId) return;

    try {
      const allIssues = await issueService.getIssues(currentTeam.id, { project_id: projectId } as any);
      setIssues(allIssues);
    } catch (error) {
      console.error('Failed to load issues:', error);
    }
  }, [currentTeam?.id, projectId]);

  const loadPRDs = useCallback(async () => {
    if (!projectId) return;

    try {
      const linkedPRDs = await prdService.getPRDsForProject(projectId);
      setPrds(linkedPRDs);
    } catch (error) {
      console.error('Failed to load linked PRDs:', error);
    }
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    if (!currentTeam?.id) return;

    try {
      const membersData = await teamMemberService.getMembers(currentTeam.id);

      // Count issues per member
      const memberIssueCount = issues.reduce((acc, issue) => {
        if (issue.assignee_id) {
          acc[issue.assignee_id] = (acc[issue.assignee_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      setMembers(membersData.map((m) => ({
        profile: m.profile,
        role: m.role,
        issueCount: memberIssueCount[m.profile.id] || 0,
      })));
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }, [currentTeam?.id, issues]);

  useEffect(() => {
    loadProject();
    loadIssues();
    loadPRDs();
  }, [loadProject, loadIssues, loadPRDs]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Calculate stats
  const stats = {
    totalIssues: issues.length,
    completedIssues: issues.filter((i) => i.status === 'done').length,
    inProgressIssues: issues.filter((i) => i.status === 'in_progress').length,
    overdueIssues: issues.filter((i) => {
      if (!i.due_date) return false;
      return new Date(i.due_date) < new Date() && i.status !== 'done';
    }).length,
    memberCount: members.length,
  };

  // Status distribution for chart
  const statusData = [
    { status: 'backlog', count: issues.filter((i) => i.status === 'backlog').length, color: STATUS_COLORS.backlog },
    { status: 'todo', count: issues.filter((i) => i.status === 'todo').length, color: STATUS_COLORS.todo },
    { status: 'in_progress', count: issues.filter((i) => i.status === 'in_progress').length, color: STATUS_COLORS.in_progress },
    { status: 'in_review', count: issues.filter((i) => i.status === 'in_review').length, color: STATUS_COLORS.in_review },
    { status: 'done', count: issues.filter((i) => i.status === 'done').length, color: STATUS_COLORS.done },
    { status: 'cancelled', count: issues.filter((i) => i.status === 'cancelled').length, color: STATUS_COLORS.cancelled },
  ].filter((d) => d.count > 0);

  // Mock activities from issues
  const activities = issues.slice(0, 5).map((issue) => ({
    id: issue.id,
    type: 'issue_created' as const,
    user: {
      name: t('common.user'),
      avatarUrl: undefined,
    },
    issueTitle: issue.title,
    createdAt: issue.created_at,
  }));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <FolderOpen className="h-12 w-12 text-slate-400" />
          <p className="text-lg font-medium">{t('projects.notFound')}</p>
          <p className="text-sm text-slate-400 text-center max-w-md">
            {t('projects.notFoundOrNoAccess', '프로젝트를 찾을 수 없거나 접근 권한이 없습니다. 팀 관리자에게 프로젝트 할당을 요청하세요.')}
          </p>
          <Button onClick={() => navigate('/projects')}>{t('projects.backToList')}</Button>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div className="h-full overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0d0d0f]/95 backdrop-blur z-10 border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">{project.name}</h1>
                  <Badge variant="outline">{t(`projects.${project.status}`)}</Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-slate-400 mt-0.5">{project.description}</p>
                )}
                {(project.start_date || project.target_date) && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Calendar className="h-3 w-3" />
                    {project.start_date && format(new Date(project.start_date), 'PP', { locale: dateLocale })}
                    {project.start_date && project.target_date && ' → '}
                    {project.target_date && format(new Date(project.target_date), 'PP', { locale: dateLocale })}
                  </div>
                )}
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              {t('common.settings')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                {t('projects.overview')}
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-1.5">
                <ListTodo className="h-4 w-4" />
                {t('issues.title')} ({issues.length})
              </TabsTrigger>
              <TabsTrigger value="prds" className="gap-1.5">
                <FileText className="h-4 w-4" />
                PRDs ({prds.length})
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                <Users className="h-4 w-4" />
                {t('projects.members')} ({members.length})
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProjectStatsCard stats={stats} />
                <ProjectProgressChart data={statusData} />
              </div>
              <ProjectActivityTimeline activities={activities} />
            </TabsContent>

            {/* Issues Tab */}
            <TabsContent value="issues">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">{t('issues.title')}</h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/issue/new?projectId=${projectId}`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('issues.createNew', '새 이슈')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/lily?context=project&projectId=${projectId}&projectName=${encodeURIComponent(project?.name || '')}&type=issue`)}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    {t('common.aiCreate', 'AI로 작성')}
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border">
                {issues.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('issues.noIssues')}</p>
                  </div>
                ) : (
                  issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => navigate(`/issue/${issue.id}`)}
                    >
                      <IssueRow
                        issue={issue as any}
                        isSelected={false}
                        onSelect={() => { }}
                      />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* PRDs Tab */}
            <TabsContent value="prds">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">PRDs</h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/prd/new?projectId=${projectId}`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('prd.createNew', '새 PRD')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/lily?context=project&projectId=${projectId}&projectName=${encodeURIComponent(project?.name || '')}&type=prd`)}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    {t('common.aiCreate', 'AI로 작성')}
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border">
                {prds.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('prd.noPRDs', 'No PRDs linked to this project')}</p>
                    <p className="text-xs mt-1">{t('prd.linkFromPRD', 'Link PRDs from the PRD detail page')}</p>
                  </div>
                ) : (
                  prds.map((prd) => (
                    <div
                      key={prd.id}
                      className="p-4 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between"
                      onClick={() => navigate(`/prd/${prd.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="font-medium">{prd.title || t('prd.untitled')}</p>
                          {prd.overview && (
                            <p className="text-sm text-slate-400 line-clamp-1">{prd.overview}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline">{prd.status || 'draft'}</Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members">
              <ProjectMembersList
                members={members as any}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit Modal */}
        <EditProjectModal
          project={project}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={loadProject}
        />
      </div>
    </AppLayout>
  );
}
