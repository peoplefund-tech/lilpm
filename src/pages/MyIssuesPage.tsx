import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Calendar,
  FolderKanban,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { supabase } from '@/lib/supabase';
import { StatusIcon, PriorityIcon } from '@/components/issues/IssueIcons';
import { IssueTypeIcon } from '@/components/issues/IssueTypeIcon';
import type { Issue, IssueStatus, IssueType, Team, Project, Profile } from '@/types/database';

interface IssueWithDetails extends Issue {
  team?: Team;
  project?: Project | null;
  assigner?: Profile | null;
}

export function MyIssuesPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const { user } = useAuthStore();
  const { teams } = useTeamStore();
  
  const [issues, setIssues] = useState<IssueWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active');

  const loadMyIssues = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch all issues assigned to me across all teams
      const { data: issuesData, error } = await supabase
        .from('issues')
        .select(`
          *,
          project:projects(*)
        `)
        .eq('assignee_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Get unique team IDs
      const teamIds = [...new Set((issuesData || []).map(i => i.team_id))];
      
      // Fetch teams info
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);
      
      const teamsMap = new Map((teamsData || []).map(t => [t.id, t]));
      
      // Get unique creator IDs for assigner info
      const creatorIds = [...new Set((issuesData || []).map(i => i.creator_id).filter(Boolean))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', creatorIds);
      
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      // Combine data
      const enrichedIssues: IssueWithDetails[] = (issuesData || []).map(issue => ({
        ...issue,
        team: teamsMap.get(issue.team_id),
        assigner: profilesMap.get(issue.creator_id) || null,
      }));
      
      setIssues(enrichedIssues);
    } catch (error) {
      console.error('Failed to load my issues:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMyIssues();
  }, [loadMyIssues]);

  const filteredIssues = issues.filter(issue => {
    if (filter === 'active') {
      return !['done', 'cancelled'].includes(issue.status);
    }
    if (filter === 'done') {
      return issue.status === 'done';
    }
    return true;
  });

  const groupedByTeam = filteredIssues.reduce((groups, issue) => {
    const teamId = issue.team_id;
    if (!groups[teamId]) {
      groups[teamId] = {
        team: issue.team,
        issues: [],
      };
    }
    groups[teamId].issues.push(issue);
    return groups;
  }, {} as Record<string, { team?: Team; issues: IssueWithDetails[] }>);

  const getStatusColor = (status: IssueStatus) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'in_review': return 'bg-purple-500';
      case 'todo': return 'bg-yellow-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('nav.myIssues')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('myIssues.description', '나에게 할당된 모든 이슈를 확인하세요')}
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">
            {filteredIssues.length} {t('issues.issues', '이슈')}
          </Badge>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('myIssues.active', '진행중')} ({issues.filter(i => !['done', 'cancelled'].includes(i.status)).length})
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t('myIssues.done', '완료')} ({issues.filter(i => i.status === 'done').length})
            </TabsTrigger>
            <TabsTrigger value="all">
              {t('myIssues.all', '전체')} ({issues.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t('myIssues.noIssues', '할당된 이슈가 없습니다')}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {t('myIssues.noIssuesDescription', '팀원이 이슈를 할당하면 여기에 표시됩니다.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByTeam).map(([teamId, { team, issues: teamIssues }]) => (
              <Card key={teamId}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {team?.name || t('common.unknownTeam', 'Unknown Team')}
                    <Badge variant="secondary">{teamIssues.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {teamIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/issue/${issue.id}`)}
                      >
                        <IssueTypeIcon type={(issue.type as IssueType) || 'task'} size="sm" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier}
                            </span>
                            <div className={cn("h-2 w-2 rounded-full", getStatusColor(issue.status))} />
                          </div>
                          
                          <p className="font-medium text-sm truncate">{issue.title}</p>
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            {issue.project && (
                              <span className="flex items-center gap-1">
                                <FolderKanban className="h-3 w-3" />
                                {issue.project.name}
                              </span>
                            )}
                            
                            {issue.assigner && (
                              <span className="flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={issue.assigner.avatar_url || undefined} />
                                  <AvatarFallback className="text-[8px]">
                                    {issue.assigner.name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                {t('myIssues.assignedBy', '{{name}}님이 할당', { name: issue.assigner.name })}
                              </span>
                            )}
                            
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true, locale })}
                            </span>

                            {issue.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(issue.due_date), 'MMM d', { locale })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PriorityIcon priority={issue.priority} />
                          <StatusIcon status={issue.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
