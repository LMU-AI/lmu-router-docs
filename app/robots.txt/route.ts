import { SITE_URL } from '@/lib/site';

// robots.txt 手写路由（取代 Next 的 MetadataRoute.Robots）。
//
// 为什么不用 app/robots.ts：Next 的 robots 元数据 API 无法输出 `Content-Signal:` 行。
// Content Signals（contentsignals.org，Cloudflare 主导）是 robots.txt 的扩展，声明
// 内容的用途偏好——search（传统搜索）/ ai-input（AI 检索时引用）/ ai-train（训练）。
//
// 本站是商业中转服务的公开文档，商业目标就是被人和 AI 都发现、理解、引用，因此三项
// 一律 yes（允许训练）。这与 CDN「托管 robots / Content Signals」注入的 `ai-train=no`
// + 对 AI 爬虫 `Disallow: /`（GEO 杀手，见 geo-optimization skill §6）恰好相反——
// 我们主动写肯定授权，且每个 UA 组都带上，确保命中特定分组的爬虫也读得到。
//
// 放行清单与原 app/robots.ts 逐字一致（prodcheck 逐 UA 断言依赖这份清单），仅新增
// Content-Signal 行，不引入任何 Disallow。

// 训练 / 检索类 AI 爬虫，全部显式 allow。ChatGPT-User / Claude-User / Perplexity-User
// 是用户实时访问而非训练爬虫，屏蔽它们等于用户在 AI 里贴本站链接时读不到内容。
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'cohere-ai',
  'Meta-ExternalAgent',
];

// 抓取频率激进但语料价值仍在（Bytespider 对应豆包 / Kimi 的中文语料），allow 但限速。
const THROTTLED_CRAWLERS = ['CCBot', 'Bytespider', 'Amazonbot', 'Diffbot', 'Omgili'];

// 内容用途偏好：搜索、AI 检索引用、AI 训练全部允许。
const CONTENT_SIGNAL = 'Content-Signal: search=yes, ai-input=yes, ai-train=yes';

function buildRobots(): string {
  const lines: string[] = [];

  // 明确放行的 AI 检索/训练爬虫（含肯定的内容用途授权）
  for (const ua of AI_CRAWLERS) lines.push(`User-agent: ${ua}`);
  lines.push(CONTENT_SIGNAL);
  lines.push('Allow: /');
  lines.push('');

  // 放行但限速的通用抓取器
  for (const ua of THROTTLED_CRAWLERS) lines.push(`User-agent: ${ua}`);
  lines.push(CONTENT_SIGNAL);
  lines.push('Allow: /');
  lines.push('Crawl-delay: 10');
  lines.push('');

  // 其余所有 UA
  lines.push('User-agent: *');
  lines.push(CONTENT_SIGNAL);
  lines.push('Allow: /');
  lines.push('');

  lines.push(`Host: ${SITE_URL}`);
  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);

  return lines.join('\n') + '\n';
}

// content/ 无关，纯静态；构建期定死。
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildRobots(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
