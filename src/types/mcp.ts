// MCP (Model Context Protocol) Types

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConnector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: MCPCategory;
  enabled: boolean;
  configType: 'automatic' | 'manual';
  apiEndpoint?: string;
  apiKey?: string;
  settings?: Record<string, unknown>;
  mcpConfig?: MCPServerConfig;
}

export type MCPCategory = 
  | 'communication' 
  | 'productivity' 
  | 'development' 
  | 'analytics' 
  | 'marketing' 
  | 'design'
  | 'search';

export interface MCPSettings {
  id: string;
  user_id: string;
  team_id?: string;
  connectors: MCPConnector[];
  created_at: string;
  updated_at: string;
}

// LLM Model Types
export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  description: string;
  enabled: boolean;
  apiKey?: string;
  priority: number; // Used for auto-mix mode
  capabilities: LLMCapability[];
  modelId?: string; // Actual model ID for API calls (e.g., 'gpt-4o', 'claude-3-sonnet')
}

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'cohere' | 'custom';

export type LLMCapability = 
  | 'code' 
  | 'analysis' 
  | 'creative' 
  | 'multimodal' 
  | 'reasoning' 
  | 'fast';

export interface LLMSettings {
  id: string;
  user_id: string;
  models: LLMModel[];
  auto_mix_enabled: boolean;
  auto_mix_strategy: 'round_robin' | 'capability_based' | 'load_balanced' | 'cost_optimized';
  default_model_id?: string;
  created_at: string;
  updated_at: string;
}

// Provider API Key storage
export interface ProviderAPIKey {
  provider: LLMProvider;
  apiKey: string;
  isValid?: boolean;
  lastValidated?: string;
}

// Predefined MCP Connectors (English labels)
export const PRESET_MCP_CONNECTORS: Omit<MCPConnector, 'id' | 'enabled' | 'apiEndpoint' | 'apiKey' | 'settings'>[] = [
  {
    name: 'Web Search',
    description: 'Search the web for real-time information',
    icon: '🌐',
    category: 'search',
    configType: 'automatic',
  },
  {
    name: 'Gmail',
    description: 'Read, write, and manage emails',
    icon: '📧',
    category: 'communication',
    configType: 'automatic',
  },
  {
    name: 'Google Drive',
    description: 'Access and manage file storage',
    icon: '📁',
    category: 'productivity',
    configType: 'automatic',
  },
  {
    name: 'Google Calendar',
    description: 'Manage schedules and reminders',
    icon: '📅',
    category: 'productivity',
    configType: 'automatic',
  },
  {
    name: 'Notion',
    description: 'Manage documents and databases',
    icon: '📝',
    category: 'productivity',
    configType: 'automatic',
  },
  {
    name: 'Atlassian',
    description: 'Jira and Confluence integration',
    icon: '🔷',
    category: 'development',
    configType: 'automatic',
  },
  {
    name: 'Figma',
    description: 'Access design files',
    icon: '🎨',
    category: 'design',
    configType: 'automatic',
  },
  {
    name: 'GitHub',
    description: 'Code repository integration',
    icon: '🐙',
    category: 'development',
    configType: 'automatic',
  },
  {
    name: 'Amplitude',
    description: 'Product analytics data',
    icon: '📊',
    category: 'analytics',
    configType: 'automatic',
  },
  {
    name: 'AppsFlyer',
    description: 'Mobile marketing analytics',
    icon: '📱',
    category: 'marketing',
    configType: 'automatic',
  },
  {
    name: 'Google Ads',
    description: 'Advertising performance data',
    icon: '📈',
    category: 'marketing',
    configType: 'automatic',
  },
  {
    name: 'Slack',
    description: 'Team communication integration',
    icon: '💬',
    category: 'communication',
    configType: 'automatic',
  },
];

// Predefined LLM Models (English labels)
export const PRESET_LLM_MODELS: Omit<LLMModel, 'id' | 'enabled' | 'apiKey'>[] = [
  {
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Excellent at code generation and analysis. Accurate and logical responses',
    priority: 1,
    capabilities: ['code', 'analysis', 'reasoning'],
    modelId: 'claude-3-5-sonnet-20241022',
  },
  {
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Versatile, creative, with multimodal support',
    priority: 2,
    capabilities: ['creative', 'multimodal', 'analysis'],
    modelId: 'gpt-4o',
  },
  {
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Fast responses, cost-effective, multimodal',
    priority: 3,
    capabilities: ['fast', 'multimodal', 'reasoning'],
    modelId: 'gemini-2.0-flash',
  },
  {
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and economical GPT model',
    priority: 4,
    capabilities: ['fast', 'creative'],
    modelId: 'gpt-4o-mini',
  },
  {
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Quick and concise responses',
    priority: 5,
    capabilities: ['fast', 'code'],
    modelId: 'claude-3-haiku-20240307',
  },
];

// Provider configuration
export const LLM_PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    icon: '🟣',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPattern: /^sk-ant-/,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPattern: /^sk-/,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google Gemini',
    icon: '🔵',
    apiKeyPlaceholder: 'AIza...',
    apiKeyPattern: /^AIza/,
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🟠',
    apiKeyPlaceholder: 'Your API key',
    apiKeyPattern: /.+/,
    docsUrl: 'https://console.mistral.ai/api-keys/',
  },
  cohere: {
    name: 'Cohere',
    icon: '🔴',
    apiKeyPlaceholder: 'Your API key',
    apiKeyPattern: /.+/,
    docsUrl: 'https://dashboard.cohere.com/api-keys',
  },
  custom: {
    name: 'Custom',
    icon: '⚫',
    apiKeyPlaceholder: 'Your API key',
    apiKeyPattern: /.+/,
    docsUrl: '',
  },
} as const;
