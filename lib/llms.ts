import { llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';
import {
  SITE_NAME,
  SITE_NAME_EN,
  SITE_URL,
  API_BASE_URL,
} from '@/lib/site';
import { MODELS, FLAGSHIP } from '@/lib/models';
import { localePrefix } from '@/lib/i18n';

// llms.txt / llms-full.txt 的双语生成器。
//
// 站点是 cn+en 双语：.com 主文件（/llms.txt、/llms-full.txt）以中文为主；
// 英文另出 /en/llms.txt、/en/llms-full.txt，给英文语境的生成式引擎一个发现面
// （此前英文 36 页在 llms 层完全缺席）。所有英文均为站内既有中文事实的忠实翻译，
// 端点、/v1、模型 ID、sk- 前缀、Claude Max 等一律保持原样，不新增事实。
//
// cn 输出与重构前逐字一致（关键事实块、各行文案、绝对 URL 改写口径均未变），
// 以免破坏既有 llms.txt 与 prodcheck 断言。

// getPages(lang) 是文件系统顺序（enterprise 会排在 docs 前），按导航区块重排。
const SECTIONS = ['/docs', '/docs/guide', '/docs/tools', '/docs/api'];

function sectionSortKey(url: string, docsBase: string): number {
  // docsBase = '' 段的 '/docs' 前缀（cn）或 '/en/docs'（en）。
  const rel = url.slice(docsBase.length); // 去掉语言前缀后与 SECTIONS 比对
  const i = SECTIONS.findIndex((prefix) =>
    prefix === '/docs' ? rel === '/docs' : rel.startsWith(prefix + '/'),
  );
  return i === -1 ? SECTIONS.length : i;
}

// mdxAsPlaceholder 的产物是 \0 包裹的 JSON（{"name":"ModelCard","attributes":{...}}）。
// 保留 JSON 对 AI 是噪音，且 \0 会让文件被当成二进制；这里把它还原成可读文本。
function renderPlaceholders(md: string): string {
  return md.replace(/\0([^\0]*)\0/g, (_, json: string) => {
    try {
      const node = JSON.parse(json) as {
        name: string;
        children?: string;
        attributes?: Record<string, string>;
      };
      const inner = node.children ? renderPlaceholders(node.children) : '';
      if (node.name === 'ModelCard') {
        const { name, description, badge } = node.attributes ?? {};
        return `- \`${name}\` — ${description ?? ''}${badge ? `（${badge}）` : ''}\n`;
      }
      return inner;
    } catch {
      return '';
    }
  });
}

interface LlmsStrings {
  siteName: string;
  sep: string;
  indexHeading: (name: string) => string;
  blockquote: string;
  bullets: {
    apiBase: string;
    fullDocs: string;
    modelPlaza: string;
    errors: string;
    flagship: string;
    newest: string;
    size: (tools: number, guide: number, api: number) => string;
  };
  keyFactsHeading: string;
  keyFacts: string[];
  fullHeading: (name: string) => string;
  fullBlockquote: string;
}

function strings(lang: string): LlmsStrings {
  if (lang === 'en') {
    return {
      siteName: SITE_NAME_EN,
      sep: ', ',
      indexHeading: (name) => `# ${name} (Lingmou AI)`,
      blockquote:
        '> LMU AI (Lingmou AI) is a large-model API relay for users in mainland China. One API key calls Claude, OpenAI GPT and leading Chinese models; the gateway is hosted inside mainland China for direct, proxy-free access. This site is its integration documentation, covering how to configure mainstream AI tools such as Claude Code, Codex CLI, Cursor, Trae and Chatbox, plus the image-generation API and the usage-export API.',
      bullets: {
        apiBase: `- API Base URL: ${API_BASE_URL}`,
        fullDocs: `- Full docs (with body text): ${SITE_URL}/en/llms-full.txt`,
        modelPlaza: `- Model plaza: ${SITE_URL}/en/docs/guide/models`,
        errors: `- Error-code reference: ${SITE_URL}/en/docs/guide/errors`,
        flagship: '- Current flagship model per vendor: ',
        newest: '- Newest models: ',
        size: (tools, guide, api) =>
          `- Documentation size: ${tools} tool guides · ${guide} user guides · ${api} API references`,
      },
      keyFactsHeading: '## Key facts',
      keyFacts: [
        `- **Protocol determines the Base URL**: the Anthropic protocol uses \`${API_BASE_URL}\` (**without** \`/v1\`); the OpenAI-compatible protocol uses \`${API_BASE_URL}/v1\` (**must include** \`/v1\`); the Gemini native protocol uses \`${API_BASE_URL}/v1beta/models/...\`. Using the address of the wrong protocol returns 401 or 404.`,
        '- **Direct access inside mainland China, no proxy needed**: the gateway is deployed inside mainland China and `api.lmuai.com` is directly reachable there. Running a VPN / system proxy can instead cause dropouts, because the proxy switches your egress IP.',
        '- **One key for all three protocols**: the same `sk-` key generated in the console works with the Anthropic, OpenAI-compatible and Gemini native protocols — no need to request a separate key per tool.',
        '- **The Claude Max group supports the Anthropic protocol only**: that group is for Claude Code and does not support OpenAI-protocol endpoints; the other groups support both protocols. The actual set of callable models is whatever the console’s “Available models” page shows.',
      ],
      fullHeading: (name) => `# ${name} (Lingmou AI) — Full Documentation`,
      fullBlockquote: `> LMU AI (Lingmou AI) is a large-model API relay for users in mainland China. One API key calls Claude, OpenAI GPT and leading Chinese models. API Base URL: ${API_BASE_URL}`,
    };
  }
  return {
    siteName: SITE_NAME,
    sep: '、',
    indexHeading: (name) => `# ${name}（灵眸 AI）`,
    blockquote:
      '> 灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT 与国产大模型，网关部署在中国境内、国内直连免代理。本站是它的接入文档，覆盖 Claude Code、Codex CLI、Cursor、Trae、Chatbox 等主流 AI 工具的配置方法，以及生图 API 与用量导出 API。',
    bullets: {
      apiBase: `- API Base URL：${API_BASE_URL}`,
      fullDocs: `- 完整文档（含正文）：${SITE_URL}/llms-full.txt`,
      modelPlaza: `- 模型广场：${SITE_URL}/docs/guide/models`,
      errors: `- 错误码速查：${SITE_URL}/docs/guide/errors`,
      flagship: '- 各厂商当前旗舰模型：',
      newest: '- 最新上线模型：',
      size: (tools, guide, api) =>
        `- 文档规模：工具配置 ${tools} 篇 · 用户指南 ${guide} 篇 · 开放 API ${api} 篇`,
    },
    keyFactsHeading: '## 关键事实',
    keyFacts: [
      `- **协议决定 Base URL**：Anthropic 协议用 \`${API_BASE_URL}\`（**不带** \`/v1\`）；OpenAI 兼容协议用 \`${API_BASE_URL}/v1\`（**必须带** \`/v1\`）；Gemini 原生协议走 \`${API_BASE_URL}/v1beta/models/...\`。填错协议对应的地址会直接返回 401 或 404。`,
      '- **国内直连，无需代理**：接入网关部署在中国境内，`api.lmuai.com` 国内可直接访问。反而是挂着 VPN / 系统代理时，代理自动切换出口 IP 容易造成断流。',
      '- **一把密钥通用三种协议**：后台生成的同一个 `sk-` 开头密钥可用于 Anthropic、OpenAI 兼容与 Gemini 原生三种协议，无需为不同工具申请不同密钥。',
      '- **Claude Max 分组仅支持 Anthropic 协议**：该分组只供 Claude Code 使用，不支持 OpenAI 协议端点；其余分组两种协议都可用。实际可调用的模型范围以后台「可用模型」页为准。',
    ],
    fullHeading: (name) => `# ${name}（灵眸 AI）完整文档`,
    fullBlockquote: `> 灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT 与国产大模型。API Base URL：${API_BASE_URL}`,
  };
}

/** /llms.txt（cn）与 /en/llms.txt（en）的正文。 */
export function buildLlmsIndex(lang: string): string {
  const s = strings(lang);
  const pfx = localePrefix(lang); // '' | '/en'
  const docsBase = `${pfx}/docs`;

  // llms() 输出相对路径（如 ](/docs... 或 ](/en/docs...），llmstxt.org 规范偏好绝对
  // URL（AI 抓到后要能直接访问）。按当前语言的 doc 前缀精确改写为绝对地址。
  const tree = llms(source)
    .index(lang)
    .replaceAll(`](${docsBase}`, `](${SITE_URL}${docsBase}`);

  const flagships = Object.values(FLAGSHIP).join(s.sep);
  const newModels = MODELS.filter((m) => m.isNew)
    .map((m) => m.id)
    .join(s.sep);

  // 各区篇数由 source 实时统计，避免新增页面后这里的数字失真。
  const countUnder = (section: string) =>
    source.getPages(lang).filter((p) => p.url.startsWith(`${docsBase}${section}`)).length;

  const body = [
    s.indexHeading(s.siteName),
    '',
    s.blockquote,
    '',
    s.bullets.apiBase,
    s.bullets.fullDocs,
    s.bullets.modelPlaza,
    s.bullets.errors,
    `${s.bullets.flagship}${flagships}`,
    `${s.bullets.newest}${newModels}`,
    s.bullets.size(countUnder('/tools'), countUnder('/guide'), countUnder('/api')),
    '',
    // 这几条散落在几十页里，靠逐页归纳最容易搞错，在这里集中陈述一次。
    s.keyFactsHeading,
    '',
    ...s.keyFacts,
    '',
    tree,
  ].join('\n');

  return body;
}

/** /llms-full.txt（cn）与 /en/llms-full.txt（en）的正文（含全文）。 */
export async function buildLlmsFull(lang: string): Promise<string> {
  const pfx = localePrefix(lang);
  const docsBase = `${pfx}/docs`;
  const s = strings(lang);

  const pages = source.getPages(lang).sort((a, b) => {
    const d = sectionSortKey(a.url, docsBase) - sectionSortKey(b.url, docsBase);
    return d !== 0 ? d : a.url.localeCompare(b.url);
  });

  const sections = await Promise.all(
    pages.map(async (page) => {
      const content = renderPlaceholders(await page.data.getText('processed'));
      return [
        `# ${page.data.title}`,
        '',
        `URL: ${SITE_URL}${page.url}`,
        ...(page.data.description ? ['', `> ${page.data.description}`] : []),
        '',
        content,
      ].join('\n');
    }),
  );

  return [
    s.fullHeading(s.siteName),
    '',
    s.fullBlockquote,
    '',
    ...sections,
  ].join('\n\n---\n\n');
}

/** 统一的 text/plain 响应封装。 */
export function llmsResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
