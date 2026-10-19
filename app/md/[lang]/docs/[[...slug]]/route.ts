import { source } from '@/lib/source';
import { buildPageMarkdown, markdownResponse } from '@/lib/llms';
import { docsPath } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';

// Markdown for Agents —— 每页的纯 markdown。
//
// URL：/md/{lang}/docs/{slug}，lang 显式在路径里，cn / en 两语言用同一套 slug，
// 与 /docs 页共享 source.generateParams()。两条到达路径：
//   1. proxy.ts 对 Accept: text/markdown 的 /docs 请求内部改写到这里（同一地址栏 URL）；
//   2. 每页 HTML 头部 <link rel="alternate" type="text/markdown"> 直接指向本路径。
//
// content/ 不进入 standalone 运行时产物（与 llms.txt 同理），必须构建期预渲染：
// force-static + generateStaticParams。dynamicParams:false —— 未预渲染的 slug 直接 404，
// 不在运行时尝试读取不存在的 content/（与对应 HTML 页的 404 行为一致）。
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string; slug?: string[] }> },
) {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) return new Response('Not found', { status: 404 });
  // Markdown 版本不是独立页面（#60）：声明同语言 HTML 页才是正式版本，
  // 免得 Bing 把 /md 和 HTML 页当成两份内容抢收录。不用 noindex —— 那会连
  // AI 搜索一起挡掉，而这份 Markdown 本来就是给 AI 读的。
  const canonical = `${SITE_URL}${docsPath(lang, slug)}`;
  return markdownResponse(await buildPageMarkdown(page), {
    Link: `<${canonical}>; rel="canonical"`,
  });
}
