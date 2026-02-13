import { apiClient } from '@/lib/api/client';
import type { Cycle, CycleStatus, Issue } from '@/types/database';

export const cycleService = {
  async getCycles(teamId: string): Promise<Cycle[]> {
    const res = await apiClient.get<Cycle[]>(`/${teamId}/cycles`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getCycle(cycleId: string): Promise<Cycle | null> {
    const res = await apiClient.get<Cycle>(`/cycles/${cycleId}`);
    if (res.error) throw new Error(res.error);
    return res.data || null;
  },

  async getActiveCycle(teamId: string): Promise<Cycle | null> {
    const res = await apiClient.get<Cycle[]>(`/${teamId}/cycles`);
    if (res.error) throw new Error(res.error);
    const cycles = res.data || [];
    return cycles.find((c) => c.status === 'active') || null;
  },

  async createCycle(
    teamId: string,
    cycleData: {
      name: string;
      number: number;
      description?: string;
      start_date: string;
      end_date: string;
    }
  ): Promise<Cycle> {
    const res = await apiClient.post<Cycle>(`/${teamId}/cycles`, {
      name: cycleData.name,
      number: cycleData.number,
      description: cycleData.description,
      startDate: cycleData.start_date,
      endDate: cycleData.end_date,
      status: 'upcoming' as CycleStatus,
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateCycle(cycleId: string, updates: Partial<Cycle>): Promise<Cycle> {
    const res = await apiClient.put<Cycle>(`/cycles/${cycleId}`, updates);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async deleteCycle(cycleId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/cycles/${cycleId}`);
    if (res.error) throw new Error(res.error);
  },

  async startCycle(cycleId: string): Promise<Cycle> {
    return this.updateCycle(cycleId, { status: 'active' });
  },

  async completeCycle(cycleId: string): Promise<Cycle> {
    return this.updateCycle(cycleId, { status: 'completed' });
  },

  async getCycleIssues(cycleId: string): Promise<Issue[]> {
    const res = await apiClient.get<Issue[]>(`/cycles/${cycleId}/issues`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async addIssueToCycle(issueId: string, cycleId: string): Promise<void> {
    const res = await apiClient.put<void>(`/issues/${issueId}`, { cycleId });
    if (res.error) throw new Error(res.error);
  },

  async removeIssueFromCycle(issueId: string): Promise<void> {
    const res = await apiClient.put<void>(`/issues/${issueId}`, { cycleId: null });
    if (res.error) throw new Error(res.error);
  },

  async getNextCycleNumber(teamId: string): Promise<number> {
    const res = await apiClient.get<Cycle[]>(`/${teamId}/cycles`);
    if (res.error) throw new Error(res.error);
    const cycles = res.data || [];
    const maxNumber = Math.max(...cycles.map((c) => c.number || 0), 0);
    return maxNumber + 1;
  },
};
