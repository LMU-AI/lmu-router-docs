import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/site';
import { lastModifiedOf } from '@/lib/last-modified';

export default function sitemap(): MetadataRoute.Sitemap {
  // 只提交 /docs 及其子页。`/` 是通往 /docs 的 308 跳转，提交跳转 URL 会被 Search Console
  // 告警，并把同一份内容的信号劈成两半。
  return source.getPages().map((page) => {
    const path = page.url;
    const isDocsHome = path === '/docs';
    const isModels = path === '/docs/guide/models';
    const isGuide = path.startsWith('/docs/guide');
    const isTools = path.startsWith('/docs/tools');
    const isApi = path.startsWith('/docs/api');

    return {
      url: `${SITE_URL}${path}`,
      lastModified: lastModifiedOf(page.absolutePath),
      changeFrequency: isDocsHome || isModels ? ('weekly' as const) : ('monthly' as const),
      priority: isDocsHome ? 1.0 : isModels ? 0.95 : isGuide ? 0.9 : isTools ? 0.8 : isApi ? 0.75 : 0.6,
    };
  });
}
