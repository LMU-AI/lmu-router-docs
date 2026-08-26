import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { REGISTER_URL, siteName } from '@/lib/site';

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  const registerText = lang === 'en' ? '🚀 Sign up for LMU AI' : '🚀 注册灵眸账号';

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      sidebar={{ defaultOpenLevel: 99 }}
      nav={{ title: siteName(lang), mode: 'top' }}
      links={[
        {
          type: 'main',
          text: registerText,
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
