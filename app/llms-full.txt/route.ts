import { source } from '@/lib/source';
import { SITE_NAME, SITE_URL, API_BASE_URL } from '@/lib/site';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// source.getPages() 是文件系统顺序（enterprise 会排在 docs 前），按导航顺序重排。
const SECTION_ORDER = ['/docs', '/docs/guide', '/docs/tools', '/docs/api'];

function sortKey(url: string): number {
  const i = SECTION_ORDER.findIndex((prefix) =>
    prefix === '/docs' ? url === '/docs' : url.startsWith(prefix + '/'),
  );
  return i === -1 ? SECTION_ORDER.length : i;
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

export async function GET() {
  const pages = source.getPages().sort((a, b) => {
    const d = sortKey(a.url) - sortKey(b.url);
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

  const body = [
    `# ${SITE_NAME}（灵眸 AI）完整文档`,
    '',
    `> 灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT 与国产大模型。API Base URL：${API_BASE_URL}`,
    '',
    ...sections,
  ].join('\n\n---\n\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
