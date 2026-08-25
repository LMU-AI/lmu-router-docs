import { source } from '@/lib/source';
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import type { Metadata } from 'next';
import { CtaFooter } from '@/components/cta-footer';
import { ModelCard, ModelGrid } from '@/components/model-card';
import { Mermaid } from '@/components/mermaid';
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb';
import { SITE_URL, siteName } from '@/lib/site';
import { HTML_LANG, OG_LOCALE, localePrefix } from '@/lib/i18n';
import { PLAZA_MODELS } from '@/lib/models';
import { lastModifiedOf } from '@/lib/last-modified';
import { LastUpdated } from '@/components/last-updated';

// 语言前缀感知的文档路径：cn → /docs/...；en → /en/docs/...
function docsPath(lang: string, slug?: string[]): string {
  const prefix = localePrefix(lang);
  return slug && slug.length > 0 ? `${prefix}/docs/${slug.join('/')}` : `${prefix}/docs`;
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;
  const canonicalPath = docsPath(lang, slug);
  const absoluteUrl = `${SITE_URL}${canonicalPath}`;
  const inLanguage = HTML_LANG[lang] ?? 'zh-CN';

  // includeRoot 只在 path 中出现 root folder 节点时生效，而 pageTree 本身
  // 就是 root、不在 path 里，所以首层必须自己补。
  const crumbs = [
    { name: siteName(lang), url: `${SITE_URL}${localePrefix(lang)}/docs` },
    ...getBreadcrumbItems(page.url, source.getPageTree(lang), {
      includePage: true,
      includeSeparator: false,
    }),
  ];

  // guide / tools / api 三个目录没有 index 页（实测 404），getBreadcrumbItems 给这层
  // 的 url 是 undefined。Google 明确要求「除最后一项外，item 为必填」，中间层缺 item
  // 会让整条面包屑失去富媒体资格。既然这层没有可指向的落地页，就整层去掉，产出一条
  // 合法的两级面包屑，而不是一条 Google 会丢弃的三级面包屑。
  const linkableCrumbs = crumbs.filter((crumb, i) => crumb.url || i === crumbs.length - 1);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: linkableCrumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: typeof crumb.name === 'string' ? crumb.name : siteName(lang),
      ...(crumb.url
        ? { item: crumb.url.startsWith('http') ? crumb.url : `${SITE_URL}${crumb.url}` }
        : {}),
    })),
  };

  const keywords = page.data.keywords ?? [];
  const alternateNames = page.data.alternateNames ?? [];
  const faq = page.data.faq ?? [];

  const lastModifiedDate = lastModifiedOf(page.absolutePath);
  const lastModified = lastModifiedDate.toISOString();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.data.title,
    description: page.data.description,
    inLanguage,
    mainEntityOfPage: absoluteUrl,
    datePublished: lastModified,
    dateModified: lastModified,
    image: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/opengraph-image`,
      width: 1200,
      height: 630,
    },
    author: { '@type': 'Organization', name: siteName(lang), url: SITE_URL },
    publisher: { '@type': 'Organization', name: siteName(lang), url: SITE_URL },
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
    ...(alternateNames.length > 0 ? { alternateName: alternateNames } : {}),
  };

  const faqJsonLd =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }
      : null;

  const isModels = (slug?.join('/') ?? '') === 'guide/models';
  const itemListJsonLd = isModels
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: lang === 'en' ? 'LMU AI available models' : '灵眸 AI 可用模型清单',
        numberOfItems: PLAZA_MODELS.length,
        itemListElement: PLAZA_MODELS.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: m.id,
          description: `${m.label}（${m.vendor}）`,
        })),
      }
    : null;

  return (
    <>
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              Tabs,
              Tab,
              Callout,
              ModelCard,
              ModelGrid,
              Mermaid,
            }}
          />
          <LastUpdated date={lastModifiedDate} locale={lang} />
          <CtaFooter locale={lang} />
        </DocsBody>
      </DocsPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
    </>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const canonicalPath = docsPath(lang, slug);
  const ogDescription = page.data.ogDescription ?? page.data.description;

  // hreflang：只在两种语言都真实存在该页面时互指，避免指向 404。
  const cnExists = !!source.getPage(slug, 'cn');
  const enExists = !!source.getPage(slug, 'en');
  const cnPath = docsPath('cn', slug);
  const enPath = docsPath('en', slug);
  const languages =
    cnExists && enExists
      ? { 'zh-CN': cnPath, en: enPath, 'x-default': cnPath }
      : undefined;

  return {
    title: page.data.title,
    description: page.data.description,
    keywords: page.data.keywords,
    alternates: {
      canonical: canonicalPath,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      type: 'article',
      locale: OG_LOCALE[lang] ?? OG_LOCALE.cn,
      siteName: siteName(lang),
      url: canonicalPath,
      title: page.data.title,
      description: ogDescription,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: ogDescription,
    },
  };
}
