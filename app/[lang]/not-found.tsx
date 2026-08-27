import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaFooter } from '@/components/cta-footer';
import { DEFAULT_LANGUAGE } from '@/lib/variant';

// Next 的 not-found 组件拿不到 [lang] 参数，按站点默认语言渲染（.com 中文 /
// .ai 英文）—— 每个变体是独立构建，这在构建期就定死了。
const EN = DEFAULT_LANGUAGE === 'en';

// 404 本身不该被索引，但站内链接仍应被跟随。
export const metadata: Metadata = {
  title: EN ? 'Page not found' : '页面不存在',
  robots: { index: false, follow: true },
};

// 裸路径 = 默认语言，两个变体上都指向存在的页面。
const LINKS = EN
  ? [
      { href: '/docs', title: 'Docs home', desc: 'Browse all docs by tool and scenario' },
      { href: '/docs/guide/getting-started', title: 'Getting started', desc: 'Sign up → subscribe → create an API key' },
      { href: '/docs/guide/models', title: 'Model plaza', desc: 'All available model IDs' },
      { href: '/docs/guide/faq', title: 'FAQ', desc: 'Troubleshooting and common questions' },
    ]
  : [
      { href: '/docs', title: '文档首页', desc: '按工具和场景浏览全部文档' },
      { href: '/docs/guide/getting-started', title: '快速开始', desc: '注册 → 订阅 → 创建 API 密钥' },
      { href: '/docs/guide/models', title: '模型广场', desc: '查看全部可用模型 ID' },
      { href: '/docs/guide/faq', title: '常见问题', desc: '报错排查与使用答疑' },
    ];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-fd-foreground">
        {EN ? 'Page not found' : '找不到这个页面'}
      </h1>
      <p className="mt-3 text-fd-muted-foreground">
        {EN
          ? 'The link may be outdated or the page has moved. Try one of these entries:'
          : '链接可能已经失效或被移动。可以从下面几个入口继续：'}
      </p>

      <ul className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block h-full rounded-xl border border-fd-border p-4 transition-colors hover:bg-fd-accent"
            >
              <span className="font-medium text-fd-foreground">{link.title}</span>
              <span className="mt-1 block text-sm text-fd-muted-foreground">
                {link.desc}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <CtaFooter locale={DEFAULT_LANGUAGE} />
    </main>
  );
}
