import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { i18n } from '@/lib/i18n';
import { matchLocale, isBot } from '@/lib/locale-match';

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
//
// 语言自动协商（无前缀路径）：按访客 Accept-Language 选最佳语种，SEO 安全——
//   - 爬虫豁免：搜索/AI 爬虫始终看到规范默认语言页（不跳），靠 hreflang+sitemap 收录
//     全部语种，无 cloaking、保住百度收录；
//   - 命中非默认语种 → 307 跳到带前缀等价路径，并写 NEXT_LOCALE 记住选择（sticky，只在
//     首访/无 cookie 时协商，之后以用户选择为准，可经语言切换器覆盖）；
//   - 命中默认语种 / 无 Accept-Language（curl、Node fetch、prodcheck、部署自检）→ 不跳，
//     渲染规范无前缀页；两条出口都带 Vary: Accept-Language, Cookie 供缓存正确分桶。
const DEFAULT_LOCALE = i18n.defaultLanguage;
const LOCALES = i18n.languages as readonly string[];

// NEXT_LOCALE：记住访客的语言选择（协商命中或显式切换/直达带前缀页），使自动跳转只在
// 首访发生、后续以用户选择为准。SameSite=Lax、一年有效；非 httpOnly（无敏感信息，便于
// 将来前端读当前语种）；Secure 依据 x-forwarded-proto（生产经 Caddy/CF 恒为 https，
// 本地 http 直连时不置 Secure 以便测试）。
const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setLocaleCookie(request: NextRequest, res: NextResponse, locale: string): NextResponse {
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: proto === 'https',
  });
  return res;
}

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const seg = pathname.split('/')[1] ?? '';
  const hasLocale = LOCALES.includes(seg);

  // (1) Markdown for Agents：Accept: text/markdown 的 docs 页请求，内部改写到 /md 静态树
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

  // (2) 已带语言前缀（/cn/... /en/... /ja/... 或内部 rewrite 的再入目标）：交给 [lang]
  // 路由渲染、绝不 strip（见文件头 307 死循环说明）。同时把该显式语种写进 NEXT_LOCALE——
  // 用户点语言切换器（fumadocs router.push 到 /{lang}/docs）或直接访问带前缀 URL，都算
  // 显式选择，据此记住并抑制后续无前缀路径的自动跳转。
  if (hasLocale) {
    return setLocaleCookie(request, NextResponse.next(), seg);
  }

  // (3) 无前缀路径（/、/docs、/docs/...）：内部 rewrite 到默认语言，地址栏与 canonical 不变。
  const rewriteToDefault = (): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('Vary', 'Accept-Language, Cookie');
    return res;
  };

  // 爬虫豁免：搜索/AI 爬虫一律看规范默认语言页（不跳），靠 hreflang+sitemap 收录全部语种。
  if (isBot(request.headers.get('user-agent'))) return rewriteToDefault();

  // 目标语种：已记住的选择优先（sticky）；否则按 Accept-Language 最佳匹配（无则落默认）。
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const target =
    cookie && LOCALES.includes(cookie)
      ? cookie
      : matchLocale(request.headers.get('accept-language'), LOCALES, DEFAULT_LOCALE);

  // 命中默认语种 → 不跳，渲染规范无前缀页（canonical 恒为 /docs，百度收录不受影响）。
  if (target === DEFAULT_LOCALE) return rewriteToDefault();

  // 命中非默认语种 → 307 跳到带前缀等价路径并记住选择。根路径直接跳 /{lang}/docs，
  // 省去 /{lang} → /{lang}/docs 的二次跳转。
  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${target}/docs` : `/${target}${pathname}`;
  const res = NextResponse.redirect(url, 307);
  res.headers.set('Vary', 'Accept-Language, Cookie');
  return setLocaleCookie(request, res, target);
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
