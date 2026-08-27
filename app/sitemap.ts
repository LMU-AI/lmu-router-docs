import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/site';
import { HTML_LANG, i18n, localePrefix } from '@/lib/i18n';
import { lastModifiedOf } from '@/lib/last-modified';

export default function sitemap(): MetadataRoute.Sitemap {
  // 只提交 /docs 及其子页。`/` 是通往 /docs 的 308 跳转，提交跳转 URL 会被 Search Console
  // 告警，并把同一份内容的信号劈成两半。
  //
  // 站点为双语：默认语言 URL 无前缀（/docs/...），另一语言带前缀（如 /en/docs/...）。
  // 默认语言随变体走（.com 中文，保护百度既有排名；.ai 英文，海外受众），所以：
  //   - 每个默认语言页都进 sitemap；
  //   - 若该页有另一语言版本，则两版各自作为独立 <url> 条目提交，并互挂 hreflang
  //     alternates（zh-CN ↔ en，x-default 指向默认语言）。仅在两种语言都存在时才互挂，
  //     避免指向 404，与 app/[lang]/docs/[[...slug]]/page.tsx 的 hreflang 规则一致。
  //     仅站内互指，不做跨域 alternates —— 两个域名按既定决策各自独立收录。
  //
  // 注意：getPages() 不带参数会返回所有语言的页面，务必按语言显式取。
  const primaryLang = i18n.defaultLanguage;
  const otherLang = i18n.languages.find((l) => l !== primaryLang)!;
  const otherPrefix = localePrefix(otherLang); // 非默认语言恒有前缀，如 '/en' 或 '/cn'

  const primaryPages = source.getPages(primaryLang);
  const otherByPath = new Map(
    // 非默认语言页面在 hideLocale:'default-locale' 下 url 带语言前缀；剥掉前缀后即与
    // 默认语言 url 对齐。万一某版本 url 不带前缀，replace 是 no-op，键仍对齐，匹配依旧成立。
    source
      .getPages(otherLang)
      .map((page) => [page.url.replace(new RegExp(`^${otherPrefix}`), ''), page] as const),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const page of primaryPages) {
    const primaryPath = page.url; // /docs, /docs/guide/models, ...
    const otherPage = otherByPath.get(primaryPath);
    const otherPath = `${otherPrefix}${primaryPath}`;

    const isDocsHome = primaryPath === '/docs';
    const isModels = primaryPath === '/docs/guide/models';
    const isGuide = primaryPath.startsWith('/docs/guide');
    const isTools = primaryPath.startsWith('/docs/tools');
    const isApi = primaryPath.startsWith('/docs/api');

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

    // 仅当两种语言都存在时互挂 hreflang；x-default 指向默认语言。
    // hreflang key 用 BCP-47 标签（HTML_LANG），与页面 <link hreflang> 一致。
    const languages = otherPage
      ? {
          [HTML_LANG[primaryLang]]: `${SITE_URL}${primaryPath}`,
          [HTML_LANG[otherLang]]: `${SITE_URL}${otherPath}`,
          'x-default': `${SITE_URL}${primaryPath}`,
        }
      : undefined;

    entries.push({
      url: `${SITE_URL}${primaryPath}`,
      lastModified: lastModifiedOf(page.absolutePath),
      changeFrequency,
      priority,
      ...(languages ? { alternates: { languages } } : {}),
    });

    if (otherPage) {
      entries.push({
        url: `${SITE_URL}${otherPath}`,
        lastModified: lastModifiedOf(otherPage.absolutePath),
        changeFrequency,
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
