// Notion-style TipTap Block Extensions
export { CalloutNode } from './CalloutNode';
export { ToggleNode } from './ToggleNode';
export { VideoNode } from './VideoNode';
export { EquationNode } from './EquationNode';
export { TableOfContentsNode } from './TableOfContentsNode';
export { BookmarkNode } from './BookmarkNode';
export { FileNode } from './FileNode';

// Sprint 1: Core Blocks
export { AudioNode } from './AudioNode';
export { ColumnBlock, Column } from './ColumnLayout';
export { PageEmbed } from './PageEmbed';
export { BreadcrumbsNode } from './BreadcrumbsNode';

// Sprint 2: Collaboration
export { BlockCommentExtension } from './BlockComment';
export type { BlockComment, BlockCommentReply, BlockCommentOptions } from './BlockComment';

// Sprint 3: Automation
export { ButtonBlock } from './ButtonBlock';
export type { ButtonAction, ButtonBlockOptions } from './ButtonBlock';
export { TemplateButton, builtInTemplates } from './TemplateButton';
export type { ContentTemplate, TemplateButtonOptions } from './TemplateButton';

// Sprint 4: Database
export { LinkedDatabase } from './LinkedDatabase';
export type { DatabaseColumn, DatabaseRow, DatabaseView, DatabaseSource, LinkedDatabaseOptions } from './LinkedDatabase';
export { InlineDatabase } from './InlineDatabase';
export type { InlineColumn, InlineRow, InlineDatabaseOptions } from './InlineDatabase';

// Core Extensions
export { UniqueId, getBlockIdAtPos, findBlockById } from './UniqueId';
export { SyncedBlock, SyncedBlockService } from './SyncedBlock';

// Slash Commands (Notion-style '/' menu)
export { SlashCommands, slashCommandItems } from './SlashCommands';
