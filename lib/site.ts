// 域名 / API 端点 / 注册链接随站点变体走（.com 国内站 / .ai 海外站），
// 单一事实源在 lib/variant.ts；这里 re-export 维持既有 import 路径不变。
export { SITE_URL, API_BASE_URL, API_HOST, REGISTER_URL } from './variant';

export const SITE_NAME = '灵眸文档';
export const SITE_SHORT_NAME = '灵眸';
export const SITE_SHORT_NAME_EN = 'LMU AI';
export const SITE_DESCRIPTION =
  '灵眸 AI API 使用文档：支持 Gemini、GPT、Grok 文生图和图片编辑、Gemini 批量生图，以及 Claude Code / Codex CLI / Cursor 等主流 AI 工具接入。';

import { IS_AI } from './variant';

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

// 产品实体（区别于「文档站」SITE_NAME=灵眸文档）：灵眸 AI 本体是大模型 API 中转服务。
// 供 SoftwareApplication JSON-LD 使用——让生成式引擎/搜索明确「这个实体是什么」。
// 全部取自站内既有文案，忠实描述；不虚构价格、评分与不存在的能力（见 no-invented-facts）。
export const PRODUCT_NAME = '灵眸 AI';
export const PRODUCT_NAME_EN = 'LMU AI';
export function productName(locale: string): string {
  return locale === 'en' ? PRODUCT_NAME_EN : PRODUCT_NAME;
}

// 定位描述按变体走：.com 陈述北京网关（境内直连免代理）；.ai 陈述国际站网关
// （境外直连、账号与大陆端点互通）。均只写已核实事实，不带延迟/在线率数字。
// 对外口径（2026-09-02 用户定）：.ai 一律称「国际站」，不提具体节点城市。
// com 分支字面量与引入变体机制前逐字一致（构建产物 diff 闸门依赖这一点）。
export const PRODUCT_DESCRIPTION = IS_AI
  ? '灵眸 AI 是大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT、Gemini 与国产大模型；国际站网关境外可直接访问，账号、密钥与余额与大陆端点通用，兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 工具。'
  : '灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT、Gemini 与国产大模型，网关部署在中国境内、国内直连免代理，兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 工具。';
export const PRODUCT_DESCRIPTION_EN = IS_AI
  ? 'LMU AI (Lingmou AI) is a large-model API relay. One API key calls Claude, OpenAI GPT, Gemini and leading Chinese models; the international gateway offers direct access from outside mainland China, and the same account, key and balance also work on the mainland endpoint. Compatible with mainstream AI tools such as Claude Code, Codex CLI, Cursor and Cherry Studio.'
  : 'LMU AI (Lingmou AI) is a large-model API relay for users in mainland China. One API key calls Claude, OpenAI GPT, Gemini and leading Chinese models; the gateway is hosted inside mainland China for direct, proxy-free access, and it is compatible with mainstream AI tools such as Claude Code, Codex CLI, Cursor and Cherry Studio.';
export function productDescription(locale: string): string {
  return locale === 'en' ? PRODUCT_DESCRIPTION_EN : PRODUCT_DESCRIPTION;
}

// featureList：逐条对应站内既有卖点（首页 OG、SITE_DESCRIPTION、关键事实、models.ts）。
// 仅第 3 条（网关位置）随变体走，其余两站相同。
export const PRODUCT_FEATURES = [
  '一把 API Key 通用 Anthropic、OpenAI 兼容、Gemini 原生三种协议',
  '兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 编程工具',
  IS_AI ? '国际站网关，境外直接访问' : '网关部署在中国境内，国内直连、低延迟、免代理',
  '多源故障转移',
  '覆盖 Claude、GPT、Gemini 及通义千问、DeepSeek、GLM、Kimi、MiniMax、MiMo 等国产大模型',
  '提供文生图与图片编辑 API',
];
export const PRODUCT_FEATURES_EN = [
  'One API key works across the Anthropic, OpenAI-compatible and Gemini native protocols',
  'Compatible with mainstream AI coding tools such as Claude Code, Codex CLI, Cursor and Cherry Studio',
  IS_AI
    ? 'International gateway with direct access from outside mainland China'
    : 'Gateway hosted inside mainland China for direct, low-latency, proxy-free access',
  'Multi-source failover',
  'Covers Claude, GPT, Gemini and Chinese models including Qwen, DeepSeek, GLM, Kimi, MiniMax and MiMo',
  'Image generation and image editing API',
];
export function productFeatures(locale: string): string[] {
  return locale === 'en' ? PRODUCT_FEATURES_EN : PRODUCT_FEATURES;
}

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
