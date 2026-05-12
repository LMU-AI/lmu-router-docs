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
import { SITE_NAME, SITE_URL } from '@/lib/site';

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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: SITE_NAME,
        item: `${SITE_URL}/docs`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: page.data.title,
        item: absoluteUrl,
      },
    ],
  };

  const keywords = page.data.keywords ?? [];
  const alternateNames = page.data.alternateNames ?? [];
  const faq = page.data.faq ?? [];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.data.title,
    description: page.data.description,
    inLanguage: 'zh-CN',
    mainEntityOfPage: absoluteUrl,
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
