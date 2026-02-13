import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  date,
  primaryKey,
  unique,
  check,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const teamRoleEnum = pgEnum('team_role', [
  'owner',
  'admin',
  'member',
  'guest',
]);

export const appRoleEnum = pgEnum('app_role', [
  'super_admin',
  'admin',
  'user',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);

export const issueStatusEnum = pgEnum('issue_status', [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
]);

export const issuePriorityEnum = pgEnum('issue_priority', [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]);

export const cycleStatusEnum = pgEnum('cycle_status', [
  'upcoming',
  'active',
  'completed',
]);

export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
]);

export const activityTypeEnum = pgEnum('activity_type', [
  'issue_created',
  'issue_updated',
  'status_changed',
  'priority_changed',
  'assignee_changed',
  'label_added',
  'label_removed',
  'comment_added',
  'comment_updated',
  'comment_deleted',
]);

export const aiProviderEnum = pgEnum('ai_provider', [
  'anthropic',
  'openai',
  'gemini',
  'auto',
]);

// ============================================================
// CUSTOM TYPES
// ============================================================

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const uuidArray = customType<{ data: string[]; driverData: string[] }>({
  dataType() {
    return 'uuid[]';
  },
});

const textArray = customType<{ data: string[]; driverData: string[] }>({
  dataType() {
    return 'text[]';
  },
});

// ============================================================
// TABLES
// ============================================================

// ----- users (custom auth) -----
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifyToken: text('email_verify_token'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: timestamp('password_reset_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- refresh_tokens -----
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- profiles -----
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => users.id),
  email: text('email'),
  fullName: text('full_name'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').default('UTC'),
  preferredAiProvider: aiProviderEnum('preferred_ai_provider').default('anthropic'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- user_roles -----
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: appRoleEnum('role').default('user').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('user_roles_user_id_role_unique').on(table.userId, table.role),
  ]
);

// ----- teams -----
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  logoUrl: text('logo_url'),
  avatarUrl: text('avatar_url'),
  settings: jsonb('settings').default(sql`'{}'::jsonb`),
  issuePrefix: text('issue_prefix').default('ISS'),
  issueCount: integer('issue_count').default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- team_members -----
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('team_members_team_id_user_id_unique').on(table.teamId, table.userId),
  ]
);

// ----- team_invites -----
export const teamInvites = pgTable('team_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: teamRoleEnum('role').default('member').notNull(),
  status: inviteStatusEnum('status').default('pending').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  projectIds: uuidArray('project_ids'),
});

// ----- projects -----
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug'),
    description: text('description'),
    color: text('color').default('#6366F1'),
    icon: text('icon'),
    leadId: uuid('lead_id').references(() => users.id),
    status: projectStatusEnum('status').default('planned'),
    startDate: date('start_date'),
    targetDate: date('target_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('projects_team_id_slug_unique').on(table.teamId, table.slug),
  ]
);

// ----- labels -----
export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').default('#6366F1'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('labels_team_id_name_unique').on(table.teamId, table.name),
  ]
);

// ----- cycles -----
export const cycles = pgTable('cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  number: integer('number'),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: cycleStatusEnum('status').default('upcoming'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- issues -----
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id),
    cycleId: uuid('cycle_id').references(() => cycles.id),
    parentId: uuid('parent_id'),
    prdId: uuid('prd_id'),
    identifier: text('identifier'),
    title: text('title').notNull(),
    description: text('description'),
    status: issueStatusEnum('status').default('backlog'),
    priority: issuePriorityEnum('priority').default('none'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    creatorId: uuid('creator_id').references(() => users.id),
    estimate: integer('estimate'),
    dueDate: date('due_date'),
    startDate: date('start_date'),
    sortOrder: doublePrecision('sort_order').default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('issues_team_id_identifier_unique').on(table.teamId, table.identifier),
  ]
);

// ----- issue_labels (composite PK) -----
export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.labelId] })]
);

// ----- issue_dependencies -----
export const issueDependencies = pgTable(
  'issue_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    dependsOnId: uuid('depends_on_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    dependencyType: text('dependency_type').default('blocks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => [
    unique('issue_dependencies_issue_id_depends_on_id_unique').on(
      table.issueId,
      table.dependsOnId
    ),
  ]
);

// ----- comments -----
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- activities -----
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  type: activityTypeEnum('type').notNull(),
  data: jsonb('data').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- conversations -----
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id),
  title: text('title'),
  aiProvider: aiProviderEnum('ai_provider').default('anthropic'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- messages -----
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  tokensUsed: integer('tokens_used'),
  aiProvider: aiProviderEnum('ai_provider'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- prd_documents -----
export const prdDocuments = pgTable('prd_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id),
  createdBy: uuid('created_by').references(() => users.id),
  title: text('title'),
  overview: text('overview'),
  content: jsonb('content'),
  goals: jsonb('goals').default(sql`'[]'::jsonb`),
  userStories: jsonb('user_stories').default(sql`'[]'::jsonb`),
  requirements: jsonb('requirements').default(sql`'[]'::jsonb`),
  timeline: text('timeline'),
  status: text('status').default('draft'),
  version: integer('version').default(1),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- user_ai_settings -----
export const userAiSettings = pgTable('user_ai_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  anthropicApiKey: text('anthropic_api_key'),
  openaiApiKey: text('openai_api_key'),
  geminiApiKey: text('gemini_api_key'),
  defaultProvider: aiProviderEnum('default_provider').default('anthropic'),
  autoModeEnabled: boolean('auto_mode_enabled').default(false),
  provider: text('provider').default('openai'),
  apiKey: text('api_key'),
  model: text('model').default('gpt-4'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- notifications -----
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type'),
  title: text('title'),
  message: text('message'),
  data: jsonb('data').default(sql`'{}'::jsonb`),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- activity_logs -----
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  actionType: text('action_type'),
  targetType: text('target_type'),
  targetId: uuid('target_id'),
  targetUserId: uuid('target_user_id').references(() => users.id),
  description: text('description'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- prd_versions -----
export const prdVersions = pgTable('prd_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id'),
  prdDocumentId: uuid('prd_document_id').references(() => prdDocuments.id, {
    onDelete: 'cascade',
  }),
  pageId: uuid('page_id'),
  versionNumber: integer('version_number'),
  title: text('title'),
  content: jsonb('content'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  description: text('description'),
});

// ----- prd_yjs_state -----
export const prdYjsState = pgTable('prd_yjs_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id').unique(),
  yjsState: bytea('yjs_state'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// ----- prd_projects -----
export const prdProjects = pgTable(
  'prd_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prdId: uuid('prd_id'),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('prd_projects_prd_id_project_id_unique').on(table.prdId, table.projectId),
  ]
);

// ----- issue_templates -----
export const issueTemplates = pgTable('issue_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultTitle: text('default_title'),
  defaultDescription: jsonb('default_description'),
  defaultPriority: text('default_priority').default('medium'),
  defaultLabels: textArray('default_labels'),
  defaultEstimate: integer('default_estimate'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- conversation_shares -----
export const conversationShares = pgTable('conversation_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  shareToken: text('share_token').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shareType: text('share_type').default('link'),
  accessLevel: text('access_level').default('view'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- conversation_access_requests -----
export const conversationAccessRequests = pgTable('conversation_access_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  shareId: uuid('share_id')
    .notNull()
    .references(() => conversationShares.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  respondedBy: uuid('responded_by').references(() => users.id),
});

// ----- databases -----
export const databases = pgTable('databases', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  coverUrl: text('cover_url'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- database_properties -----
export const databaseProperties = pgTable('database_properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  databaseId: uuid('database_id')
    .notNull()
    .references(() => databases.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  config: jsonb('config').default(sql`'{}'::jsonb`),
  position: integer('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- database_rows -----
export const databaseRows = pgTable('database_rows', {
  id: uuid('id').primaryKey().defaultRandom(),
  databaseId: uuid('database_id')
    .notNull()
    .references(() => databases.id, { onDelete: 'cascade' }),
  properties: jsonb('properties').default(sql`'{}'::jsonb`),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- database_views -----
export const databaseViews = pgTable('database_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  databaseId: uuid('database_id')
    .notNull()
    .references(() => databases.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').default('table'),
  config: jsonb('config').default(sql`'{}'::jsonb`),
  position: integer('position').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- issue_versions -----
export const issueVersions = pgTable('issue_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  pageId: uuid('page_id'),
  versionNumber: integer('version_number'),
  title: text('title'),
  content: jsonb('content'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- block_comments -----
export const blockComments = pgTable('block_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id'),
  pageType: text('page_type'),
  blockId: text('block_id'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  resolved: boolean('resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- block_comment_replies -----
export const blockCommentReplies = pgTable('block_comment_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id')
    .notNull()
    .references(() => blockComments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----- project_members -----
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member'),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('project_members_project_id_user_id_unique').on(
      table.projectId,
      table.userId
    ),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.id],
  }),
  refreshTokens: many(refreshTokens),
  userRoles: many(userRoles),
  teamMembers: many(teamMembers),
  issues: many(issues, { relationName: 'assignee' }),
  createdIssues: many(issues, { relationName: 'creator' }),
  comments: many(comments),
  conversations: many(conversations),
  notifications: many(notifications),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.id],
    references: [users.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
  members: many(teamMembers),
  projects: many(projects),
  labels: many(labels),
  cycles: many(cycles),
  issues: many(issues),
  invites: many(teamInvites),
  conversations: many(conversations),
  activityLogs: many(activityLogs),
  databases: many(databases),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvites.teamId],
    references: [teams.id],
  }),
  invitedByUser: one(users, {
    fields: [teamInvites.invitedBy],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  lead: one(users, {
    fields: [projects.leadId],
    references: [users.id],
  }),
  issues: many(issues),
  members: many(projectMembers),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  team: one(teams, {
    fields: [labels.teamId],
    references: [teams.id],
  }),
  issueLabels: many(issueLabels),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  team: one(teams, {
    fields: [cycles.teamId],
    references: [teams.id],
  }),
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  team: one(teams, {
    fields: [issues.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  cycle: one(cycles, {
    fields: [issues.cycleId],
    references: [cycles.id],
  }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: 'parentChild',
  }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  creator: one(users, {
    fields: [issues.creatorId],
    references: [users.id],
    relationName: 'creator',
  }),
  labels: many(issueLabels),
  comments: many(comments),
  activities: many(activities),
  versions: many(issueVersions),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const issueDependenciesRelations = relations(issueDependencies, ({ one }) => ({
  issue: one(issues, {
    fields: [issueDependencies.issueId],
    references: [issues.id],
    relationName: 'dependencyFrom',
  }),
  dependsOn: one(issues, {
    fields: [issueDependencies.dependsOnId],
    references: [issues.id],
    relationName: 'dependencyTo',
  }),
  createdByUser: one(users, {
    fields: [issueDependencies.createdBy],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  issue: one(issues, {
    fields: [activities.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [conversations.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
  shares: many(conversationShares),
  prdDocuments: many(prdDocuments),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const prdDocumentsRelations = relations(prdDocuments, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [prdDocuments.conversationId],
    references: [conversations.id],
  }),
  team: one(teams, {
    fields: [prdDocuments.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [prdDocuments.projectId],
    references: [projects.id],
  }),
  createdByUser: one(users, {
    fields: [prdDocuments.createdBy],
    references: [users.id],
  }),
  versions: many(prdVersions),
}));

export const userAiSettingsRelations = relations(userAiSettings, ({ one }) => ({
  user: one(users, {
    fields: [userAiSettings.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [activityLogs.targetUserId],
    references: [users.id],
    relationName: 'targetUser',
  }),
}));

export const prdVersionsRelations = relations(prdVersions, ({ one }) => ({
  prdDocument: one(prdDocuments, {
    fields: [prdVersions.prdDocumentId],
    references: [prdDocuments.id],
  }),
  createdByUser: one(users, {
    fields: [prdVersions.createdBy],
    references: [users.id],
  }),
}));

export const prdYjsStateRelations = relations(prdYjsState, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [prdYjsState.updatedBy],
    references: [users.id],
  }),
}));

export const prdProjectsRelations = relations(prdProjects, ({ one }) => ({
  project: one(projects, {
    fields: [prdProjects.projectId],
    references: [projects.id],
  }),
}));

export const issueTemplatesRelations = relations(issueTemplates, ({ one }) => ({
  team: one(teams, {
    fields: [issueTemplates.teamId],
    references: [teams.id],
  }),
  createdByUser: one(users, {
    fields: [issueTemplates.createdBy],
    references: [users.id],
  }),
}));

export const conversationSharesRelations = relations(conversationShares, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [conversationShares.conversationId],
    references: [conversations.id],
  }),
  createdByUser: one(users, {
    fields: [conversationShares.createdBy],
    references: [users.id],
  }),
  accessRequests: many(conversationAccessRequests),
}));

export const conversationAccessRequestsRelations = relations(
  conversationAccessRequests,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationAccessRequests.conversationId],
      references: [conversations.id],
    }),
    share: one(conversationShares, {
      fields: [conversationAccessRequests.shareId],
      references: [conversationShares.id],
    }),
    requester: one(users, {
      fields: [conversationAccessRequests.requesterId],
      references: [users.id],
      relationName: 'requester',
    }),
    respondedByUser: one(users, {
      fields: [conversationAccessRequests.respondedBy],
      references: [users.id],
      relationName: 'responder',
    }),
  })
);

export const databasesRelations = relations(databases, ({ one, many }) => ({
  team: one(teams, {
    fields: [databases.teamId],
    references: [teams.id],
  }),
  createdByUser: one(users, {
    fields: [databases.createdBy],
    references: [users.id],
  }),
  properties: many(databaseProperties),
  rows: many(databaseRows),
  views: many(databaseViews),
}));

export const databasePropertiesRelations = relations(databaseProperties, ({ one }) => ({
  database: one(databases, {
    fields: [databaseProperties.databaseId],
    references: [databases.id],
  }),
}));

export const databaseRowsRelations = relations(databaseRows, ({ one }) => ({
  database: one(databases, {
    fields: [databaseRows.databaseId],
    references: [databases.id],
  }),
  createdByUser: one(users, {
    fields: [databaseRows.createdBy],
    references: [users.id],
  }),
}));

export const databaseViewsRelations = relations(databaseViews, ({ one }) => ({
  database: one(databases, {
    fields: [databaseViews.databaseId],
    references: [databases.id],
  }),
}));

export const issueVersionsRelations = relations(issueVersions, ({ one }) => ({
  issue: one(issues, {
    fields: [issueVersions.issueId],
    references: [issues.id],
  }),
  createdByUser: one(users, {
    fields: [issueVersions.createdBy],
    references: [users.id],
  }),
}));

export const blockCommentsRelations = relations(blockComments, ({ one, many }) => ({
  user: one(users, {
    fields: [blockComments.userId],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [blockComments.resolvedBy],
    references: [users.id],
    relationName: 'resolver',
  }),
  replies: many(blockCommentReplies),
}));

export const blockCommentRepliesRelations = relations(blockCommentReplies, ({ one }) => ({
  comment: one(blockComments, {
    fields: [blockCommentReplies.commentId],
    references: [blockComments.id],
  }),
  user: one(users, {
    fields: [blockCommentReplies.userId],
    references: [users.id],
  }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [projectMembers.assignedBy],
    references: [users.id],
    relationName: 'assigner',
  }),
}));
