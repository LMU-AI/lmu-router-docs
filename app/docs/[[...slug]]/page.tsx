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
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { PLAZA_MODELS } from '@/lib/models';
import { lastModifiedOf } from '@/lib/last-modified';

function buildCanonicalPath(slug?: string[]): string {
  return slug && slug.length > 0 ? `/docs/${slug.join('/')}` : '/docs';
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const canonicalPath = buildCanonicalPath(slug);
  const absoluteUrl = `${SITE_URL}${canonicalPath}`;

  // includeRoot 只在 path 中出现 root folder 节点时生效，而 source.pageTree 本身
  // 就是 root、不在 path 里，所以首层必须自己补。
  const crumbs = [
    { name: SITE_NAME, url: `${SITE_URL}/docs` },
    ...getBreadcrumbItems(page.url, source.pageTree, {
      includePage: true,
      includeSeparator: false,
    }),
  ];

  // guide / tools / api 三个目录没有 index 页（实测 404），getBreadcrumbItems 给这层
  // 的 url 是 undefined。此前的做法是保留该层但省略 item —— schema.org 允许，但
  // Google 明确要求「除最后一项外，item 为必填」，中间层缺 item 会让整条面包屑
  // 失去富媒体资格（生产实测 31/35 页中招）。既然这层没有可指向的落地页，就整层
  // 去掉，产出一条合法的两级面包屑，而不是一条 Google 会丢弃的三级面包屑。
  const linkableCrumbs = crumbs.filter((crumb, i) => crumb.url || i === crumbs.length - 1);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: linkableCrumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: typeof crumb.name === 'string' ? crumb.name : SITE_NAME,
      ...(crumb.url
        ? { item: crumb.url.startsWith('http') ? crumb.url : `${SITE_URL}${crumb.url}` }
        : {}),
    })),
  };

  const keywords = page.data.keywords ?? [];
  const alternateNames = page.data.alternateNames ?? [];
  const faq = page.data.faq ?? [];

  const lastModified = lastModifiedOf(page.absolutePath).toISOString();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.data.title,
    description: page.data.description,
    inLanguage: 'zh-CN',
    mainEntityOfPage: absoluteUrl,
    datePublished: lastModified,
    dateModified: lastModified,
    image: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/opengraph-image`,
      width: 1200,
      height: 630,
    },
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
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

  const itemListJsonLd =
    page.url === '/docs/guide/models'
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: '灵眸 AI 可用模型清单',
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
          <CtaFooter />
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
  return [{ slug: [] }, ...source.generateParams()];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const canonicalPath = buildCanonicalPath(slug);
  const ogDescription = page.data.ogDescription ?? page.data.description;

  return {
    title: page.data.title,
    description: page.data.description,
    keywords: page.data.keywords,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      locale: 'zh_CN',
      siteName: SITE_NAME,
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
