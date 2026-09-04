import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { i18n } from '@/lib/i18n';

// i18n 路由中间件（Next 16 把 middleware 改名为 proxy.ts）。
//
// 目标：默认语言（.com 为 cn）不带前缀，/docs/... 这批百度已收录的 URL 逐字不变；
// 非默认语言（en）带 /en/... 前缀。整套逻辑只依赖 i18n.defaultLanguage，
// 将来 .ai 把默认语言翻成 'en' 时无需改这里。
//
// 为什么不用 fumadocs 自带的 createI18nMiddleware（hideLocale: 'default-locale'）？
// 它对默认语言前缀会发一个 strip 跳转（/cn/... → /docs/...）。在 `output: standalone`
// 的生产产物里，内部 rewrite 的目标 /cn/... 会再次经过本中间件，于是 strip 跳转把
// /docs/... 又打回来，形成 307 死循环（dev 模式看不出来，standalone 才暴露）。
// 已本地用 standalone server 实测复现。
//
// 因此这里对「已带语言前缀」的路径一律直接放行、绝不 strip：
//   - 内部 rewrite 目标 /cn/... 命中放行分支 → 稳定 200，不再回跳；
//   - 默认语言带前缀的 URL（/cn/docs/...）由页面 canonical(/docs/...) 去重，
//     且站点自身从不产出 /cn/... 链接（sitemap、内链、hreflang 全用 /docs 与 /en/docs），
//     故不会被抓取收录；裸 /cn 由 app/[lang]/page.tsx 的 permanentRedirect 收敛到 /docs。
const DEFAULT_LOCALE = i18n.defaultLanguage;
const LOCALES = i18n.languages as readonly string[];

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const seg = pathname.split('/')[1] ?? '';
  const hasLocale = LOCALES.includes(seg);

  // Markdown for Agents：Accept: text/markdown 的 docs 页请求，内部改写到 /md 静态树
  // （app/md/[lang]/docs/[[...slug]]，每页 processed markdown）。同一地址栏 URL 既出
  // HTML（浏览器）也出 markdown（agent）。判据只认精确的 text/markdown——浏览器默认
  // Accept 是 text/html,...，永不含它，故 HTML 主流程一字不动。
  //
  // /md/* 已在下方 matcher 排除，改写目标不会再次进入本函数，无 307 回环风险。
  // 缓存正确性：HTML 侧靠 CF 对 docs HTML 恒为 cf-cache-status: DYNAMIC（边缘不缓存）
  // 保证不被跨投；markdown 响应自身带 Vary: Accept（见 lib/llms.ts markdownResponse）。
  if ((request.headers.get('accept') ?? '').includes('text/markdown')) {
    const lang = hasLocale ? seg : DEFAULT_LOCALE;
    const docsBase = hasLocale ? `/${seg}/docs` : '/docs';
    if (pathname === docsBase || pathname.startsWith(`${docsBase}/`)) {
      const rest = pathname.slice(docsBase.length); // '' 或 '/guide/models'
      const url = request.nextUrl.clone();
      url.pathname = `/md/${lang}/docs${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  // 已带语言前缀（/cn/... 或 /en/...）：交给 [lang] 路由渲染，不做任何跳转。
  if (hasLocale) {
    return NextResponse.next();
  }

  // 无前缀路径（/、/docs/...）：内部 rewrite 到默认语言，地址栏与 canonical 保持不变。
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // 只对需要 i18n 的页面路径运行。排除：
  // - api / _next（接口与构建产物）
  // - md（Markdown for Agents 静态树 /md/[lang]/docs/...）——它已是终点，既是 Accept
  //   协商的 rewrite 目标、也是被直接抓取的地址，若不排除会被再套一层默认语言前缀而错乱。
  // - opengraph-image（无扩展名的元数据路由，必须显式排除）
  // - 任何带「.」的路径：sitemap.xml / robots.txt / llms.txt / llms-full.txt /
  //   manifest.webmanifest / icon.svg / apple-icon.png / favicon.ico / public 静态资源
  //   —— 若不排除，/sitemap.xml 会被改写成 /cn/sitemap.xml 而 404。
  matcher: ['/((?!api|_next|md|opengraph-image|.*\\..*).*)'],
};
