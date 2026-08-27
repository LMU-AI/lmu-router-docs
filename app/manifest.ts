import type { MetadataRoute } from 'next';
import {
  SITE_SHORT_NAME,
  SITE_SHORT_NAME_EN,
  THEME_COLOR,
  siteDescription,
  siteName,
} from '@/lib/site';
import { HTML_LANG, i18n } from '@/lib/i18n';

export default function manifest(): MetadataRoute.Manifest {
  // 名称/描述/语言随默认语言走（.com 中文 / .ai 英文）。
  const lang = i18n.defaultLanguage;
  return {
    name: siteName(lang),
    short_name: lang === 'en' ? SITE_SHORT_NAME_EN : SITE_SHORT_NAME,
    description: siteDescription(lang),
    start_url: '/docs',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: THEME_COLOR,
    lang: HTML_LANG[lang] ?? 'zh-CN',
    scope: '/',
    categories: ['developer', 'productivity', 'utilities'],
    // 192 / 512 两个尺寸是 PWA 可安装的硬性要求；maskable 供 Android 自适应图标裁切。
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
