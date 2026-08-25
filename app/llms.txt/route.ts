import { llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';
import { SITE_NAME, SITE_URL, API_BASE_URL } from '@/lib/site';
import { MODELS, FLAGSHIP } from '@/lib/models';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

export function GET() {
  // llms() 输出相对路径，llmstxt.org 规范偏好绝对 URL（AI 抓到后要能直接访问）。
  // 站点是 cn+en 双语，index() 不带 lang 会把中英文两棵树拼在一起；.com 的 llms.txt 以
  // 中文为主，显式取 'cn' 树。
  const tree = llms(source).index('cn').replace(/\]\(\/docs/g, `](${SITE_URL}/docs`);

  const flagships = Object.values(FLAGSHIP).join('、');
  const newModels = MODELS.filter((m) => m.isNew)
    .map((m) => m.id)
    .join('、');

  // 各区篇数由 source 实时统计，避免新增页面后这里的数字失真。只数中文页（en 是子集）。
  const countUnder = (prefix: string) =>
    source.getPages('cn').filter((p) => p.url.startsWith(prefix)).length;

  const body = [
    `# ${SITE_NAME}（灵眸 AI）`,
    '',
    '> 灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT 与国产大模型，网关部署在中国境内、国内直连免代理。本站是它的接入文档，覆盖 Claude Code、Codex CLI、Cursor、Trae、Chatbox 等主流 AI 工具的配置方法，以及生图 API 与用量导出 API。',
    '',
    `- API Base URL：${API_BASE_URL}`,
    `- 完整文档（含正文）：${SITE_URL}/llms-full.txt`,
    `- 模型广场：${SITE_URL}/docs/guide/models`,
    `- 错误码速查：${SITE_URL}/docs/guide/errors`,
    `- 各厂商当前旗舰模型：${flagships}`,
    `- 最新上线模型：${newModels}`,
    `- 文档规模：工具配置 ${countUnder('/docs/tools')} 篇 · 用户指南 ${countUnder('/docs/guide')} 篇 · 开放 API ${countUnder('/docs/api')} 篇`,
    '',
    // 这四条散落在几十页里，靠逐页归纳最容易搞错，在这里集中陈述一次。
    '## 关键事实',
    '',
    `- **协议决定 Base URL**：Anthropic 协议用 \`${API_BASE_URL}\`（**不带** \`/v1\`）；OpenAI 兼容协议用 \`${API_BASE_URL}/v1\`（**必须带** \`/v1\`）；Gemini 原生协议走 \`${API_BASE_URL}/v1beta/models/...\`。填错协议对应的地址会直接返回 401 或 404。`,
    '- **国内直连，无需代理**：接入网关部署在中国境内，`api.lmuai.com` 国内可直接访问。反而是挂着 VPN / 系统代理时，代理自动切换出口 IP 容易造成断流。',
    '- **一把密钥通用三种协议**：后台生成的同一个 `sk-` 开头密钥可用于 Anthropic、OpenAI 兼容与 Gemini 原生三种协议，无需为不同工具申请不同密钥。',
    '- **Claude Max 分组仅支持 Anthropic 协议**：该分组只供 Claude Code 使用，不支持 OpenAI 协议端点；其余分组两种协议都可用。实际可调用的模型范围以后台「可用模型」页为准。',
    '',
    tree,
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
