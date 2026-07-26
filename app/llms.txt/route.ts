import { llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';
import { SITE_NAME, SITE_URL, API_BASE_URL } from '@/lib/site';
import { MODELS, FLAGSHIP } from '@/lib/models';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

export function GET() {
  // llms() 输出相对路径，llmstxt.org 规范偏好绝对 URL（AI 抓到后要能直接访问）。
  const tree = llms(source).index().replace(/\]\(\/docs/g, `](${SITE_URL}/docs`);

  const flagships = Object.values(FLAGSHIP).join('、');
  const newModels = MODELS.filter((m) => m.isNew)
    .map((m) => m.id)
    .join('、');

  const body = [
    `# ${SITE_NAME}（灵眸 AI）`,
    '',
    '> 灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT 与国产大模型，网关部署在中国境内、国内直连免代理。本站是它的接入文档，覆盖 Claude Code、Codex CLI、Cursor、Trae、Chatbox 等主流 AI 工具的配置方法，以及生图 API 与用量导出 API。',
    '',
    `- API Base URL：${API_BASE_URL}`,
    `- 完整文档（含正文）：${SITE_URL}/llms-full.txt`,
    `- 模型广场：${SITE_URL}/docs/guide/models`,
    `- 各厂商当前旗舰模型：${flagships}`,
    `- 最新上线模型：${newModels}`,
    '',
    tree,
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
