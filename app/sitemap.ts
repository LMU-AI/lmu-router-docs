import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/site';
import { lastModifiedOf } from '@/lib/last-modified';

export default function sitemap(): MetadataRoute.Sitemap {
  // 只提交 /docs 及其子页。`/` 是通往 /docs 的 308 跳转，提交跳转 URL 会被 Search Console
  // 告警，并把同一份内容的信号劈成两半。
  //
  // 站点为 cn（默认语言，URL 无前缀：/docs/...）+ en（/en/docs/...）双语。中文是 .com 的
  // 主语言（保护百度既有排名），所以：
  //   - 每个中文页都进 sitemap；
  //   - 若该页有英文版，则中、英文各自作为独立 <url> 条目提交，并互挂 hreflang alternates
  //     （zh-CN ↔ en，x-default 指向中文）。仅在两种语言都存在时才互挂，避免指向 404，
  //     与 app/[lang]/docs/[[...slug]]/page.tsx 的 hreflang 规则保持一致。
  //
  // 注意：getPages() 不带参数会返回所有语言的页面，务必按语言显式取。
  const cnPages = source.getPages('cn');
  const enByPath = new Map(
    // en 页面在 hideLocale:'default-locale' 下 url 带 /en 前缀；剥掉前缀后即与中文 url 对齐。
    // 万一某版本 en url 不带前缀，replace 是 no-op，键仍等于中文 url，匹配依旧成立。
    source.getPages('en').map((page) => [page.url.replace(/^\/en/, ''), page] as const),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const page of cnPages) {
    const cnPath = page.url; // /docs, /docs/guide/models, ...
    const enPage = enByPath.get(cnPath);
    const enPath = `/en${cnPath}`; // localePrefix('en') === '/en'

    const isDocsHome = cnPath === '/docs';
    const isModels = cnPath === '/docs/guide/models';
    const isGuide = cnPath.startsWith('/docs/guide');
    const isTools = cnPath.startsWith('/docs/tools');
    const isApi = cnPath.startsWith('/docs/api');

    const changeFrequency =
      isDocsHome || isModels ? ('weekly' as const) : ('monthly' as const);
    const priority = isDocsHome
      ? 1.0
      : isModels
        ? 0.95
        : isGuide
          ? 0.9
          : isTools
            ? 0.8
            : isApi
              ? 0.75
              : 0.6;

    // 仅当中英文都存在时互挂 hreflang；x-default 指向中文（.com 主语言）。
    const languages = enPage
      ? {
          'zh-CN': `${SITE_URL}${cnPath}`,
          en: `${SITE_URL}${enPath}`,
          'x-default': `${SITE_URL}${cnPath}`,
        }
      : undefined;

    entries.push({
      url: `${SITE_URL}${cnPath}`,
      lastModified: lastModifiedOf(page.absolutePath),
      changeFrequency,
      priority,
      ...(languages ? { alternates: { languages } } : {}),
    });

    if (enPage) {
      entries.push({
        url: `${SITE_URL}${enPath}`,
        lastModified: lastModifiedOf(enPage.absolutePath),
        changeFrequency,
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
