import type { MetadataRoute } from 'next';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  THEME_COLOR,
} from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/docs',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: THEME_COLOR,
    lang: 'zh-CN',
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
