// User & Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Team & Workspace
export interface Team {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: UserRole;
  user: User;
  joinedAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  teamId: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

// Project
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  teamId: string;
  leadId?: string;
  status: ProjectStatus;
  startDate?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

// Issue Type
export type IssueType = 'epic' | 'user_story' | 'task' | 'subtask' | 'bug';

export const issueTypeLabels: Record<IssueType, string> = {
  epic: 'Epic',
  user_story: 'User Story',
  task: 'Task',
  subtask: 'Subtask',
  bug: 'Bug',
};

export const issueTypeIcons: Record<IssueType, string> = {
  epic: '⚡',
  user_story: '📖',
  task: '✅',
  subtask: '📋',
  bug: '🐛',
};

// Issue
export interface Issue {
  id: string;
  identifier: string; // e.g., "LIN-123"
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  projectId?: string;
  teamId: string;
  cycleId?: string;
  assigneeId?: string;
  creatorId: string;
  parentId?: string;
  labels: Label[];
  estimate?: number;
  dueDate?: string;
  sortOrder: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;

  // User Story specific fields
  acceptanceCriteria?: string[];

  // Relations (populated)
  assignee?: User;
  creator?: User;
  project?: Project;
  subIssues?: Issue[];
  // Dependencies
  blockedBy?: IssueDependency[];
  blocking?: IssueDependency[];
}

export interface IssueDependency {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  createdAt: string;
  // Populated
  sourceIssue?: Issue;
  targetIssue?: Issue;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';

export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Label {
  id: string;
  name: string;
  color: string;
  teamId: string;
}

// Cycle (Sprint)
export interface Cycle {
  id: string;
  name: string;
  number: number;
  teamId: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// Comments & Activity
export interface Comment {
  id: string;
  body: string;
  issueId: string;
  userId: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  issueId: string;
  userId: string;
  user: User;
  data: Record<string, unknown>;
  createdAt: string;
}

export type ActivityType =
  | 'issue_created'
  | 'issue_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'label_added'
  | 'label_removed'
  | 'comment_added';

// AI Provider
export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'auto';
export interface LilyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string; // Chain of thought reasoning
  timestamp: string;
  hasImages?: boolean; // True if user uploaded images with this message
  metadata?: {
    suggestedIssues?: Partial<Issue>[];
    suggestedPRD?: PRDDocument;
    dataSourceUsed?: string[];
  };
}

export interface PRDDocument {
  id: string;
  title: string;
  overview: string;
  goals: string[];
  userStories: UserStory[];
  requirements: Requirement[];
  timeline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserStory {
  id: string;
  persona: string;
  action: string;
  benefit: string;
}

export interface Requirement {
  id: string;
  type: 'functional' | 'non-functional';
  description: string;
  priority: IssuePriority;
}

// Real-time Collaboration
export interface Presence {
  odId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  focusedIssueId?: string;
  color: string;
}

export interface CollaborationState {
  roomId: string;
  users: Presence[];
  lastSync: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// View preferences
export interface ViewPreferences {
  layout: 'list' | 'board' | 'calendar' | 'gantt';
  groupBy: 'status' | 'priority' | 'assignee' | 'project' | 'cycle' | 'none';
  sortBy: 'created' | 'updated' | 'priority' | 'status' | 'title';
  sortOrder: 'asc' | 'desc';
  filters: ViewFilters;
}

export interface ViewFilters {
  status?: IssueStatus[];
  priority?: IssuePriority[];
  assigneeId?: string[];
  projectId?: string[];
  labelId?: string[];
  search?: string;
}
