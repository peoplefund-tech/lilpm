// Database types generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export type TeamRole = 'owner' | 'admin' | 'member' | 'guest';
export type AppRole = 'super_admin' | 'admin' | 'user';
export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type IssueType = 'epic' | 'user_story' | 'task' | 'subtask' | 'bug';
export type CycleStatus = 'upcoming' | 'active' | 'completed';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type ActivityType =
  | 'issue_created'
  | 'issue_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'label_added'
  | 'label_removed'
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted';
export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'auto';

// Table Types
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  timezone: string;
  preferred_ai_provider: AIProvider;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Json;
  issue_prefix: string;
  issue_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  status: InviteStatus;
  invited_by: string | null;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  lead_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  team_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface Cycle {
  id: string;
  team_id: string;
  name: string;
  number: number;
  description: string | null;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  team_id: string;
  project_id: string | null;
  cycle_id: string | null;
  parent_id: string | null;
  identifier: string;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_id: string | null;
  creator_id: string;
  estimate: number | null;
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
  acceptance_criteria: Json | null;
  created_at: string;
  updated_at: string;
}

export interface IssueLabel {
  issue_id: string;
  label_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  issue_id: string;
  user_id: string | null;
  type: ActivityType;
  data: Json;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  team_id: string | null;
  project_id: string | null;
  title: string | null;
  ai_provider: AIProvider;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Json;
  tokens_used: number | null;
  ai_provider: AIProvider | null;
  created_at: string;
}

export interface PRDDocument {
  id: string;
  conversation_id: string | null;
  team_id: string;
  project_id: string | null;
  created_by: string;
  title: string;
  overview: string | null;
  content: string | null; // Rich text content (HTML)
  goals: Json;
  user_stories: Json;
  requirements: Json;
  timeline: string | null;
  status: 'draft' | 'review' | 'approved' | 'archived';
  version: number;
  created_at: string;
  updated_at: string;
}

export interface UserAISettings {
  id: string;
  user_id: string;
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  default_provider: AIProvider;
  auto_mode_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface TeamMemberWithProfile extends TeamMember {
  profile: Profile;
}

export interface IssueWithRelations extends Issue {
  assignee?: Profile | null;
  creator?: Profile | null;
  project?: Project | null;
  labels?: Label[];
  sub_issues?: Issue[];
}

export interface CommentWithUser extends Comment {
  user: Profile;
}

export interface ActivityWithUser extends Activity {
  user: Profile | null;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferred_ai_provider?: AIProvider;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferred_ai_provider?: AIProvider;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: UserRole;
        Insert: {
          id?: string;
          user_id: string;
          role?: AppRole;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: AppRole;
        };
      };
      teams: {
        Row: Team;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          settings?: Json;
          issue_prefix?: string;
          issue_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          settings?: Json;
          issue_prefix?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: TeamMember;
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: TeamRole;
          joined_at?: string;
        };
        Update: {
          role?: TeamRole;
        };
      };
      team_invites: {
        Row: TeamInvite;
        Insert: {
          id?: string;
          team_id: string;
          email: string;
          role?: TeamRole;
          status?: InviteStatus;
          invited_by?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: TeamRole;
          status?: InviteStatus;
        };
      };
      projects: {
        Row: Project;
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          slug: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          lead_id?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          lead_id?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          target_date?: string | null;
          updated_at?: string;
        };
      };
      labels: {
        Row: Label;
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          color?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          description?: string | null;
        };
      };
      cycles: {
        Row: Cycle;
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          number: number;
          description?: string | null;
          start_date: string;
          end_date: string;
          status?: CycleStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          number?: number;
          description?: string | null;
          start_date?: string;
          end_date?: string;
          status?: CycleStatus;
          updated_at?: string;
        };
      };
      issues: {
        Row: Issue;
        Insert: {
          id?: string;
          team_id: string;
          project_id?: string | null;
          cycle_id?: string | null;
          parent_id?: string | null;
          identifier: string;
          title: string;
          description?: string | null;
          status?: IssueStatus;
          priority?: IssuePriority;
          assignee_id?: string | null;
          creator_id: string;
          estimate?: number | null;
          due_date?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          cycle_id?: string | null;
          parent_id?: string | null;
          title?: string;
          description?: string | null;
          status?: IssueStatus;
          priority?: IssuePriority;
          assignee_id?: string | null;
          estimate?: number | null;
          due_date?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
      };
      issue_labels: {
        Row: IssueLabel;
        Insert: {
          issue_id: string;
          label_id: string;
          created_at?: string;
        };
        Update: never;
      };
      comments: {
        Row: Comment;
        Insert: {
          id?: string;
          issue_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: Activity;
        Insert: {
          id?: string;
          issue_id: string;
          user_id?: string | null;
          type: ActivityType;
          data?: Json;
          created_at?: string;
        };
        Update: never;
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          user_id: string;
          team_id?: string | null;
          project_id?: string | null;
          title?: string | null;
          ai_provider?: AIProvider;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_id?: string | null;
          project_id?: string | null;
          title?: string | null;
          ai_provider?: AIProvider;
          updated_at?: string;
        };
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata?: Json;
          tokens_used?: number | null;
          ai_provider?: AIProvider | null;
          created_at?: string;
        };
        Update: never;
      };
      prd_documents: {
        Row: PRDDocument;
        Insert: {
          id?: string;
          conversation_id?: string | null;
          team_id: string;
          project_id?: string | null;
          created_by: string;
          title: string;
          overview?: string | null;
          goals?: Json;
          user_stories?: Json;
          requirements?: Json;
          timeline?: string | null;
          status?: 'draft' | 'review' | 'approved' | 'archived';
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          overview?: string | null;
          goals?: Json;
          user_stories?: Json;
          requirements?: Json;
          timeline?: string | null;
          status?: 'draft' | 'review' | 'approved' | 'archived';
          version?: number;
          updated_at?: string;
        };
      };
      user_ai_settings: {
        Row: UserAISettings;
        Insert: {
          id?: string;
          user_id: string;
          anthropic_api_key?: string | null;
          openai_api_key?: string | null;
          gemini_api_key?: string | null;
          default_provider?: AIProvider;
          auto_mode_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          anthropic_api_key?: string | null;
          openai_api_key?: string | null;
          gemini_api_key?: string | null;
          default_provider?: AIProvider;
          auto_mode_enabled?: boolean;
          updated_at?: string;
        };
      };
    };
    Functions: {
      has_app_role: {
        Args: { _user_id: string; _role: AppRole };
        Returns: boolean;
      };
      is_team_member: {
        Args: { _user_id: string; _team_id: string };
        Returns: boolean;
      };
      has_team_role: {
        Args: { _user_id: string; _team_id: string; _role: TeamRole };
        Returns: boolean;
      };
      get_team_role: {
        Args: { _user_id: string; _team_id: string };
        Returns: TeamRole | null;
      };
      generate_issue_identifier: {
        Args: { _team_id: string };
        Returns: string;
      };
    };
    Enums: {
      team_role: TeamRole;
      app_role: AppRole;
      project_status: ProjectStatus;
      issue_status: IssueStatus;
      issue_priority: IssuePriority;
      cycle_status: CycleStatus;
      invite_status: InviteStatus;
      activity_type: ActivityType;
      ai_provider: AIProvider;
    };
  };
}
