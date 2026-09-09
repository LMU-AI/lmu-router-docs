import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/site';
import { HTML_LANG, i18n, localePrefix } from '@/lib/i18n';
import { lastModifiedOf } from '@/lib/last-modified';

export default function sitemap(): MetadataRoute.Sitemap {
  // 只提交 /docs 及其子页。`/` 是通往 /docs 的 308 跳转，提交跳转 URL 会被 Search Console
  // 告警，并把同一份内容的信号劈成两半。
  //
  // 站点多语言：默认语言 URL 无前缀（/docs/...），其余语种带前缀（如 /en/docs、/ja/docs）。
  // 默认语言随变体走（.com 中文，保护百度既有排名；.ai 英文，海外受众），且内容最全
  // （cn/en 人工维护，新语种由 en 派生，恒是子集），故以默认语言的页面集合为基准：
  //   - 对每个默认语言页，找出所有「真实存在该页」的语种，各自作为独立 <url> 提交；
  //   - 互挂 hreflang alternates（每个存在的语种一条 + x-default 指默认语言）。
  //     fallbackLanguage:null 下某语种缺页就不在 getPages 里，天然不会指向 404，与
  //     app/[lang]/docs/[[...slug]]/page.tsx 的 hreflang 规则一致。
  //     仅站内互指，不做跨域 alternates —— 两个域名按既定决策各自独立收录。
  //
  // 注意：getPages() 不带参数会返回所有语言的页面，务必按语言显式取。
  const primaryLang = i18n.defaultLanguage;

  // 每个语种：把「剥掉语言前缀后的路径」→ page 建索引，用于按路径对齐各语种版本。
  // 非默认语言页在 hideLocale:'default-locale' 下 url 带语言前缀；剥前缀后即与默认语言
  // 对齐。默认语言前缀为空、replace 为 no-op，键仍是 /docs...，对齐依旧成立。
  const pagesByLang = new Map(
    i18n.languages.map((lang) => {
      const prefix = localePrefix(lang);
      return [
        lang,
        new Map(
          source
            .getPages(lang)
            .map((page) => [page.url.replace(new RegExp(`^${prefix}`), ''), page] as const),
        ),
      ] as const;
    }),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const [primaryPath] of pagesByLang.get(primaryLang)!) {
    // primaryPath 已是剥前缀路径：/docs, /docs/guide/models, ...
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

    // 该页真实存在的所有语种（默认语言恒在，因为正在遍历它），按 i18n.languages 顺序。
    const present = i18n.languages.filter((lang) => pagesByLang.get(lang)!.has(primaryPath));

    // hreflang：每个存在的语种一条（BCP-47 标签 → 带前缀 URL）+ x-default 指默认语言。
    // 单语种页不互挂（避免自指冗余）。hreflang key 与页面 <link hreflang> 一致。
    const languages =
      present.length > 1
        ? {
            ...Object.fromEntries(
              present.map((lang) => [
                HTML_LANG[lang],
                `${SITE_URL}${localePrefix(lang)}${primaryPath}`,
              ]),
            ),
            'x-default': `${SITE_URL}${primaryPath}`,
          }
        : undefined;

    for (const lang of present) {
      const page = pagesByLang.get(lang)!.get(primaryPath)!;
      entries.push({
        url: `${SITE_URL}${localePrefix(lang)}${primaryPath}`,
        lastModified: lastModifiedOf(page.absolutePath),
        changeFrequency,
        priority,
        ...(languages ? { alternates: { languages } } : {}),
      });
    }
  }

  return entries;
}
