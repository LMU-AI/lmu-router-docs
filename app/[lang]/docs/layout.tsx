import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { COMMUNITY_URL, REGISTER_URL, siteName } from '@/lib/site';

// 顶栏「注册」CTA 文案按语种取（此处不走 Fumadocs 的 I18nProvider，自绘一份）。
// 品牌名统一用 LMU AI；未知语种回退英文（不再对非中文页漏中文）。
const REGISTER_CTA: Record<string, string> = {
  cn: '🚀 注册灵眸账号',
  en: '🚀 Sign up for LMU AI',
  ja: '🚀 LMU AI に登録',
  ko: '🚀 LMU AI 가입',
  es: '🚀 Regístrate en LMU AI',
  pt: '🚀 Cadastre-se na LMU AI',
  de: '🚀 Bei LMU AI registrieren',
  fr: "🚀 S'inscrire à LMU AI",
  ru: '🚀 Регистрация в LMU AI',
  ar: '🚀 التسجيل في LMU AI',
};

// 顶栏「社区」链接（community.lmuai.ai），只在国际站显示（COMMUNITY_URL 在 .com 为 null）。
// 不带 on：桌面端在顶栏右侧，移动端在菜单里；纯文字、不加 emoji，和注册 CTA 分出主次。
// 社区以中文为主，页尾的求助入口会标明这一点。
const COMMUNITY_NAV: Record<string, string> = {
  cn: '社区',
  en: 'Community',
  ja: 'コミュニティ',
  ko: '커뮤니티',
  es: 'Comunidad',
  pt: 'Comunidade',
  de: 'Community',
  fr: 'Communauté',
  ru: 'Сообщество',
  ar: 'المجتمع',
};

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  const registerText = REGISTER_CTA[lang] ?? REGISTER_CTA.en;

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      sidebar={{ defaultOpenLevel: 99 }}
      nav={{ title: siteName(lang), mode: 'auto' }}
      links={[
        ...(COMMUNITY_URL
          ? [
              {
                type: 'main' as const,
                text: COMMUNITY_NAV[lang] ?? COMMUNITY_NAV.en,
                url: COMMUNITY_URL,
                external: true,
              },
            ]
          : []),
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
