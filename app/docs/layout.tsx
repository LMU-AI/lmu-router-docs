import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { REGISTER_URL, SITE_NAME } from '@/lib/site';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      sidebar={{ defaultOpenLevel: 99 }}
      nav={{ title: SITE_NAME }}
      links={[
        {
          type: 'main',
          text: '🚀 注册灵眸账号',
          url: REGISTER_URL,
          external: true,
          on: 'menu',
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
