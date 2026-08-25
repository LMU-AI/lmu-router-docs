export const SITE_URL = 'https://docs.lmuai.com';
export const SITE_NAME = '灵眸文档';
export const SITE_SHORT_NAME = '灵眸';
export const SITE_DESCRIPTION =
  '灵眸 AI API 使用文档：支持 Gemini、GPT、Grok 文生图和图片编辑、Gemini 批量生图，以及 Claude Code / Codex CLI / Cursor 等主流 AI 工具接入。';

// 英文站点文案（用于 /en 页面的 <html lang>、metadata、JSON-LD）。忠实翻译，不新增事实。
export const SITE_NAME_EN = 'LMU AI Docs';
export const SITE_DESCRIPTION_EN =
  'LMU AI (Lingmou AI) API documentation: a stable, reliable relay for Claude, GPT, Gemini and Grok — plus leading Chinese models — with one API key across Claude Code, Codex CLI, Cursor, Cherry Studio and other AI coding tools.';

export function siteName(locale: string): string {
  return locale === 'en' ? SITE_NAME_EN : SITE_NAME;
}
export function siteDescription(locale: string): string {
  return locale === 'en' ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION;
}

export const REGISTER_URL = 'https://api.lmuai.com/register?ref=vJaWWr4T';
export const API_BASE_URL = 'https://api.lmuai.com';

export const SITE_KEYWORDS = [
  '灵眸',
  '灵眸 API',
  'Claude API',
  'Claude Code',
  'Codex CLI',
  'Codex App',
  'Cursor',
  'VS Code',
  'Trae',
  'OpenCode',
  'Cherry Studio',
  'Kilo Code',
  'Anthropic 中转',
  'AI API 代理',
  'Gemini 生图 API',
  'GPT 生图 API',
  'Grok 生图 API',
  'Gemini 批量生图',
  '国产大模型',
  'Qwen',
];

export const THEME_COLOR = '#dd7627';
