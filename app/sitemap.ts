import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages = source.getPages().map((page) => {
    const path = page.url;
    const isGuide = path.startsWith('/docs/guide');
    const isTools = path.startsWith('/docs/tools');
    const isDocsHome = path === '/docs';

    return {
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: isDocsHome ? 1.0 : isGuide ? 0.9 : isTools ? 0.8 : 0.7,
    };
  });

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...pages,
  ];
}
