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
  productDescription,
  productFeatures,
  productName,
  siteDescription,
  siteName,
} from '@/lib/site';
import { HTML_LANG, OG_LOCALE, i18n, localePrefix } from '@/lib/i18n';
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
      languages: {
        'zh-CN': '/docs',
        en: '/en/docs',
        'x-default': '/docs',
      },
      // llmstxt.org 规范的发现方式：/llms.txt + <link rel="alternate">。
      // 按语言指向：cn→/llms.txt，en→/en/llms.txt，让各语言页各自发现对应文件。
      types: {
        'text/plain': [
          { url: `${prefix}/llms.txt`, title: 'llms.txt' },
          { url: `${prefix}/llms-full.txt`, title: 'llms-full.txt' },
        ],
      },
    },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[lang] ?? OG_LOCALE.cn,
      siteName: name,
      url: `${prefix}/docs`,
      title: name,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
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
    alternateName: lang === 'en' ? ['灵眸 AI', 'Lingmou AI'] : ['LMU AI', 'Lingmou AI'],
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory:
      lang === 'en' ? 'Large-model API relay' : '大模型 API 中转服务',
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
    <html lang={inLanguage} suppressHydrationWarning>
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
          src="https://www.googletagmanager.com/gtag/js?id=G-3YQJ477Z5W"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3YQJ477Z5W');
          `}
        </Script>
        <RootProvider i18n={provider(lang)}>{children}</RootProvider>
      </body>
    </html>
  );
}
