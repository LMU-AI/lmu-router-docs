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
  };
}
