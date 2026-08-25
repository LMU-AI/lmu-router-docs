import { defineI18n } from 'fumadocs-core/i18n';

// 双语文档：中文为默认语言，英文为附加语言。
//
// 关键设计（保住现有百度排名的 /docs/... URL）：
// - defaultLanguage: 'cn' + parser: 'dot' → 现有未加后缀的 .mdx 就是中文内容，
//   一个都不用改名；英文只需新增 .en.mdx。
// - hideLocale: 'default-locale' → 中文不带语言前缀，URL 仍是 /docs/...（中间件
//   用 NextResponse.rewrite 内部改写到 /cn/...，浏览器地址栏与 canonical 不变）；
//   英文带前缀 /en/docs/...。已在 fumadocs-core/dist/i18n/middleware.js 逐分支核对。
// - fallbackLanguage: null → 未翻译的页面不回退中文，英文侧只出现真正翻译过的
//   页面，避免英文导航里混进中文内容（用户明确担心的「割裂感」）与错误语言被索引。
export const i18n = defineI18n({
  defaultLanguage: 'cn',
  languages: ['cn', 'en'],
  hideLocale: 'default-locale',
  parser: 'dot',
  fallbackLanguage: null,
});

export type Locale = (typeof i18n.languages)[number];

// html lang / hreflang 用的 BCP-47 标签；openGraph 用的 locale。
export const HTML_LANG: Record<string, string> = { cn: 'zh-CN', en: 'en' };
export const OG_LOCALE: Record<string, string> = { cn: 'zh_CN', en: 'en_US' };

// 语言前缀：默认语言（cn）无前缀，其余带 /{lang}。用于拼 canonical / hreflang / sitemap。
export function localePrefix(locale: string): string {
  return locale === i18n.defaultLanguage ? '' : `/${locale}`;
}
