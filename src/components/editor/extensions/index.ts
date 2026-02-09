// Notion-style TipTap Block Extensions
// Organized by category

// === Blocks ===
export { CalloutNode } from './blocks/CalloutNode';
export { EquationNode } from './blocks/EquationNode';

// === Layout ===
export { ToggleNode } from './layout/ToggleNode';
export { TableOfContentsNode } from './layout/TableOfContentsNode';
export { ColumnBlock, Column } from './layout/ColumnLayout';
export { BreadcrumbsNode } from './layout/BreadcrumbsNode';

// === Media ===
export { VideoNode } from './media/VideoNode';
export { AudioNode } from './media/AudioNode';
export { BookmarkNode } from './media/BookmarkNode';
export { FileNode } from './media/FileNode';
export { PageEmbed } from './media/PageEmbed';

// === Database ===
export { LinkedDatabase } from './database/LinkedDatabase';
export type { DatabaseColumn, DatabaseRow, DatabaseView, DatabaseSource, LinkedDatabaseOptions } from './database/LinkedDatabase';
export { InlineDatabase } from './database/InlineDatabase';
export type { InlineColumn, InlineRow, InlineDatabaseOptions } from './database/InlineDatabase';

// === Interactive ===
export { ButtonBlock } from './interactive/ButtonBlock';
export type { ButtonAction, ButtonBlockOptions } from './interactive/ButtonBlock';
export { TemplateButton, builtInTemplates } from './interactive/TemplateButton';
export type { ContentTemplate, TemplateButtonOptions } from './interactive/TemplateButton';

// === Collaboration ===
export { BlockCommentExtension } from './BlockComment';
export type { BlockComment, BlockCommentReply, BlockCommentOptions } from './BlockComment';

// === Core Extensions ===
export { UniqueId, getBlockIdAtPos, findBlockById } from './UniqueId';
export { SyncedBlock, SyncedBlockService } from './SyncedBlock';

// === Slash Commands ===
export { SlashCommands, slashCommandItems } from './SlashCommands';
