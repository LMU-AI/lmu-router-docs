#!/usr/bin/env node
// scripts/translate-content.mjs
// ─────────────────────────────────────────────────────────────────────────────
// 从英文源 X.en.mdx（+ meta.en.json）派生新语种 X.<lang>.mdx（+ meta.<lang>.json）。
//
// 为什么英文是源：en 已是完整忠实翻译，en→其它语种质量高于 zh→。cn/en 仍人工维护，
// 新语种由 en 机器派生 + 门禁校验。
//
// 设计要点（与 CLAUDE.md 两条硬规则 + 计划决策对齐）：
//  1) 确定性预处理，LLM 只做「忠实翻译」：
//     · 先摘除指向 compliance(备案) 的交叉引用 —— 复用物化器 COMPLIANCE_LINKS 的整块串。
//       compliance 是大陆专属、不译入新语种，目标语无此页，交叉引用必须删干净。
//     · 再把 frontmatter 里的「大陆定位」话术按 FRONTMATTER_PHRASES 中立化 —— 复用物化器
//       那套人工精调字典。frontmatter 不走 <CN>/<Intl>（remark 碰不到 frontmatter），且新
//       语种文件两站通用，故其 frontmatter 必须一律「海外中立」。中立化后新语种既不需要
//       per-language 字典，也天然过 .ai 的 BANNED_AI_PHRASES 扫描。
//  2) 正文 <CN>/<Intl> 标记原样保留、两块都译（语言无关，remark 按站点删留）。
//  3) 链接 target 原样、仅译链接文字；译后把 /en/docs 前缀改写为 /<lang>/docs。
//     [#anchor] 标题显式 id 与 (#anchor) 页内锚点原样保留（en 源已用显式 id 解决 slug 稳定）。
//  4) 金额/URL/邮箱/群号/sk-/环境变量/代码块/模型 ID/frontmatter 键名一律原样。
//  5) 不编造事实（no-fabrication）：不新增延迟/在线率/价格/大陆专属可达性话术。
//
// 译后对每页做「不变量校验」，任一硬断言不过即不落盘、计入失败清单（见文件末尾汇总）。
//
// 翻译引擎：Anthropic /v1/messages 兼容网关。Base=ANTHROPIC_BASE_URL，Model=ANTHROPIC_MODEL，
// Key 从环境读（LMU_API_KEY 优先，回退 ANTHROPIC_AUTH_TOKEN），**绝不写盘 / 绝不回显**。
//
// 用法：
//   node scripts/translate-content.mjs                      # 全部 8 新语种 × 全部页 + meta
//   node scripts/translate-content.mjs --langs ja           # 只译日语
//   node scripts/translate-content.mjs --only index --langs ja   # 试点单页
//   node scripts/translate-content.mjs --meta-only          # 只重建导航 meta
//   node scripts/translate-content.mjs --force              # 忽略缓存全量重译
//   node scripts/translate-content.mjs --concurrency 4      # 并发（默认 4）
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';

const ROOT = 'content/docs';
const CACHE_FILE = 'scripts/.translate-cache.json';

// 新增语种与其「给模型看的」自然语言名（不含 cn/en —— 那两种人工维护）。
const ALL_NEW_LANGS = ['ja', 'ko', 'es', 'pt', 'de', 'fr', 'ru', 'ar'];
const LANG_NAME = {
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  es: 'Spanish (Español, neutral Latin-American)',
  pt: 'Brazilian Portuguese (Português do Brasil)',
  de: 'German (Deutsch)',
  fr: 'French (Français)',
  ru: 'Russian (Русский)',
  ar: 'Arabic (العربية) — a right-to-left language',
};

// compliance(备案) 是大陆专属、仅 cn/en + .com；新语种不译此页。
const SKIP_SLUGS = new Set(['guide/compliance']);

// ── 复用物化器的两套人工精调字典（保持与 scripts/materialize-variant-content.mjs 同步）──
// 摘除随 compliance 页一并删的交叉引用（整块精确字符串）。英文串按原文 /en/docs 口径书写；
// 中文串留着无害（不会命中 en 源）。`, "compliance"` 只在 meta 里，正文不出现，此处不列。
const COMPLIANCE_STRIP = [
  '\n- [合规与备案](/docs/guide/compliance) — ICP / 公安备案可查验，合同、发票、DPA 支持',
  '\n- [Compliance & filings](/en/docs/guide/compliance) — verifiable ICP / public-security filings, contracts, invoices, DPA',
  '备案、数据驻留、合同发票与 DPA 等合规事项的速查见[合规与备案](/docs/guide/compliance)。',
  ' For filings, data residency, contracts, invoices and DPA, see [Compliance & filings](/en/docs/guide/compliance).',
  '备案信息、合同发票与合规事项速查见[合规与备案](/docs/guide/compliance)。',
  'For filings, contracts, invoices and a compliance checklist, see [Compliance & filings](/en/docs/guide/compliance). ',
];

// frontmatter 定位话术中立化（只在 frontmatter 块内生效）。仅需 en 对；cn 对留着无害。
// 与物化器 FRONTMATTER_PHRASES 逐条同步 —— 顺序敏感：具体长句在前、泛化短语兜底在后。
const FRONTMATTER_PHRASES = [
  ['可以。接入网关部署在中国国内，国内网络可直接调用，无需自建代理或科学上网。',
   '可以。国际站接入网关，境外网络可直接调用。'],
  ['不需要。灵眸接入网关部署在中国国内，国内网络可直接调用，无需 VPN 或代理。',
   '可以直接使用。国际站接入网关，境外网络可直接调用，无需 VPN 或代理。'],
  ['灵眸网关部署在中国境内、国内直连，关闭所有代理后重试即可',
   '灵眸国际站网关、境外直连，关闭所有代理后重试即可'],
  ['不需要。灵眸接入网关部署在中国境内，api.lmuai.com 国内直连即可获得最快速度与最稳定的连接。',
   '可以。灵眸国际站网关，api.lmuai.com 境外直连即可。'],
  ['国内能直接使用吗，需要科学上网吗？', '海外能直接使用吗？'],
  ['国内能直接使用吗？', '海外能直接使用吗？'],
  ['灵眸 API 需要科学上网吗？', '灵眸 API 境外可以直连吗？'],
  ['国内直连、低延迟、多源故障转移', '境外直连、多源故障转移'],
  ['国内直连免代理', '境外直连'],
  ['国内直连、免代理', '境外直连'],
  ['国内免代理', '境外直连'],
  ['国内直连', '境外直连'],
  ['免代理使用', '直连使用'],
  ['免代理 Claude API', '海外直连 Claude API'],
  ['国内可用 Claude API', '海外可用 Claude API'],
  ['Claude 国内中转', 'Claude 海外中转'],
  ['Gemini API 国内中转', 'Gemini API 海外中转'],
  ['Claude Code 国内使用', 'Claude Code 海外使用'],
  ['Claude Desktop 国内', 'Claude Desktop'],
  ['桌面版国内接入', '桌面版接入'],
  ['Cherry Studio 国内使用', 'Cherry Studio 海外使用'],
  ['国内网络直连使用', '海外网络直连使用'],
  ['免代理', '境外直连'],
  ['The LMU AI gateway is hosted inside mainland China with direct domestic access — turn off every proxy and retry.',
   'The LMU AI international gateway offers direct access — turn off every proxy and retry.'],
  ['No. The LMU AI gateway is hosted inside mainland China; api.lmuai.com is reachable directly from within China for the fastest, most stable connection.',
   'Yes, directly. The LMU AI international gateway makes api.lmuai.com reachable directly from outside mainland China.'],
  ['Does the LMU AI API need a VPN?', 'Can I reach the LMU AI API directly from overseas?'],
  ["it's a direct domestic connection with no proxy", 'it connects directly with no proxy'],
  ['The LMU AI API domain `api.lmuai.com` is a direct domestic connection, so once', 'The LMU AI API domain `api.lmuai.com` connects directly, so once'],
  ['`api.lmuai.com` is a direct domestic connection. But', '`api.lmuai.com` connects directly. But'],
  ['which may still need network optimization in China', 'which in some regions may still need network optimization'],
  ['is hosted inside mainland China', 'is hosted overseas'],
  ['direct connection in China with no proxy', 'direct overseas connection'],
  ['a direct connection in China and no proxy needed', 'a direct overseas connection'],
  ['a direct connection in China and no proxy', 'a direct overseas connection'],
  ['direct connection in China, no proxy', 'direct overseas connection'],
  ['connects directly in China', 'connects directly from overseas'],
  ['no proxy needed in China', 'a direct overseas connection'],
  ['direct connection on domestic networks', 'direct overseas connection'],
  ['with direct domestic access', 'with direct overseas access'],
  ['LMU AI is a direct domestic connection', 'the LMU AI overseas gateway connects directly'],
  ['Connect the Claude Code desktop app from China:', 'Connect the Claude Code desktop app:'],
  ['Claude Desktop in China', 'Claude Desktop'],
  ['with no proxy in China', 'with no proxy'],
  ['all with no proxy in China', 'all with no proxy'],
];

// 保持术语一致（不译/不转写）。
const GLOSSARY = [
  'LMU AI', 'Lingmou AI', 'Claude', 'Claude Code', 'Codex', 'Codex CLI', 'Cursor',
  'Cherry Studio', 'Chatbox', 'Obsidian', 'VS Code', 'Visual Studio Code', 'JetBrains',
  'WorkBuddy', 'Trae', 'OpenCode', 'Crush', 'Hermes', 'Kilo Code', 'CodeBuddy', 'ZCode',
  'cc-switch', 'Anthropic', 'OpenAI', 'Google', 'Gemini', 'Grok', 'GPT', 'API', 'Token',
];

// ── 网关 ──────────────────────────────────────────────────────────────────────
const BASE = (process.env.ANTHROPIC_BASE_URL || '').replace(/\/+$/, '');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const TOKEN = process.env.LMU_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';

async function callGateway(system, user, maxTokens) {
  if (!BASE) throw new Error('ANTHROPIC_BASE_URL 未设置');
  if (!TOKEN) throw new Error('翻译网关 Key 缺失：请 export LMU_API_KEY 或 ANTHROPIC_AUTH_TOKEN');
  const res = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      'x-api-key': TOKEN,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') throw new Error('TRUNCATED');
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  if (!text.trim()) throw new Error('空响应');
  return text;
}

async function withRetry(fn, { tries = 3, label = '' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      const wait = 1500 * (i + 1);
      process.stderr.write(`  ↻ 重试 ${label} (${i + 1}/${tries}): ${e.message}\n`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── 预处理：确定性中立化 + 摘 compliance 引用 ────────────────────────────────────
function neutralizeSource(raw) {
  let out = raw;
  for (const s of COMPLIANCE_STRIP) out = out.split(s).join('');
  if (out.startsWith('---\n')) {
    const end = out.indexOf('\n---', 4);
    if (end !== -1) {
      let fm = out.slice(0, end);
      for (const [a, b] of FRONTMATTER_PHRASES) fm = fm.split(a).join(b);
      out = fm + out.slice(end);
    }
  }
  return out;
}

// ── 系统提示 ────────────────────────────────────────────────────────────────────
function pageSystemPrompt(lang) {
  return `You are a professional technical-documentation translator. Translate the given MDX document from English into ${LANG_NAME[lang]}. Output ONLY the translated MDX document — no explanation, and do NOT wrap it in a markdown code fence.

CRITICAL: The API domain is ALWAYS \`api.lmuai.com\` — everywhere, on every site, in every language. Even where the text mentions an "international" or "overseas" gateway, the domain stays \`api.lmuai.com\`. NEVER change it to api.lmuai.ai, api.lmuai.io, or anything else; NEVER "localize" or "correct" the domain. A separate build step handles any per-site rewrite — your job is to leave \`api.lmuai.com\` byte-for-byte identical.

Absolute rules (violating any of these breaks the site):
1. FRONTMATTER: keep the \`---\` delimiters and every frontmatter KEY name in English, verbatim (title, description, ogDescription, keywords, alternateNames, faq, q, a, and any other key). Translate only the VALUES — ALL of them, into the target language. Keep the YAML structure, quoting style, and indentation intact. For \`keywords\`, write natural search terms in the target language but keep every product/brand token and identifier verbatim (see rule 4). If the frontmatter has an \`faq\` list, translate BOTH the \`q\` (question) and \`a\` (answer) string of every entry into the target language — never leave a question in English; keep only literal error text, HTTP status codes, commands, and identifiers verbatim (per rule 2). COMPLETENESS IS MANDATORY: your output's \`faq\` list MUST contain exactly as many \`- q:\`/\`a:\` entries as the input's, in the same order — reproduce every single entry INCLUDING THE LAST ONE; never drop, omit, merge, summarize, or skip an entry even if it seems redundant or region-specific. The same "reproduce every item, drop none" rule applies to every other frontmatter list (keywords, alternateNames, etc.).
2. COPY BYTE-FOR-BYTE — never translate, transliterate, reformat, or drop:
   - URLs and domains. In particular keep \`api.lmuai.com\` EXACTLY — never write api.lmuai.ai or any other host.
   - email addresses, QQ / group numbers, phone numbers.
   - monetary amounts written with ¥ (e.g. ¥1, ¥100).
   - API-key prefixes like \`sk-...\`, tokens, environment-variable names (e.g. ANTHROPIC_BASE_URL, OPENAI_API_KEY), and API paths like \`/v1/messages\`.
   - model IDs (e.g. claude-opus-4-8, gpt-image-1, gemini-2.5-flash).
   - EVERYTHING inside inline code spans (\`...\`) and fenced code blocks (\`\`\`...\`\`\`), including code comments — reproduce each code block unchanged.
   - Markdown link TARGETS and URL fragments: translate only the link TEXT in [text](target), never the target. Keep in-page anchors like (#issue-1) and heading-id suffixes like [#issue-1] exactly as-is.
   - MDX/JSX components and their prop names (<ModelGrid>, <ModelCard .../>, <Tabs>, <Tab value="...">, <Callout>): keep tag names and identifier-valued props verbatim; translate only human-readable text and labels.
3. Keep every \`<CN>...</CN>\` and \`<Intl>...</Intl>\` marker exactly where it appears (same tags, same count, same order). Translate the prose INSIDE both blocks. Never add, remove, reorder, merge, or nest these markers.
4. Keep these product / brand names verbatim (do not translate or transliterate): ${GLOSSARY.join(', ')}.
5. Do NOT invent facts. Never add latency numbers, uptime percentages, prices, SLAs, or any China-specific access wording that is not in the source. If the source states something neutrally, keep it neutral.
6. Preserve document structure exactly: heading levels (#, ##, ...), ordered/unordered lists, tables (keep column count and separator rows), blockquotes, Callout/Tabs blocks, and blank-line spacing.

Target language: ${LANG_NAME[lang]}. Return the translated MDX only.`;
}

const META_SYSTEM = (lang) =>
  `Translate the given UI label strings into ${LANG_NAME[lang]}. These are navigation section titles for a developer-documentation sidebar. Keep product / brand names verbatim (${GLOSSARY.join(', ')}); keep "API" as "API". Return ONLY a JSON object mapping each input key to its translated string — no commentary, no code fence.`;

// ── 输出清洗 ────────────────────────────────────────────────────────────────────
function unwrapFence(s) {
  let t = s.replace(/^﻿/, '').trim();
  // 去掉模型偶尔套上的外层 ```mdx ... ```
  const m = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (m && m[1].trimStart().startsWith('---')) t = m[1];
  return t;
}
function localizeLinks(s, lang) {
  return s.split('/en/docs').join(`/${lang}/docs`);
}
// 源里绝不该出现 api.lmuai.ai（CLAUDE.md：源一律写 .com，.ai 由物化器构建期改写）。
// 模型看到「international gateway」时爱把域名「顺手改对」成 .ai —— 那是错的。任何
// 输出里的 api.lmuai.ai 都是翻译错误，确定性回改为 .com，不靠模型自觉/重试。
function protectDomain(s) {
  return s.split('api.lmuai.ai').join('api.lmuai.com');
}
function normalizeEof(s) {
  return s.replace(/\s+$/, '') + '\n';
}

// ── 代码围栏遮罩：送模型前把 ```...``` 换成惰性占位符，收回后逐字复原 ──────────────────
// 为什么（一石二鸟，确定性、不靠模型自觉）：
//  · 代码块必须逐字保留，但模型会去翻译 ```text 里的自然语言散文（校验必挂「代码块被改写」）。
//  · 大段代码原样回吐会把 max_tokens 撑爆（TRUNCATED，见 gemini-image 这类代码密集页）。
// 遮罩后模型只见散文 + 短占位符：输出体量≈散文、代码零改写。占位符用行内代码反引号包裹，
// 蹭「行内代码原样」这条规则再加一层保险；定宽 3 位序号避免前缀相撞；复原用字面 split/join，
// 对 $ / 反斜杠等特殊字符安全。
// 只遮罩「真需要遮罩」的围栏，其余交模型逐字抄。为什么选择性遮罩：
//  · 遮罩本身会引入「丢块」——把围栏换成惰性占位符后，若它落在「等着填值」的位置（列表续行、
//    前句以冒号收尾，如 `Set Base URL to:` 下那行只有一个 URL 的裸栏），模型会把这个「无意义
//    的 token 代码块」整段删掉（cursor 实测多语复现，chatbox 同款却侥幸不丢——纯属脆弱）。
//    而遮罩前模型对**真实** URL/命令块是逐字忠实照抄的（早期失败只有 TRUNCATED 和 ```text 散
//    文误译，从无「URL 块被删」）。故短的纯代码/URL 块**不遮罩**最稳。
//  · 遮罩真正解决的只有两件事：① 大代码块回吐撑爆 max_tokens（TRUNCATED，见 gemini-image）；
//    ② ```text / 空 info 的「散文样」块被模型翻译（校验挂「代码块被改写」，见 gemini-image-batch
//    的轮询节奏块、faq 的报错样例）。→ 只对「够长」或「散文样」的块遮罩即可两头兼顾。
// 遮罩形态用**围栏块占位符**（蹭「原样复现代码块」最强指令），并捕获开栏行前导缩进（列表续行），
// 占位符按同缩进重排；复原时把缩进作**前缀**贴回原块——原块自 ``` 起（与 extractAtoms 视角一致），
// 故「缩进 + 原块」必然「包含原块子串」，逐字校验照过，列表续行渲染缩进也保住。
const FENCE_MASK_RE = /^([ \t]*)(```[\s\S]*?```)/gm;
const fenceToken = (i) => `LMU_FENCE_${String(i).padStart(3, '0')}`;
const MASK_LEN = 80; // 正文体量的代码块才值得遮罩；更短的纯代码/URL 交给模型逐字抄（更稳）
function fenceLangBody(block) {
  const nl = block.indexOf('\n');
  const lang = nl === -1 ? '' : block.slice(3, nl).trim();
  const body = nl === -1 ? '' : block.slice(nl + 1, block.lastIndexOf('```')).replace(/\s+$/, '');
  return { lang, body };
}
// 「散文样」：任一行含 ≥4 个字母词——像句子，模型会顺手翻译。**不因语言是代码类就整体豁免**：
// bash 的 `# ...` 注释、json 的句子型取值（如 "your sk- key generated in the console"）同样是英文
// 散文，不遮罩就会被模型译走（校验挂「代码块被改写」，实测 codex-cli-mac / codex-app 多语全复现）。
// 纯命令 / 纯键值行（node --version、key = "x"、rm -rf ~/.codex）字母词 <4，不会误判；即便偶有误判，
// 也只是多遮一个「带语言标签」的块——那类遮罩早已验证稳定（丢块只发生在「裸栏落在等值位」，见下，
// 与带标签块无关；本函数也不改裸栏行为）。lang 参数保留以备将来按语言细分，当前逐行判定已够。
function proseRiskFence(lang, body) {
  for (const l of body.split('\n')) {
    const words = l.trim().split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w));
    if (words.length >= 4) return true;
  }
  return false;
}
function shouldMask(lang, body) {
  return body.length >= MASK_LEN || proseRiskFence(lang, body);
}
function maskFences(src) {
  const blocks = [];
  const masked = src.replace(FENCE_MASK_RE, (_m, indent, block) => {
    const { lang, body } = fenceLangBody(block);
    if (!shouldMask(lang, body)) return `${indent}${block}`; // 短纯代码/URL：不遮罩，模型逐字抄
    const t = fenceToken(blocks.length);
    blocks.push(block); // 存「``` 起」的原块，复原即字节还原
    return `${indent}\`\`\`\n${indent}${t}\n${indent}\`\`\``;
  });
  return { masked, blocks };
}
function restoreFences(out, blocks) {
  let s = out;
  for (let i = 0; i < blocks.length; i++) {
    const t = fenceToken(i);
    // 1) 围栏形态（可选语言标签、任意行首缩进）：整块换回原始代码块，缩进作前缀贴回
    const fenced = new RegExp('([ \\t]*)```[^\\n`]*\\n[ \\t]*' + t + '[ \\t]*\\n[ \\t]*```', 'g');
    s = s.replace(fenced, (_m, indent) => indent + blocks[i]);
    // 2) 行内代码形态（模型偶尔把围栏占位符降级成行内代码）
    s = s.split('`' + t + '`').join(blocks[i]);
    // 3) 裸词兜底（模型偶尔连反引号一起丢）
    s = s.split(t).join(blocks[i]);
  }
  return s;
}

// ── 不变量提取与校验 ──────────────────────────────────────────────────────────────
function frontmatterOf(s) {
  if (!s.startsWith('---\n')) return '';
  const end = s.indexOf('\n---', 4);
  return end === -1 ? '' : s.slice(4, end);
}
function fmKeys(s) {
  const fm = frontmatterOf(s);
  const keys = new Set();
  for (const line of fm.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):/);
    if (m) keys.add(m[1]);
  }
  return keys;
}
function countOccurrences(hay, needle) {
  if (!needle) return 0;
  return hay.split(needle).length - 1;
}
function extractAtoms(src) {
  // 正则会把「句尾标点」吞进 URL/邮箱/金额匹配（如 base_url 到 https://api.lmuai.com/v1. 的句点），
  // 那不是 URL/金额的一部分；译文里其后常跟目标语标点（日文「。」等），逐字比对会误报丢失。
  // 统一剥掉尾随的中英文句读，再做「原样出现」断言。
  const TRAIL = /[.,;:!?。，、]+$/u;
  const urls = [...src.matchAll(/https?:\/\/[^\s)\]}"'`>]+/g)].map((m) => m[0].replace(TRAIL, ''));
  const emails = [...src.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].replace(TRAIL, ''));
  const amounts = [...src.matchAll(/¥[\d.,]+/g)].map((m) => m[0].replace(/[.,]+$/, ''));
  const fences = [...src.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
  const anchorIds = [...src.matchAll(/\[#[A-Za-z0-9-]+\]/g)].map((m) => m[0]);
  const anchorRefs = [...src.matchAll(/\(#[A-Za-z0-9-]+\)/g)].map((m) => m[0]);
  return {
    urls: [...new Set(urls)],
    emails: [...new Set(emails)],
    amounts,
    fences,
    anchorIds: [...new Set(anchorIds)],
    anchorRefs: [...new Set(anchorRefs)],
    apiComCount: countOccurrences(src, 'api.lmuai.com'),
    keys: fmKeys(src),
  };
}
// 返回 { hard:[...], warn:[...] }
function validate(src, out, lang) {
  const a = extractAtoms(src);
  const hard = [];
  const warn = [];

  if (!out.startsWith('---\n') || out.indexOf('\n---', 4) === -1) hard.push('缺少完整 frontmatter');
  else {
    // frontmatter 必须是合法 YAML（模型偶发未转义引号 / 裸冒号 → 直到 next build 才炸）；
    // normalizeFrontmatterQuoting 已尽力修，这里兜底：仍非法则判失败重试（模型重采样多能过）。
    try { yaml.load(out.slice(4, out.indexOf('\n---', 4))); }
    catch (e) { hard.push(`frontmatter 非法 YAML：${String(e.message).split('\n')[0]}`); }
  }
  // 禁止把端点改写成 .ai（源里绝不该出现 .ai）
  if (out.includes('api.lmuai.ai')) hard.push('出现 api.lmuai.ai（源禁止；.ai 由物化器改写）');
  // 端点计数不得减少
  const outApiCom = countOccurrences(out, 'api.lmuai.com');
  if (outApiCom < a.apiComCount) hard.push(`api.lmuai.com 计数缩水 ${a.apiComCount}→${outApiCom}`);
  // URL / email / 金额必须原样出现
  for (const u of a.urls) if (!out.includes(u)) hard.push(`URL 丢失/被改：${u}`);
  for (const e of a.emails) if (!out.includes(e)) hard.push(`邮箱丢失/被改：${e}`);
  for (const m of a.amounts) if (!out.includes(m)) hard.push(`金额丢失/被改：${m}`);
  // 代码块必须逐字保留
  for (const f of a.fences) if (!out.includes(f)) hard.push(`代码块被改写：${f.slice(0, 40).replace(/\n/g, '⏎')}…`);
  // 锚点 id / 页内引用必须保留
  for (const t of a.anchorIds) if (!out.includes(t)) hard.push(`标题锚点 id 丢失：${t}`);
  for (const t of a.anchorRefs) if (!out.includes(t)) hard.push(`页内锚点引用丢失：${t}`);
  // <CN>/<Intl> 标记数量守恒
  for (const tag of ['<CN>', '</CN>', '<Intl>', '</Intl>']) {
    const s = countOccurrences(src, tag);
    const o = countOccurrences(out, tag);
    if (s !== o) hard.push(`${tag} 数量不守恒 ${s}→${o}`);
  }
  // frontmatter 顶层键集合一致
  const ok = fmKeys(out);
  for (const k of a.keys) if (!ok.has(k)) hard.push(`frontmatter 键丢失：${k}`);
  for (const k of ok) if (!a.keys.has(k)) warn.push(`frontmatter 多出键：${k}`);
  // 语言前缀改写后不应再残留 /en/docs
  if (out.includes('/en/docs')) hard.push('仍残留 /en/docs（前缀改写未覆盖）');

  return { hard, warn };
}

// ── frontmatter 安全再序列化 ────────────────────────────────────────────────────
// 模型偶发把含 ": " 的值写成未加引号（YAML 读成嵌套 map），或双引号值里留未转义的 "，
// 都会让 frontmatter 变成非法 YAML、直到 next build 才炸（content-guard 不跑 build）。
// 这里确定性兜底：仅当整块 frontmatter 无法解析时，逐行把「无法作为纯字符串往返」的单行
// 标量用转义双引号重写，内容逐字保留；能整体解析的 frontmatter 一个字节都不碰。
function fmValueRoundTrips(val) {
  try {
    const r = yaml.load('x: ' + val);
    return !(r === null || typeof r.x === 'object'); // null / 嵌套对象 ⇒ 坏
  } catch {
    return false; // 引号标量后有多余内容等
  }
}
function fmLogicalContent(v) {
  v = v.replace(/[ \t]+$/, '');
  if (v.startsWith('"')) {
    const last = v.lastIndexOf('"');
    const inner = last > 0 ? v.slice(1, last) : v.slice(1);
    return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (v.startsWith("'")) {
    const last = v.lastIndexOf("'");
    const inner = last > 0 ? v.slice(1, last) : v.slice(1);
    return inner.replace(/''/g, "'");
  }
  return v;
}
function fmRequote(v) {
  const c = fmLogicalContent(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${c}"`;
}
const FM_KV = /^(\s*)(- )?(title|description|ogDescription|q|a):[ \t]+(.+?)[ \t]*$/;
const FM_LIST = /^(\s*)-[ \t]+(.+?)[ \t]*$/;
function normalizeFrontmatterQuoting(mdx) {
  if (!mdx.startsWith('---\n')) return mdx;
  const end = mdx.indexOf('\n---', 4);
  if (end === -1) return mdx;
  const fm = mdx.slice(4, end);
  try { yaml.load(fm); return mdx; } catch { /* 需修复 */ }
  const fixed = fm.split('\n').map((line) => {
    let m = line.match(FM_KV); // 先判 key: value（含 "- q:"），命中即返回，避免被 FM_LIST 抢
    if (m) {
      const [, ind, dash, key, val] = m;
      return fmValueRoundTrips(val) ? line : `${ind}${dash || ''}${key}: ${fmRequote(val)}`;
    }
    m = line.match(FM_LIST); // 纯列表项（keywords / alternateNames …）
    if (m) {
      const [, ind, val] = m;
      return fmValueRoundTrips(val) ? line : `${ind}- ${fmRequote(val)}`;
    }
    return line;
  }).join('\n');
  return '---\n' + fixed + mdx.slice(end);
}

// ── 页面翻译 ──────────────────────────────────────────────────────────────────
async function translatePage(slug, lang) {
  const srcPath = join(ROOT, `${slug}.en.mdx`);
  const raw = readFileSync(srcPath, 'utf8');
  const neutral = neutralizeSource(raw);
  const { masked, blocks } = maskFences(neutral);
  // 代码已遮罩为短占位符，输出体量≈散文；按遮罩后长度给足预算，封顶 32k（网关已知可用）。
  const maxTokens = Math.min(32000, Math.max(12000, masked.length));

  let domainReverts = 0;
  const out = await withRetry(
    async () => {
      const text = await callGateway(pageSystemPrompt(lang), masked, maxTokens);
      const unwrapped = unwrapFence(text);
      // 占位符必须一一回来（各恰好 1 次）——缺失/重复即判失败重试，避免复原错位。
      for (let i = 0; i < blocks.length; i++) {
        const c = countOccurrences(unwrapped, fenceToken(i));
        if (c !== 1) throw new Error(`代码占位符 ${fenceToken(i)} 出现 ${c} 次（应为 1）`);
      }
      domainReverts = countOccurrences(unwrapped, 'api.lmuai.ai');
      let cleaned = normalizeEof(localizeLinks(protectDomain(unwrapped), lang));
      cleaned = restoreFences(cleaned, blocks);
      if (cleaned.includes('LMU_FENCE_')) throw new Error('代码占位符复原残留');
      cleaned = normalizeFrontmatterQuoting(cleaned); // 确定性修好未加引号/未转义引号的 frontmatter 标量
      const { hard } = validate(neutral, cleaned, lang);
      if (hard.length) throw new Error(`校验未过：\n    - ${hard.join('\n    - ')}`);
      return cleaned;
    },
    { tries: 3, label: `${slug}.${lang}` },
  );

  // 二次校验取 warn（用于汇总，不阻断）
  const { warn } = validate(neutral, out, lang);
  if (domainReverts) warn.push(`模型误写 api.lmuai.ai ×${domainReverts}（已确定性回改为 .com）`);
  const outPath = join(ROOT, `${slug}.${lang}.mdx`);
  writeFileSync(outPath, out, 'utf8');
  return { outPath, warn, srcHash: sha256(neutral) };
}

// ── 导航 meta 翻译（确定性重建，slug 原样，只译 title 与 --- 分隔符标签） ──────────────
const META_DEFS = [
  { file: 'meta.en.json', dir: '' },
  { file: 'guide/meta.en.json', dir: 'guide' },
  { file: 'tools/meta.en.json', dir: 'tools' },
  { file: 'api/meta.en.json', dir: 'api' },
];
function readMeta(file) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}
function sepLabel(s) {
  const m = s.match(/^---\s*(.*?)\s*---$/);
  return m ? m[1] : null;
}
async function translateMeta(lang) {
  // 收集所有需要翻译的短串（title + 分隔符标签），一次网关调用。
  const metas = META_DEFS.map((d) => ({ ...d, json: readMeta(d.file) }));
  const jobs = {}; // key -> english string
  for (const m of metas) {
    jobs[`title:${m.dir}`] = m.json.title;
    for (const p of m.json.pages || []) {
      const label = sepLabel(p);
      if (label) jobs[`sep:${m.dir}:${p}`] = label;
    }
  }
  const translated = await withRetry(
    async () => {
      const text = await callGateway(META_SYSTEM(lang), JSON.stringify(jobs, null, 2), 2000);
      const cleaned = text.replace(/^﻿/, '').trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
      const obj = JSON.parse(cleaned);
      for (const k of Object.keys(jobs)) if (!(k in obj) || !String(obj[k]).trim()) throw new Error(`meta 翻译缺键：${k}`);
      return obj;
    },
    { tries: 3, label: `meta.${lang}` },
  );

  const written = [];
  for (const m of metas) {
    const out = { title: translated[`title:${m.dir}`] };
    if (m.json.root) out.root = true;
    out.pages = (m.json.pages || [])
      .filter((p) => {
        // 丢弃 compliance slug（新语种无此页）
        const full = m.dir ? `${m.dir}/${p}` : p;
        return !SKIP_SLUGS.has(full);
      })
      .map((p) => {
        const label = sepLabel(p);
        if (label) return `---${translated[`sep:${m.dir}:${p}`]}---`;
        return p; // 普通 slug 原样
      });
    const outFile = join(ROOT, m.dir, `meta.${lang}.json`);
    writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
    written.push(relative(ROOT, outFile));
  }
  return written;
}

// ── 工具 ────────────────────────────────────────────────────────────────────────
function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
function listSlugs() {
  const slugs = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${name.name}` : name.name;
      if (name.isDirectory()) walk(rel);
      else if (name.name.endsWith('.en.mdx')) slugs.push(rel.slice(0, -'.en.mdx'.length));
    }
  };
  walk('');
  return slugs.sort();
}
function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveCache(c) {
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2) + '\n', 'utf8');
}
function parseArgs(argv) {
  const a = { langs: null, only: null, force: false, concurrency: 4, metaOnly: false, pagesOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--langs') a.langs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--only') a.only = argv[++i];
    else if (k === '--force') a.force = true;
    else if (k === '--concurrency') a.concurrency = Math.max(1, parseInt(argv[++i], 10) || 4);
    else if (k === '--meta-only') a.metaOnly = true;
    else if (k === '--pages-only') a.pagesOnly = true;
  }
  return a;
}
// 并发池
async function pool(items, size, worker) {
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await worker(items[my], my);
    }
  });
  await Promise.all(runners);
  return results;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const langs = (args.langs || ALL_NEW_LANGS).filter((l) => {
    if (!ALL_NEW_LANGS.includes(l)) {
      process.stderr.write(`⚠ 忽略未知语种：${l}\n`);
      return false;
    }
    return true;
  });
  if (!langs.length) throw new Error('无有效目标语种');

  const allSlugs = listSlugs();
  let slugs = allSlugs.filter((s) => !SKIP_SLUGS.has(s));
  if (args.only) {
    slugs = slugs.filter((s) => s === args.only);
    if (!slugs.length) throw new Error(`--only ${args.only} 未匹配任何页（可选：${allSlugs.join(', ')}）`);
  }

  console.log(`翻译引擎：${BASE}  model=${MODEL}  key=${TOKEN ? '已加载' : '缺失'}`);
  console.log(`目标语种：${langs.join(', ')}`);
  console.log(`页面数：${slugs.length}（跳过 compliance）  并发：${args.concurrency}${args.force ? '  [force]' : ''}`);

  const cache = loadCache();
  const summary = { written: [], skipped: [], failed: [], warns: [] };

  // 1) 页面
  if (!args.metaOnly) {
    const tasks = [];
    for (const slug of slugs) {
      const neutralHash = sha256(neutralizeSource(readFileSync(join(ROOT, `${slug}.en.mdx`), 'utf8')));
      for (const lang of langs) {
        const key = `${slug}::${lang}`;
        const outPath = join(ROOT, `${slug}.${lang}.mdx`);
        if (!args.force && cache[key] === neutralHash && existsSync(outPath)) {
          summary.skipped.push(key);
          continue;
        }
        tasks.push({ slug, lang, key });
      }
    }
    console.log(`\n待翻译页任务：${tasks.length}（已缓存跳过 ${summary.skipped.length}）\n`);

    let done = 0;
    await pool(tasks, args.concurrency, async (t) => {
      try {
        const { outPath, warn, srcHash } = await translatePage(t.slug, t.lang);
        cache[t.key] = srcHash;
        saveCache(cache);
        summary.written.push(relative(ROOT, outPath));
        if (warn.length) summary.warns.push(`${t.key}: ${warn.join('; ')}`);
        console.log(`✓ [${++done}/${tasks.length}] ${relative(ROOT, outPath)}`);
      } catch (e) {
        summary.failed.push(`${t.key}\n    ${e.message}`);
        console.error(`✗ [${++done}/${tasks.length}] ${t.key}: ${e.message}`);
      }
    });
  }

  // 2) 导航 meta（每语种一次调用；--only 单页试点时跳过以免误建整套 meta）
  if (!args.pagesOnly && !args.only) {
    console.log('\n重建导航 meta…');
    for (const lang of langs) {
      const metaHash = sha256(META_DEFS.map((d) => readFileSync(join(ROOT, d.file), 'utf8')).join(' '));
      const key = `__meta__::${lang}`;
      const allExist = META_DEFS.every((d) => existsSync(join(ROOT, d.dir, `meta.${lang}.json`)));
      if (!args.force && cache[key] === metaHash && allExist) {
        summary.skipped.push(key);
        continue;
      }
      try {
        const written = await translateMeta(lang);
        cache[key] = metaHash;
        saveCache(cache);
        summary.written.push(...written);
        console.log(`✓ meta.${lang}.json ×${written.length}`);
      } catch (e) {
        summary.failed.push(`${key}\n    ${e.message}`);
        console.error(`✗ meta.${lang}: ${e.message}`);
      }
    }
  }

  // 3) 汇总
  console.log('\n──────── 汇总 ────────');
  console.log(`写入：${summary.written.length}  缓存跳过：${summary.skipped.length}  失败：${summary.failed.length}`);
  if (summary.warns.length) {
    console.log(`\n⚠ 警告（不阻断）：`);
    for (const w of summary.warns) console.log(`  - ${w}`);
  }
  if (summary.failed.length) {
    console.log(`\n✗ 失败清单：`);
    for (const f of summary.failed) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\n全部成功。下一步：node scripts/check-i18n-parity.mjs');
  }
}

main().catch((e) => {
  console.error(`\n致命错误：${e.stack || e.message}`);
  process.exit(1);
});
