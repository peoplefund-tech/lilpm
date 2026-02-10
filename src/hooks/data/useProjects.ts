/**
 * React Query hooks for projects
 * Provides cached project data with automatic deduplication
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './useQueryKeys';
import { projectService } from '@/lib/services';

/**
 * Hook to fetch team projects with caching
 */
export function useTeamProjects(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.all(teamId || ''),
    queryFn: () => projectService.getProjects(teamId!),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single project detail
 */
export function useProjectDetail(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId || ''),
    queryFn: () => projectService.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, data }: { teamId: string; data: { name: string; description?: string; status?: string } }) => {
      return projectService.createProject(teamId, data);
    },
    onSuccess: (_data, { teamId }) => {
      // Invalidate project list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(teamId) });
    },
  });
}

/**
 * Mutation to update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: Record<string, unknown> }) => {
      return projectService.updateProject(projectId, data);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      // Also invalidate the list - we don't know the teamId here, so invalidate all
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
