import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// 训练 / 检索类 AI 爬虫，全部显式 allow。本站是商业中转服务的公开文档，
// 商业目标就是让人和 AI 都知道灵眸能接入哪些工具，无付费墙也无 UGC。
// 注意 ChatGPT-User / Claude-User / Perplexity-User 是用户实时访问而非训练
// 爬虫，屏蔽它们等于用户在 AI 里贴本站链接时读不到内容。
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

// 抓取频率激进但语料价值仍在（Bytespider 对应豆包 / Kimi 的中文语料），
// 因此 allow 但限速。
const THROTTLED_CRAWLERS = ['CCBot', 'Bytespider', 'Amazonbot', 'Diffbot', 'Omgili'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, allow: '/' },
      { userAgent: THROTTLED_CRAWLERS, allow: '/', crawlDelay: 10 },
      { userAgent: '*', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
