import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  API_BASE_URL,
  SITE_KEYWORDS,
  SITE_URL,
  THEME_COLOR,
  applicationSubCategory,
  productDescription,
  productFeatures,
  productName,
  siteDescription,
  siteName,
} from '@/lib/site';
import { DIR, HTML_LANG, OG_LOCALE, i18n, localePrefix } from '@/lib/i18n';
import { GA_MEASUREMENT_ID } from '@/lib/variant';
import { provider } from '@/lib/i18n-ui';
import '../global.css';

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const name = siteName(lang);
  const description = siteDescription(lang);
  const prefix = localePrefix(lang);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: name,
      template: `%s | ${name}`,
    },
    description,
    keywords: SITE_KEYWORDS,
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    alternates: {
      // `/`(或 /en) 是通往文档首页的跳转，canonical 指向跳转终点。
      canonical: `${prefix}/docs`,
      // 语言路径由 localePrefix 派生（默认语言无前缀）；遍历所有语种，x-default 指默认
      // 语言（.com 中文 / .ai 英文）。index 在每个语种都存在（对照门禁保证），故列全语种。
      // 仅站内互指，不做跨域 alternates —— 两个域名按既定决策各自独立收录。
      languages: {
        ...Object.fromEntries(
          i18n.languages.map((l) => [HTML_LANG[l], `${localePrefix(l)}/docs`]),
        ),
        'x-default': `${localePrefix(i18n.defaultLanguage)}/docs`,
      },
      // llmstxt.org 规范的发现方式：/llms.txt + <link rel="alternate">。初期仅 cn/en 出
      // llms.txt，故只在这两种语言页广告该备用链，新语种不指向不存在的 /{lang}/llms.txt。
      ...(lang === 'cn' || lang === 'en'
        ? {
            types: {
              'text/plain': [
                { url: `${prefix}/llms.txt`, title: 'llms.txt' },
                { url: `${prefix}/llms-full.txt`, title: 'llms-full.txt' },
              ],
            },
          }
        : {}),
    },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[lang] ?? OG_LOCALE.cn,
      siteName: name,
      url: `${prefix}/docs`,
      title: name,
      description,
      // 显式声明 og:image。文件式 app/opengraph-image.tsx 只生成 /opengraph-image 路由
      // （真实 PNG），并不会自动把 og:image meta 注入 [lang] 页（app/ 根段下无页面承载该约定），
      // 实测裸 /docs 与各语种页都缺 og:image —— 故两处 metadata 都显式指这张全站唯一 OG 图
      // （非 per-lang；metadataBase 解析为绝对 URL）。
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      // twitter:image 同样须显式（文件式 opengraph-image 更不填 twitter:image*）。
      images: ['/opengraph-image'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  if (!(i18n.languages as readonly string[]).includes(lang)) notFound();

  const name = siteName(lang);
  const description = siteDescription(lang);
  const inLanguage = HTML_LANG[lang] ?? 'zh-CN';

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url: SITE_URL,
    inLanguage,
    publisher: {
      '@type': 'Organization',
      name,
      url: API_BASE_URL,
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: API_BASE_URL,
    sameAs: [SITE_URL, API_BASE_URL],
  };

  // 产品实体：让生成式引擎/搜索明确「灵眸 AI 是什么」。仅忠实描述（名称、类别、
  // 能力、提供方），不含价格/评分等需向用户核实且此处无法确证的字段。
  const softwareApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: productName(lang),
    // 别名 = 「另一种写法的品牌名」：主名是中文站『灵眸 AI』、其余语种『LMU AI』
    // （见 productName），故别名互补——cn 补英文品牌、非 cn 一律补中文品牌『灵眸 AI』+ 罗马音。
    alternateName: lang === 'cn' ? ['LMU AI', 'Lingmou AI'] : ['灵眸 AI', 'Lingmou AI'],
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: applicationSubCategory(lang),
    operatingSystem: 'Web',
    url: API_BASE_URL,
    description: productDescription(lang),
    inLanguage,
    featureList: productFeatures(lang),
    provider: {
      '@type': 'Organization',
      name: productName(lang),
      url: API_BASE_URL,
    },
  };

  return (
    <html lang={inLanguage} dir={DIR[lang] ?? 'ltr'} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <RootProvider i18n={provider(lang)}>{children}</RootProvider>
      </body>
    </html>
  );
}
