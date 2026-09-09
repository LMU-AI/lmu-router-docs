import { defineI18n } from 'fumadocs-core/i18n';
import { DEFAULT_LANGUAGE } from './variant';

// 多语言文档：默认语言按站点变体走（.com 中文在根 / .ai 英文在根），其余为附加语言，
// 一律带 /{lang} 前缀（如 /ja/docs、/es/docs），两站通用。计费面向全球后，文档也
// 面向全球：在中(cn)+英(en)之外扩到主流语言全支持。
//
// 关键设计（保住 .com 现有百度排名的 /docs/... URL；只新增语种、不改 cn/en 产物）：
// - parser: 'dot' → 裸 *.mdx 恒被标为 defaultLanguage，*.{lang}.mdx 标为对应语种。
//   .com 上裸文件就是中文，一个都不用改名；.ai 构建前由
//   scripts/materialize-variant-content.mjs 把内容树角色对调（英文变裸文件、中文变
//   *.cn.mdx，新语种 *.{lang}.mdx 原样透传），使 defaultLanguage='en' 成立。
// - hideLocale: 'default-locale' → 默认语言不带语言前缀，URL 仍是 /docs/...；非默认
//   语言带前缀。构建期由 fumadocs 把 [lang] 静态展开成 /cn、/en、/ja… 各自的路由子树
//   （已在 .next 预渲染清单逐条核对），非默认语种与既有 /en 同类、天然可路由。
// - fallbackLanguage: null → 未翻译的页面不回退，某语言侧只出现真正翻译过的页面，
//   避免导航里混进错误语言（用户明确担心的「割裂感」）与错误语言被索引。
//
// 增删语种：改这里的 languages + 下方 HTML_LANG / OG_LOCALE / DIR，并同步
// scripts/check-i18n-parity.mjs 的 EXTRA_LOCALES、next.config.mjs 的 Link 头 lang 正则。
export const i18n = defineI18n({
  defaultLanguage: DEFAULT_LANGUAGE,
  languages: ['cn', 'en', 'ja', 'ko', 'es', 'pt', 'de', 'fr', 'ru', 'ar'],
  hideLocale: 'default-locale',
  parser: 'dot',
  fallbackLanguage: null,
});

export type Locale = (typeof i18n.languages)[number];

// html lang / hreflang 用的 BCP-47 标签（pt→pt-BR 巴西葡语）；openGraph 用的 locale。
export const HTML_LANG: Record<string, string> = {
  cn: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', es: 'es',
  pt: 'pt-BR', de: 'de', fr: 'fr', ru: 'ru', ar: 'ar',
};
export const OG_LOCALE: Record<string, string> = {
  cn: 'zh_CN', en: 'en_US', ja: 'ja_JP', ko: 'ko_KR', es: 'es_ES',
  pt: 'pt_BR', de: 'de_DE', fr: 'fr_FR', ru: 'ru_RU', ar: 'ar_AR',
};
// 书写方向：阿拉伯语从右到左，其余从左到右。用于 <html dir>。
export const DIR: Record<string, string> = { ar: 'rtl' };

// 语言前缀：默认语言无前缀，其余带 /{lang}。用于拼 canonical / hreflang / sitemap。
export function localePrefix(locale: string): string {
  return locale === i18n.defaultLanguage ? '' : `/${locale}`;
}
