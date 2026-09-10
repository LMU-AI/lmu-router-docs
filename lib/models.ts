export interface ModelEntry {
  id: string;
  label: string;
  vendor: string;
  family: 'claude' | 'openai' | 'gemini' | 'grok' | 'domestic' | 'image';
  tier?: 'flagship' | 'balanced' | 'fast';
  isNew?: boolean;
}

export const MODELS: ModelEntry[] = [
  // 阿里 · 通义千问
  { id: 'qwen3.8-max', label: '通义千问 3.8 Max', vendor: '阿里云', family: 'domestic', tier: 'flagship', isNew: true },
  { id: 'qwen3.8-flash', label: '通义千问 3.8 Flash', vendor: '阿里云', family: 'domestic', tier: 'fast', isNew: true },
  { id: 'qwen3.7-plus', label: '通义千问 3.7 Plus', vendor: '阿里云', family: 'domestic' },
  { id: 'qwen3.7-max', label: '通义千问 3.7 Max', vendor: '阿里云', family: 'domestic', tier: 'flagship' },
  { id: 'qwen3.6-plus', label: '通义千问 3.6 Plus', vendor: '阿里云', family: 'domestic' },

  // DeepSeek
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', vendor: 'DeepSeek', family: 'domestic', tier: 'flagship' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', vendor: 'DeepSeek', family: 'domestic', tier: 'fast' },
  { id: 'deepseek-v3.2', label: 'DeepSeek V3.2', vendor: 'DeepSeek', family: 'domestic' },

  // MiniMax
  { id: 'MiniMax-M3', label: 'MiniMax M3', vendor: 'MiniMax', family: 'domestic', isNew: true },
  { id: 'MiniMax-M2.7', label: 'MiniMax M2.7', vendor: 'MiniMax', family: 'domestic', tier: 'flagship' },
  { id: 'MiniMax-M2.7-highspeed', label: 'MiniMax M2.7 高速版', vendor: 'MiniMax', family: 'domestic', tier: 'fast' },
  { id: 'MiniMax-M2.5', label: 'MiniMax M2.5', vendor: 'MiniMax', family: 'domestic' },
  { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 高速版', vendor: 'MiniMax', family: 'domestic', tier: 'fast' },

  // 智谱 · GLM
  { id: 'glm-5.3', label: '智谱 GLM-5.3', vendor: '智谱 AI', family: 'domestic', tier: 'flagship', isNew: true },
  { id: 'glm-5.3-flash', label: '智谱 GLM-5.3 Flash', vendor: '智谱 AI', family: 'domestic', tier: 'fast', isNew: true },
  { id: 'glm-5.2', label: '智谱 GLM-5.2', vendor: '智谱 AI', family: 'domestic' },
  { id: 'glm-5.1', label: '智谱 GLM-5.1', vendor: '智谱 AI', family: 'domestic' },
  { id: 'glm-5', label: '智谱 GLM-5', vendor: '智谱 AI', family: 'domestic' },

  // 月之暗面 · Kimi
  { id: 'kimi-k3', label: 'Kimi K3', vendor: '月之暗面', family: 'domestic', tier: 'flagship' },
  { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', vendor: '月之暗面', family: 'domestic', isNew: true },
  { id: 'kimi-k2.6', label: 'Kimi K2.6', vendor: '月之暗面', family: 'domestic' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', vendor: '月之暗面', family: 'domestic' },

  // 小米 · MiMo
  { id: 'mimo-v2.5-pro', label: '小米 MiMo V2.5 Pro', vendor: '小米', family: 'domestic', tier: 'flagship' },
  { id: 'mimo-v2.5', label: '小米 MiMo V2.5', vendor: '小米', family: 'domestic' },

  // Claude
  { id: 'claude-opus-5', label: 'Claude Opus 5', vendor: 'Anthropic', family: 'claude', tier: 'flagship' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', vendor: 'Anthropic', family: 'claude', tier: 'balanced' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', family: 'claude', tier: 'fast' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', vendor: 'Anthropic', family: 'claude', isNew: true },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', vendor: 'Anthropic', family: 'claude' },

  // OpenAI
  { id: 'gpt-6-astra', label: 'GPT-6 Astra', vendor: 'OpenAI', family: 'openai', tier: 'flagship', isNew: true },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', vendor: 'OpenAI', family: 'openai', tier: 'flagship' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', vendor: 'OpenAI', family: 'openai' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', vendor: 'OpenAI', family: 'openai' },
  { id: 'gpt-5.5', label: 'GPT-5.5', vendor: 'OpenAI', family: 'openai' },

  // Google · Gemini
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', vendor: 'Google', family: 'gemini', tier: 'flagship', isNew: true },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', vendor: 'Google', family: 'gemini', tier: 'fast', isNew: true },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', vendor: 'Google', family: 'gemini', tier: 'fast' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', vendor: 'Google', family: 'gemini', tier: 'fast' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', vendor: 'Google', family: 'gemini', tier: 'fast' },

  // xAI · Grok
  { id: 'grok-4.6', label: 'Grok 4.6', vendor: 'xAI', family: 'grok', tier: 'flagship', isNew: true },
  { id: 'grok-4.5', label: 'Grok 4.5', vendor: 'xAI', family: 'grok' },
  { id: 'grok-4.3', label: 'Grok 4.3', vendor: 'xAI', family: 'grok' },
  { id: 'grok-4.20-reasoning', label: 'Grok 4.20 Reasoning', vendor: 'xAI', family: 'grok' },
  { id: 'grok-code-fast-1', label: 'Grok Code Fast 1', vendor: 'xAI', family: 'grok', tier: 'fast' },

  // 生图模型（不在模型广场展示，仅 api/ 文档使用）
  { id: 'gpt-image-2', label: 'GPT Image 2', vendor: 'OpenAI', family: 'image' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', vendor: 'Google', family: 'image' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview', vendor: 'Google', family: 'image' },
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', vendor: 'Google', family: 'image' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview', vendor: 'Google', family: 'image' },
  { id: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image', vendor: 'Google', family: 'image' },
  { id: 'grok-imagine-image', label: 'Grok Imagine Image', vendor: 'xAI', family: 'image' },
  { id: 'grok-imagine-image-quality', label: 'Grok Imagine Image Quality', vendor: 'xAI', family: 'image' },
  { id: 'grok-imagine-edit', label: 'Grok Imagine Edit', vendor: 'xAI', family: 'image' },
];

export const FLAGSHIP = {
  claude: 'claude-opus-5',
  claudeBalanced: 'claude-sonnet-5',
  claudeFast: 'claude-haiku-4-5',
  openai: 'gpt-6-astra',
  gemini: 'gemini-3.1-pro-preview',
  grok: 'grok-4.6',
  glm: 'glm-5.3',
  qwen: 'qwen3.8-max',
  deepseek: 'deepseek-v4-pro',
  kimi: 'kimi-k3',
  minimax: 'MiniMax-M3',
  mimo: 'mimo-v2.5-pro',
} as const;

/** 模型广场展示的模型（生图模型有独立的 api/ 文档，不进广场） */
export const PLAZA_MODELS = MODELS.filter((m) => m.family !== 'image');

export const MODEL_IDS = MODELS.map((m) => m.id);
