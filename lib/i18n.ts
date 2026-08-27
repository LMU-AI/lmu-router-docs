import { defineI18n } from 'fumadocs-core/i18n';
import { DEFAULT_LANGUAGE } from './variant';

// 双语文档：默认语言按站点变体走（.com 中文 / .ai 英文），另一种为附加语言。
//
// 关键设计（保住 .com 现有百度排名的 /docs/... URL）：
// - parser: 'dot' → 裸 *.mdx 恒被标为 defaultLanguage。.com 上裸文件就是中文，
//   一个都不用改名；.ai 构建前由 scripts/materialize-variant-content.mjs 把内容树
//   角色对调（英文变裸文件、中文变 *.cn.mdx），使 defaultLanguage='en' 成立。
// - hideLocale: 'default-locale' → 默认语言不带语言前缀，URL 仍是 /docs/...（中间件
//   用 NextResponse.rewrite 内部改写到 /{default}/...，浏览器地址栏与 canonical 不变）；
//   非默认语言带前缀。已在 fumadocs-core/dist/i18n/middleware.js 逐分支核对。
// - fallbackLanguage: null → 未翻译的页面不回退，另一语言侧只出现真正翻译过的
//   页面，避免导航里混进错误语言（用户明确担心的「割裂感」）与错误语言被索引。
export const i18n = defineI18n({
  defaultLanguage: DEFAULT_LANGUAGE,
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
