#!/usr/bin/env node
// 生产站点测试套件 —— docs.lmuai.com（com 变体）/ docs.lmuai.ai（ai 变体）
//
// 每条断言标注 since：该项从哪个版本起应当为真。
//   'live'  —— 当前生产版本就该通过；失败 = 真实线上缺陷
//   'next'  —— 本轮（v0.1.8）才引入；在旧版本上失败属预期，用于上线后回归
//
// 用法：node scripts/prodcheck.mjs [--base https://docs.lmuai.com] [--variant com|ai] [--json out.json]
//      npm run prodcheck
// --variant 省略时按 --base 的主机名推断（*.ai → ai，否则 com）。

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] ?? '').startsWith('http')
  ? args[args.indexOf('--base') + 1]
  : 'https://docs.lmuai.com';
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

// —— 站点变体参数（与 lib/variant.ts 同一套口径） ——
// com：默认语言中文在裸路径，英文带 /en 前缀，网关 api.lmuai.com。
// ai ：默认语言英文在裸路径，中文带 /cn 前缀，网关 api.lmuai.ai。
const VARIANT = args.includes('--variant')
  ? args[args.indexOf('--variant') + 1]
  : new URL(BASE).hostname.endsWith('.ai')
    ? 'ai'
    : 'com';
const IS_AI = VARIANT === 'ai';
const OTHER_PREFIX = IS_AI ? '/cn/' : '/en/'; // 非默认语言的路径前缀（带尾斜杠，供 startsWith）
const OTHER_SEG = IS_AI ? '/cn' : '/en'; // 同上（不带尾斜杠，供拼接）
const DEFAULT_LANG = IS_AI ? 'en' : 'cn'; // 默认语言码（裸路径对应），供 /md/{lang}/... 直链
const DEFAULT_HTML_LANG = IS_AI ? 'en' : 'zh-CN';
const OTHER_HTML_LANG = IS_AI ? 'zh-CN' : 'en';
const API_HOST = IS_AI ? 'api.lmuai.ai' : 'api.lmuai.com';
// 「最后更新」标记：默认语言在裸路径。
const DEFAULT_UPDATED_MARK = IS_AI ? 'Last updated' : '最后更新';
const OTHER_UPDATED_MARK = IS_AI ? '最后更新' : 'Last updated';
// 页面是否英文页（description 长度阈值等按此分流）。
const isEnPath = (p) => (IS_AI ? !p.startsWith('/cn/') : p.startsWith('/en/'));

const results = [];
let currentGroup = '';

const group = (name) => { currentGroup = name; };
const record = (since, name, ok, detail) =>
  results.push({ group: currentGroup, since, name, ok, detail: String(detail ?? '') });

const ok = (since, name, detail) => record(since, name, true, detail);
const fail = (since, name, detail) => record(since, name, false, detail);
const check = (since, name, cond, detail) => record(since, name, !!cond, detail);

// --- HTTP 帮助函数 ---------------------------------------------------------
const cache = new Map();

async function get(path, { ua, method = 'GET', redirect = 'manual', accept } = {}) {
  const key = `${method} ${path} ${ua ?? ''} ${redirect} ${accept ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const url = path.startsWith('http') ? path : BASE + path;
  const t0 = Date.now();
  let res, body = '', err = null;
  try {
    res = await fetch(url, {
      method,
      redirect,
      headers: {
        'accept-encoding': 'gzip, br',
        ...(accept ? { accept } : {}),
        ...(ua ? { 'user-agent': ua } : { 'user-agent': 'prodcheck/1.0' }),
      },
      signal: AbortSignal.timeout(30000),
    });
    if (method !== 'HEAD') body = await res.text();
  } catch (e) {
    err = e;
  }
  const out = {
    status: res?.status ?? 0,
    headers: res ? Object.fromEntries(res.headers) : {},
    body,
    ms: Date.now() - t0,
    err,
  };
  cache.set(key, out);
  return out;
}

// 极简 HTML 取值（生产 HTML 是 Next 输出，标签规整，正则足够且无依赖）
const meta = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${prop}"[^>]+content="([^"]*)"`, 'i');
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${prop}"`, 'i');
  return (html.match(re) ?? html.match(re2))?.[1] ?? null;
};
const canonical = (html) =>
  html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i)?.[1] ??
  html.match(/<link[^>]+href="([^"]*)"[^>]+rel="canonical"/i)?.[1] ?? null;
const title = (html) => html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
const jsonLd = (html) => {
  const out = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch { out.push({ __parseError: m[1].slice(0, 120) }); }
  }
  return out;
};
const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

// ===========================================================================
async function main() {
  console.log(`\n目标：${BASE}\n`);

  // --- 1. 路由可用性 -------------------------------------------------------
  group('1. 路由与可用性');

  const root = await get('/');
  check('live', '/ 返回 308 跳转到 /docs',
    root.status === 308 && root.headers.location?.endsWith('/docs'),
    `status=${root.status} location=${root.headers.location}`);

  const sitemapRes = await get('/sitemap.xml');
  check('live', '/sitemap.xml 200', sitemapRes.status === 200, `status=${sitemapRes.status}`);

  // sitemap 里的 loc 永远是线上绝对地址（SITE_URL 常量），即便这次跑的是本地容器。
  // 照着 loc 抓就会抓到线上去——本地验证会静默变成"又测了一遍生产"。
  // 所以统一把 loc 的 origin 换成 --base。指向生产时这是恒等变换。
  const toBase = (u) => {
    try { return new URL(new URL(u).pathname, BASE).href; } catch { return u; }
  };
  const locs = [...sitemapRes.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toBase(m[1]));
  const urlEntries = [...sitemapRes.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const b = m[1];
    return {
      loc: b.match(/<loc>([^<]+)/)?.[1],
      lastmod: b.match(/<lastmod>([^<]+)/)?.[1],
      priority: b.match(/<priority>([^<]+)/)?.[1],
      changefreq: b.match(/<changefreq>([^<]+)/)?.[1],
    };
  });

  // sitemap 里每一个 URL 都必须真的可达。
  // 注意区分两种不合格：4xx/5xx（死链，严重）与 3xx（跳转，Search Console 会告警但页面本身在）。
  const pageBodies = new Map();
  const dead = [], redirecting = [];
  for (const loc of locs) {
    const r = await get(loc);
    if (r.status === 200) pageBodies.set(loc, r.body);
    else if (r.status >= 300 && r.status < 400) redirecting.push(`${new URL(loc).pathname} → ${r.status} ${r.headers.location ?? ''}`);
    else dead.push(`${loc} → ${r.status}`);
  }
  // 后面多处按路径取页面。用 pathname 做 key，这样 --base 指向本地容器时同样能取到。
  const byPathAll = new Map([...pageBodies].map(([l, h]) => [new URL(l).pathname, h]));

  check('live', `sitemap 中 ${locs.length} 个 URL 无死链`, dead.length === 0,
    dead.join('; ') || `0 处 4xx/5xx`);
  check('next', 'sitemap 中无跳转 URL', redirecting.length === 0,
    redirecting.join('; ') || '0 处 3xx');

  group('2. 静态资源与图标');
  for (const [p, since] of [['/favicon.ico', 'next'], ['/icon.svg', 'next'],
    ['/apple-icon.png', 'next'], ['/manifest.webmanifest', 'live'], ['/opengraph-image', 'live']]) {
    const r = await get(p);
    check(since, `${p} 200`, r.status === 200, `status=${r.status}`);
  }

  const og = await get('/opengraph-image');
  check('live', 'OG 图是 PNG 且非空',
    og.status === 200 && /image\/png/.test(og.headers['content-type'] ?? '') && og.body.length > 5000,
    `type=${og.headers['content-type']} bytes≈${og.body.length}`);

  // --- 3. GEO / AI 爬虫 ----------------------------------------------------
  group('3. GEO / AI 爬虫');

  const robots = await get('/robots.txt');
  check('live', '/robots.txt 200', robots.status === 200, `status=${robots.status}`);
  for (const botUA of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot']) {
    check('live', `robots.txt 声明 ${botUA}`, robots.body.includes(botUA), '');
  }
  check('live', 'robots.txt 含 Sitemap 指向', /Sitemap:\s*https:\/\//.test(robots.body),
    robots.body.match(/Sitemap:.*/)?.[0] ?? '缺失');
  check('live', 'robots.txt 未整站 Disallow', !/^Disallow:\s*\/\s*$/m.test(robots.body), '');
  // Content Signals（v0.1.34 起）：主动声明肯定授权（允许训练），且绝不能出现 CDN
  // 「托管 robots」注入的 ai-train=no 段——那会把本站从 GEO 目标里悄悄除名。
  check('next', 'robots.txt 含 Content-Signal 且允许训练（ai-train=yes）',
    /Content-Signal:[^\n]*ai-train=yes/.test(robots.body),
    robots.body.match(/Content-Signal:.*/)?.[0] ?? '缺失');
  check('next', 'robots.txt 未被注入 ai-train=no / 托管 robots 段',
    !/ai-train=no/.test(robots.body) && !/Cloudflare Managed content/i.test(robots.body), '');

  const llms = await get('/llms.txt');
  check('live', '/llms.txt 200', llms.status === 200, `status=${llms.status}`);
  check('live', 'llms.txt 是 text/plain', /text\/plain/.test(llms.headers['content-type'] ?? ''),
    llms.headers['content-type']);
  check('live', 'llms.txt 用绝对 URL', !/\]\(\/docs/.test(llms.body),
    /\]\(\/docs/.test(llms.body) ? '仍含相对路径 ](/docs' : '全部绝对 URL');
  check('next', `llms.txt 含关键事实块（${IS_AI ? 'Key facts' : '关键事实'}）`,
    llms.body.includes(IS_AI ? 'Key facts' : '关键事实'), '');
  check('next', 'llms.txt 指向错误码速查页', llms.body.includes('/docs/guide/errors'), '');
  // com（中文主文件）：英文单词 payment 出现即意味着已下线的 payment 文档残留。
  // ai（英文主文件）：正文合法含 payment（如 referral 的 "first payment"），只断言
  // 不出现已下线的 payment 页路径。
  check('next', 'llms.txt 不再提及 payment 文档',
    IS_AI ? !llms.body.includes('/docs/guide/payment') : !llms.body.includes('payment'), '');
  // 网关端点必须与站点变体一致（.ai 的 llms 里出现 api.lmuai.com 即端点替换失效）。
  check('next', `llms.txt 端点为 ${API_HOST}`, llms.body.includes(API_HOST) &&
    (IS_AI ? !llms.body.includes('api.lmuai.com') : true),
    IS_AI && llms.body.includes('api.lmuai.com') ? '仍含 api.lmuai.com' : '');

  const llmsFull = await get('/llms-full.txt');
  check('live', '/llms-full.txt 200', llmsFull.status === 200, `status=${llmsFull.status}`);
  check('next', 'llms-full.txt 不含 payment 内容',
    !/Stripe|z-pay|APIv3/i.test(llmsFull.body),
    /Stripe/i.test(llmsFull.body) ? '仍含 Stripe/z-pay/APIv3 字样' : '干净');

  // 非默认语言的 LLM 发现面（v0.1.28 起）：com 上是 /en/*，ai 上是 /cn/*。
  const llmsOther = await get(`${OTHER_SEG}/llms.txt`);
  check('next', `${OTHER_SEG}/llms.txt 200`, llmsOther.status === 200, `status=${llmsOther.status}`);
  check('next', `${OTHER_SEG}/llms.txt 是 text/plain`, /text\/plain/.test(llmsOther.headers['content-type'] ?? ''),
    llmsOther.headers['content-type']);
  check('next', `${OTHER_SEG}/llms.txt 用绝对 URL`, !/\]\(\/(en\/|cn\/)?docs/.test(llmsOther.body),
    /\]\(\/(en\/|cn\/)?docs/.test(llmsOther.body) ? '仍含相对路径 ](/…/docs' : '全部绝对 URL');
  check('next', `${OTHER_SEG}/llms.txt 含关键事实块`,
    llmsOther.body.includes(IS_AI ? '关键事实' : 'Key facts'), '');
  check('next', `${OTHER_SEG}/llms.txt 指向对应语言错误码页`,
    llmsOther.body.includes(`${OTHER_SEG}/docs/guide/errors`), '');
  const llmsFullOther = await get(`${OTHER_SEG}/llms-full.txt`);
  check('next', `${OTHER_SEG}/llms-full.txt 200`, llmsFullOther.status === 200, `status=${llmsFullOther.status}`);

  // AI 爬虫拿到的必须和普通访客一致（不做 cloaking，也别被 WAF 拦）
  for (const ua of ['GPTBot/1.0', 'ClaudeBot/1.0', 'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
    const r = await get('/docs', { ua });
    check('live', `${ua.split('/')[0]} 抓 /docs 得 200`, r.status === 200, `status=${r.status}`);
  }
  const asGpt = await get('/llms.txt', { ua: 'GPTBot/1.0' });
  check('live', 'GPTBot 抓 /llms.txt 得 200', asGpt.status === 200, `status=${asGpt.status}`);

  // Markdown for Agents（v0.1.34 起）：Accept 协商 + /md 静态树 + HTML 头部发现面。
  // 取一个双站都存在的正文页做样本（models 页中英皆有）。
  const MD_SAMPLE = '/docs/guide/models';
  const mdNeg = await get(MD_SAMPLE, { accept: 'text/markdown' });
  check('next', 'Accept: text/markdown 协商返回 markdown',
    mdNeg.status === 200 && /text\/markdown/.test(mdNeg.headers['content-type'] ?? ''),
    `status=${mdNeg.status} type=${mdNeg.headers['content-type']}`);
  check('next', 'markdown 协商响应是正文而非 HTML',
    /^#\s/m.test(mdNeg.body) && !/<html/i.test(mdNeg.body), '');
  const mdDirect = await get(`/md/${DEFAULT_LANG}/docs/guide/models`);
  check('next', `/md/${DEFAULT_LANG}/docs/... 直链返回 markdown`,
    mdDirect.status === 200 && /text\/markdown/.test(mdDirect.headers['content-type'] ?? ''),
    `status=${mdDirect.status} type=${mdDirect.headers['content-type']}`);
  // 协商不能误伤浏览器：带 text/html 的 Accept 仍返回 HTML。
  const mdHtml = await get(MD_SAMPLE, { accept: 'text/html,application/xhtml+xml' });
  check('next', 'text/html 请求仍返回 HTML（协商不误伤浏览器）',
    mdHtml.status === 200 && /text\/html/.test(mdHtml.headers['content-type'] ?? ''),
    `status=${mdHtml.status} type=${mdHtml.headers['content-type']}`);
  // HTML 头部声明 markdown 备用链接（Accept 协商之外的显式发现面）。
  const modelsHtml = byPathAll.get('/docs/guide/models') ?? mdHtml.body;
  check('next', 'docs 页 HTML 声明 text/markdown 备用链接',
    /<link[^>]+type="text\/markdown"/.test(modelsHtml), '');

  // --- 4. sitemap 质量 -----------------------------------------------------
  group('4. sitemap 质量');

  const lastmods = [...new Set(urlEntries.map((e) => e.lastmod).filter(Boolean))];
  // 只差毫秒的一组时间戳，等同于「全站同一时刻」—— 正是 Docker COPY 抹平 mtime 的特征
  const distinctToSecond = [...new Set(urlEntries.map((e) => e.lastmod?.slice(0, 19)).filter(Boolean))];
  check('next', `lastmod 精确到秒后仍有多个不同值（现 ${distinctToSecond.length} 个）`,
    distinctToSecond.length > 1,
    distinctToSecond.length <= 1
      ? `全站共享 ${distinctToSecond[0]} —— mtime 被构建抹平，Google 会判定该字段不可信`
      : distinctToSecond.slice(0, 12).join(', '));

  check('next', 'sitemap 不含根 / （308 跳转不该提交）',
    !locs.some((l) => new URL(l).pathname === '/'),
    locs.filter((l) => new URL(l).pathname === '/').join(',') || '已移除');

  check('live', 'sitemap 无重复 URL',
    new Set(locs).size === locs.length, `${locs.length} 条 / ${new Set(locs).size} 唯一`);
  check('live', 'sitemap 全部 https 且同域',
    locs.every((l) => l.startsWith(new URL(BASE).origin + '/')), '');
  check('live', 'lastmod 均为合法 ISO 时间',
    urlEntries.every((e) => !e.lastmod || !isNaN(Date.parse(e.lastmod))), '');
  check('live', 'lastmod 无未来时间',
    urlEntries.every((e) => !e.lastmod || Date.parse(e.lastmod) <= Date.now() + 864e5), '');
  check('live', 'priority 均在 0–1',
    urlEntries.every((e) => !e.priority || (+e.priority >= 0 && +e.priority <= 1)), '');

  check('next', '/docs/guide/errors 已收录进 sitemap',
    locs.some((l) => l.endsWith('/docs/guide/errors')), '');
  check('next', 'sitemap 不含 guide/payment',
    !locs.some((l) => l.includes('payment')), '');

  // --- 5. 敏感内容 ---------------------------------------------------------
  group('5. 敏感内容下线');

  const pay = await get('/docs/guide/payment');
  check('next', '/docs/guide/payment 返回 404', pay.status === 404,
    `status=${pay.status}${pay.status === 200 ? ' —— 含 Stripe/微信支付私钥字段与第三方推广链接的越权文档仍在线' : ''}`);
  if (pay.status === 200) {
    check('next', 'payment 页不含 z-pay 推广链接', !/z-pay\.cn/i.test(pay.body),
      (pay.body.match(/https?:\/\/[^"'\s<]*z-pay[^"'\s<]*/i) ?? ['—'])[0]);
    check('next', 'payment 页不含 Stripe 密钥字段说明', !/Stripe/i.test(pay.body), '');
  }

  // 全站扫一遍：任何页面都不该出现真实密钥形态的串
  const secretHits = [];
  for (const [loc, html] of pageBodies) {
    for (const re of [/sk-[A-Za-z0-9]{24,}/g, /sk_live_[A-Za-z0-9]{10,}/g, /AKIA[0-9A-Z]{16}/g]) {
      const m = html.match(re);
      if (m) secretHits.push(`${new URL(loc).pathname}: ${m[0].slice(0, 14)}…`);
    }
  }
  check('live', '全站无真实密钥形态字符串', secretHits.length === 0, secretHits.join('; ') || '未发现');

  // --- 6. 每页 SEO 元数据 --------------------------------------------------
  group('6. 每页 SEO 元数据');

  const issues = { canonical: [], title: [], desc: [], h1: [], og: [], lang: [], descLen: [] };
  for (const [loc, html] of pageBodies) {
    const p = new URL(loc).pathname;
    const c = canonical(html);
    // canonical 恒为线上绝对地址（SITE_URL 常量），本地容器也一样——
    // 这是对的（canonical 本来就该指向规范域），所以只比 pathname 是否自指。
    if (!c) issues.canonical.push(`${p}: 缺失`);
    else if (new URL(c, BASE).pathname !== p) issues.canonical.push(`${p}: canonical=${c}`);

    const t = title(html);
    if (!t || t.length < 5) issues.title.push(`${p}: "${t}"`);

    const d = meta(html, 'description');
    if (!d) issues.desc.push(`${p}: 缺失`);
    else {
      const len = decodeEntities(d).length;
      // 英文描述天然更长（同一句信息量，拉丁字符数远多于汉字），SERP 截断也按像素/字符
      // 更宽——中文按 40–100 卡，英文放宽到 70–160，避免把合规的英文页误判越界。
      // 英文页的判定随变体走：com 上英文带 /en 前缀；ai 上英文在裸路径。
      const [descLo, descHi] = isEnPath(p) ? [70, 160] : [40, 100];
      if (len < descLo || len > descHi) issues.descLen.push(`${p}: ${len} 字`);
    }

    const h1s = html.match(/<h1[\s>]/g) ?? [];
    if (h1s.length !== 1) issues.h1.push(`${p}: ${h1s.length} 个`);

    if (!meta(html, 'og:title') || !meta(html, 'og:description')) issues.og.push(p);
    const wantLang = p.startsWith(OTHER_PREFIX) ? OTHER_HTML_LANG : DEFAULT_HTML_LANG;
    if (!new RegExp(`<html[^>]+lang="${wantLang}"`).test(html)) issues.lang.push(`${p}: 期望 ${wantLang}`);
  }
  check('live', `每页 canonical 存在且自指（${pageBodies.size} 页）`, issues.canonical.length === 0,
    issues.canonical.slice(0, 6).join('; '));
  check('live', '每页有非空 <title>', issues.title.length === 0, issues.title.slice(0, 6).join('; '));
  check('live', '每页有 meta description', issues.desc.length === 0, issues.desc.slice(0, 6).join('; '));
  check('next', 'description 长度合规（中文 40–100 / 英文 70–160）', issues.descLen.length === 0,
    `${issues.descLen.length} 页越界: ` + issues.descLen.slice(0, 8).join('; '));
  check('next', '每页恰好 1 个 <h1>', issues.h1.length === 0, issues.h1.slice(0, 6).join('; '));
  check('live', '每页有 og:title / og:description', issues.og.length === 0, issues.og.slice(0, 6).join('; '));
  check('live', `每页 <html lang> 与语言匹配（裸=${DEFAULT_HTML_LANG} / ${OTHER_SEG}=${OTHER_HTML_LANG}）`, issues.lang.length === 0, issues.lang.slice(0, 6).join('; '));

  const docsHome = byPathAll.get('/docs') ?? (await get('/docs')).body;
  check('live', '首页 twitter:card 已设', !!meta(docsHome, 'twitter:card'), meta(docsHome, 'twitter:card'));
  check('live', '未误发 noindex', !/<meta[^>]+name="robots"[^>]+noindex/i.test(docsHome), '');

  // --- 6b. hreflang 双语互指 -----------------------------------------------
  // 双语站的核心不变量：两版存在时必须互挂 hreflang（zh-CN↔en，x-default→默认语言），
  // 且**只在两版都存在时**互挂——只有一版的页面绝不能发 hreflang（会指向 404，
  // 稀释信号）。这条与 app/sitemap.ts、page.tsx 的规则同源，抓的是「翻译补齐后
  // 某页 hreflang 没跟上」或「未翻译页误发了指向 404 的链接」这类渲染期回归。
  // 默认语言随变体：com 裸=zh-CN、/en=en；ai 裸=en、/cn=zh-CN。x-default 恒指裸路径。
  group('6b. hreflang 双语互指');
  const hrefLangs = (html) => {
    const out = {};
    for (const m of (html ?? '').matchAll(/<link\b[^>]*\bhreflang="([^"]+)"[^>]*>/gi)) {
      const href = (m[0].match(/\bhref="([^"]+)"/i) ?? [])[1];
      if (href) out[m[1]] = href;
    }
    return out;
  };
  const hrefPath = (u) => { try { return new URL(u, BASE).pathname; } catch { return u ?? ''; } };
  const pathToHtml = new Map([...pageBodies].map(([l, h]) => [new URL(l).pathname, h]));
  const hreflangProblems = [];
  let hreflangPairs = 0;
  for (const [p, html] of pathToHtml) {
    if (p.startsWith(OTHER_PREFIX)) continue; // 从默认语言页迭代，另一语言作为对偶取
    const otherP = `${OTHER_SEG}${p}`;
    const langs = hrefLangs(html);
    if (pathToHtml.has(otherP)) {
      hreflangPairs++;
      const want = {
        [DEFAULT_HTML_LANG]: p,
        [OTHER_HTML_LANG]: otherP,
        'x-default': p,
      };
      const otherLangs = hrefLangs(pathToHtml.get(otherP));
      for (const [k, v] of Object.entries(want)) {
        if (hrefPath(langs[k]) !== v) hreflangProblems.push(`${p}: hreflang ${k} 缺/错`);
        if (hrefPath(otherLangs[k]) !== v) hreflangProblems.push(`${otherP}: hreflang ${k} 缺/错`);
      }
    } else if (Object.keys(langs).length > 0) {
      hreflangProblems.push(`${p}: 无另一语言版却发了 hreflang（会指向 404）`);
    }
  }
  check('next', `hreflang 双语页互指且自洽（${hreflangPairs} 对）`, hreflangProblems.length === 0,
    hreflangProblems.slice(0, 6).join('; '));

  // --- 7. 结构化数据 -------------------------------------------------------
  group('7. 结构化数据 JSON-LD');

  const typeCount = {};
  const ldProblems = [];
  const crumbMissingItem = [];
  let breadcrumbBad = 0;
  for (const [loc, html] of pageBodies) {
    const p = new URL(loc).pathname;
    const blocks = jsonLd(html);
    if (blocks.some((b) => b.__parseError)) ldProblems.push(`${p}: JSON 解析失败`);
    for (const b of blocks) {
      const t = b['@type'];
      if (t) typeCount[t] = (typeCount[t] ?? 0) + 1;
      if (!b['@context'] && !b.__parseError) ldProblems.push(`${p}: 缺 @context`);
      if (t === 'BreadcrumbList') {
        const items = b.itemListElement ?? [];
        // position 必须 1..n 连续，每项必须有 name
        if (!items.every((it, i) => it.position === i + 1 && it.name)) breadcrumbBad++;
        // Google：「若该项是面包屑中的最后一项，item 非必填」—— 反过来说，
        // 中间层的 item 是必填的。缺了会让整条 BreadcrumbList 失去富媒体资格。
        const missing = items.slice(0, -1).filter((it) => !it.item).map((it) => it.name);
        if (missing.length) crumbMissingItem.push(`${p}: ${missing.join('/')}`);
      }
      if (t === 'FAQPage') {
        const bad = (b.mainEntity ?? []).some(
          (q) => !q.name || !q.acceptedAnswer?.text);
        if (bad) ldProblems.push(`${p}: FAQPage 有空问答`);
      }
    }
  }
  check('live', 'JSON-LD 全部可解析且有 @context', ldProblems.length === 0,
    ldProblems.slice(0, 6).join('; '));
  check('live', 'BreadcrumbList position 连续且有 name', breadcrumbBad === 0, `${breadcrumbBad} 页异常`);
  check('live', 'BreadcrumbList 中间层均有 item（Google 必填）', crumbMissingItem.length === 0,
    `${crumbMissingItem.length} 页缺失，中间层为「${[...new Set(crumbMissingItem.map((s) => s.split(': ')[1]))].join('、')}」` +
    `（这三个目录无 index 页，代码按"宁缺勿指向 404"省略了 item，但 Google 要求中间层必填 → 整条面包屑失去富媒体资格）`);
  check('live', '存在 WebSite / Organization', !!typeCount.WebSite && !!typeCount.Organization,
    `WebSite=${typeCount.WebSite ?? 0} Organization=${typeCount.Organization ?? 0}`);
  // 产品实体（v0.1.28 起）：让引擎明确「灵眸 AI 是什么」。站点级注入，逐页都有。
  check('next', 'SoftwareApplication 描述产品实体', (typeCount.SoftwareApplication ?? 0) >= 1,
    `${typeCount.SoftwareApplication ?? 0} 页`);
  check('live', 'TechArticle 覆盖文档页', (typeCount.TechArticle ?? 0) >= 20,
    `${typeCount.TechArticle ?? 0} 页`);
  check('live', 'FAQPage 已产出', (typeCount.FAQPage ?? 0) >= 5, `${typeCount.FAQPage ?? 0} 页`);
  check('live', '模型广场有 ItemList', (typeCount.ItemList ?? 0) >= 1, `${typeCount.ItemList ?? 0}`);

  // 原本这里列了 7 页（含 codex-cli-windows）。PR#6 之后 codex-cli-windows 主动
  // 撤掉了 faq：它那两个坑（脚本禁止运行、CODEX 无法识别）的完整报错原文和解决
  // 步骤都在 faq.mdx 问题 4 / 5，由该页出 FAQPage；两个 URL 提交同一份问答会被
  // Google 判重（保一条、稀释另一条），严重时算结构化数据人工处罚。
  // 所以这里从 6 页断言「有」，另起一条断言它「没有」——把决策钉死，防回填回去。
  const FAQ_NEXT = ['obsidian', 'claude-code-gpt', 'cc-switch', 'claude-code-vscode',
    'claude-code-desktop', 'hermes'];
  const missingFaq = FAQ_NEXT.filter((s) => {
    const html = byPathAll.get(`/docs/tools/${s}`);
    return !html || !html.includes('FAQPage');
  });
  check('next', `6 个工具页已回填 FAQPage`, missingFaq.length === 0, `缺: ${missingFaq.join(', ') || '无'}`);

  // 该断言在两个变体都成立：cn 与 en 的 codex-cli-windows 均无 faq frontmatter（已核）。
  const winHtml = byPathAll.get('/docs/tools/codex-cli-windows');
  check('live', 'codex-cli-windows 不出 FAQPage（问答归 faq.mdx，避免跨 URL 重复）',
    !!winHtml && !winHtml.includes('FAQPage'),
    winHtml ? (winHtml.includes('FAQPage') ? '又出现了 FAQPage —— 与 PR#6 的去重决策冲突' : '') : '页面未取到');

  // --- 7c. 最后更新日期 ----------------------------------------------------
  // 这块每条断言都对应一种「看起来还在，其实已经废了」的退化方式：
  // 组件被换回 fumadocs 内建的 PageLastUpdate（客户端渲染，SSR 里没有日期）、
  // content-dates.json 停止刷新（全站退回构建时刻 → 所有页同一天）、
  // 或 CI 漏跑刷新那步（日期集体停在某个过去的时间点）。
  group('7c. 最后更新日期');

  // /i：组件输出 JSX 规范的驼峰 dateTime（避开 React 19 dev 的 Invalid DOM property
  // 告警）；页面以 text/html 提供，HTML 解析器把它与 datetime 视作同一个。
  const dateOf = (html) => (html?.match(/<time datetime="([^"]+)"/i) ?? [])[1] ?? null;
  const pagesWithDate = [...pageBodies.entries()].filter(
    ([loc, h]) => h.includes(new URL(loc).pathname.startsWith(OTHER_PREFIX) ? OTHER_UPDATED_MARK : DEFAULT_UPDATED_MARK));

  check('next', '每个文档页都有「最后更新」', pagesWithDate.length === pageBodies.size,
    `${pagesWithDate.length}/${pageBodies.size} 页`);

  // 必须出现在 SSR 的 HTML 里。fumadocs 内建的 PageLastUpdate 把日期放在
  // useEffect 里，首屏 HTML 是空标签 —— 爬虫和 AI 检索什么也读不到，
  // 「让人感知到持续更新」恰好对最需要它的读者失效。
  const withTime = [...pageBodies.values()].filter((h) => dateOf(h));
  check('next', '日期在 SSR HTML 里（非客户端渲染）', withTime.length === pageBodies.size,
    `${withTime.length}/${pageBodies.size} 页有 <time datetime>`);

  // datetime 的值必须是合法 ISO 8601（给机器读的完整时间戳），不能退化成只有
  // 显示用的短日期。属性名大小写不做要求：text/html 下 dateTime 与 datetime 等价，
  // 组件刻意用驼峰以避开 React 19 dev-only 的 Invalid DOM property 告警；真正给机器
  // 读的日期另在 JSON-LD 的 dateModified 里，此处属性大小写纯装饰。
  const validIso = withTime.filter((h) => !Number.isNaN(Date.parse(dateOf(h))));
  check('next', 'time 标签带合法 ISO datetime 属性', validIso.length === pageBodies.size,
    `${validIso.length}/${pageBodies.size} 页 datetime 可解析为 ISO`);

  // 逐页独立才有意义：全站同一个日期 = 退回了「构建时刻」，等于没有信号。
  const distinct = new Set(withTime.map((h) => dateOf(h).slice(0, 10)));
  check('next', '日期逐页独立（非全站同值）', distinct.size >= 3,
    `${distinct.size} 个不同日期`);

  // content-dates.json 若停止刷新，日期会集体冻结在过去某点。用「最新一篇不能
  // 太旧」来兜底：站在持续更新，最近改动不该超过 120 天没反映到页面上。
  const newest = withTime.map((h) => dateOf(h)).sort().at(-1);
  const daysOld = newest ? (Date.now() - Date.parse(newest)) / 86400000 : Infinity;
  check('next', '日期数据未陈旧（最新一篇 < 120 天）', daysOld < 120,
    newest ? `最新 ${newest.slice(0, 10)}，距今 ${Math.round(daysOld)} 天` : '取不到日期');

  // --- 7b. 内容自洽性 ------------------------------------------------------
  // 发布前审计抓到两条「归纳过头」的断言：站上没有出处，且与既有页面直接冲突。
  // 这类缺陷编译器和链接检查都发现不了，只能对文案本身下断言。
  group('7b. 内容自洽性（审计发现的两条断言）');

  // sitemap 里的 loc 恒为线上绝对地址，而 --base 可能指向本地容器，
  // 所以按 pathname 取，而不是按完整 URL 取。
  const byPath = new Map([...pageBodies].map(([l, h]) => [new URL(l).pathname, h]));
  // 断言只看去掉 HTML 标签后的纯文本：**加粗** 会在句子中间插入 <strong>，
  // 直接对原始 HTML 做子串匹配会漏判。
  // 这四条断言针对的是中文原文文案 —— 中文页在 com 是裸路径、在 ai 带 /cn 前缀。
  const cnDocs = (p) => byPath.get(IS_AI ? `/cn${p}` : p);
  const textOf = (h) => h.replace(/<[^>]+>/g, '');
  const errHtml = textOf(cnDocs('/docs/guide/errors') ?? '');
  const modHtml = textOf(cnDocs('/docs/guide/models') ?? '');

  // 429 是 4xx，而三个生图接口一致把它列进「建议重试」——「4xx 基本都不该重试」
  // 与本页自己的 429 行同屏矛盾。
  check('next', 'errors 页不再断言「4xx 基本都不该重试」',
    errHtml.length > 0 && !errHtml.includes('4xx 基本都不该重试'),
    errHtml.length === 0 ? '页面取不到' : '仍存在该断言');
  check('next', 'errors 页重试建议明确覆盖 429',
    /可以重试[\s\S]{0,200}429/.test(errHtml),
    errHtml.length === 0 ? '页面取不到' : '未把 429 列入可重试');

  // api-protocols 有整节「协议和可用模型是两件事」，明说「和你用哪种协议调用无关」。
  check('next', 'models 页不再把协议绑死到模型族',
    modHtml.length > 0 && !modHtml.includes('协议要跟模型对上'),
    modHtml.length === 0 ? '页面取不到' : '仍存在该断言');
  check('next', 'models 页保留「可用模型由分组决定」的口径',
    modHtml.includes('和你用哪种协议调用无关'),
    modHtml.length === 0 ? '页面取不到' : '未声明与协议无关');

  // .ai 变体专属：大陆定位话术（对国际站线路为假）不得出现在任何页面 ——
  // 抓的是 <CN>/<Intl> 标记漏包或物化替换失效。
  if (IS_AI) {
    const leak = [];
    for (const [p, html] of byPath) {
      const t = textOf(html);
      if (/国内直连|免代理|无需魔法|proxy-free|hosted inside mainland China/.test(t)) leak.push(p);
    }
    check('next', '.ai 页面无大陆定位话术残留', leak.length === 0, leak.slice(0, 6).join('; ') || '干净');
  }

  // 两站通用：对外文案不出现「新加坡/Singapore」（2026-09-02 统一口径：.ai 只称
  // 「国际站」，不提具体节点城市）。页面 + 两份 llms.txt 一起扫。
  {
    const leak = [];
    for (const [p, html] of byPath) {
      if (/新加坡|Singapore/i.test(textOf(html))) leak.push(p);
    }
    for (const p of ['/llms.txt', `${OTHER_SEG}/llms.txt`]) {
      if (/新加坡|Singapore/i.test((await get(p)).body)) leak.push(p);
    }
    check('next', '无「新加坡/Singapore」字样（页面+llms）', leak.length === 0,
      leak.slice(0, 6).join('; ') || '干净');
  }

  // --- 7d. 统计归属 --------------------------------------------------------
  // 2026-09 起两站分 GA 媒体资源：.com=G-3YQJ477Z5W、.ai=G-QNRSEGSX5D。
  // 挂错/混用会把海外流量灌进国内报表且无任何报错。layout 全局注入，验一页即可。
  group('7d. 统计归属（GA 分站）');
  {
    const GA_SELF = IS_AI ? 'G-QNRSEGSX5D' : 'G-3YQJ477Z5W';
    const GA_OTHER = IS_AI ? 'G-3YQJ477Z5W' : 'G-QNRSEGSX5D';
    const docsHtml = (await get('/docs')).body;
    check('next', `GA 衡量 ID 为本站专属（${GA_SELF}）`, docsHtml.includes(GA_SELF),
      docsHtml.includes(GA_SELF) ? '已挂本站 ID' : '页面上找不到本站 GA ID');
    check('next', '未混入另一站的 GA ID', !docsHtml.includes(GA_OTHER),
      docsHtml.includes(GA_OTHER) ? `混入了 ${GA_OTHER}` : '干净');
  }

  // --- 8. 站内链接与锚点 ---------------------------------------------------
  group('8. 站内链接完整性');

  const known = new Set([...pageBodies.keys()].map((l) => new URL(l).pathname));
  const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const idCache = new Map([...pageBodies].map(([l, h]) => [new URL(l).pathname, idsOf(h)]));

  const brokenLinks = [], brokenAnchors = [];
  for (const [loc, html] of pageBodies) {
    const from = new URL(loc).pathname;
    // 只看正文里的站内链接
    for (const m of html.matchAll(/href="(\/docs[^"#]*)(#[^"]*)?"/g)) {
      const target = decodeURIComponent(m[1]).replace(/\/$/, '') || '/docs';
      if (!known.has(target)) { brokenLinks.push(`${from} → ${m[1]}`); continue; }
      if (m[2]) {
        const frag = decodeURIComponent(m[2].slice(1));
        if (frag && !idCache.get(target)?.has(frag)) brokenAnchors.push(`${from} → ${m[1]}${m[2]}`);
      }
    }
  }
  check('live', '无站内断链', brokenLinks.length === 0,
    [...new Set(brokenLinks)].slice(0, 8).join('; ') || `0 处`);
  check('live', '跨页锚点均可解析', brokenAnchors.length === 0,
    [...new Set(brokenAnchors)].slice(0, 8).join('; ') || `0 处`);

  // --- 9. 传输与性能 -------------------------------------------------------
  group('9. 传输与性能');

  const home = await get('/docs');
  check('live', '/docs 响应 < 2s', home.ms < 2000, `${home.ms}ms`);
  check('live', 'HTML 启用压缩',
    /gzip|br|zstd/.test(home.headers['content-encoding'] ?? ''),
    home.headers['content-encoding'] ?? '无 content-encoding');
  check('live', 'HTML 声明 UTF-8', /utf-8/i.test(home.headers['content-type'] ?? ''),
    home.headers['content-type']);
  // 这里只统计取回耗时，可达性已在第 1 组判过，不重复计失败
  const times = [...cache.entries()].filter(([k]) => k.startsWith('GET http')).map(([, v]) => v.ms);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] ?? 0;
  check('live', `全站 p95 响应 < 3s（${times.length} 次请求）`, p95 < 3000, `p95=${p95}ms max=${times.at(-1)}ms`);

  group('10. 安全响应头');
  for (const [h, expect, since] of [
    ['x-content-type-options', /nosniff/i, 'next'],
    ['referrer-policy', /strict-origin/i, 'next'],
    ['x-frame-options', /SAMEORIGIN|DENY/i, 'next'],
  ]) {
    check(since, `响应头 ${h}`, expect.test(home.headers[h] ?? ''), home.headers[h] ?? '缺失');
  }
  check('next', '未暴露 x-powered-by', !home.headers['x-powered-by'],
    home.headers['x-powered-by'] ?? '未暴露');
  // HSTS 与明文跳转都由反代（Caddy）负责，本地明文容器上根本没有 TLS 层。
  // 在那里断言会得到两条假阳性失败，反而掩盖真实结果——所以显式跳过。
  const TLS = BASE.startsWith('https:');
  if (TLS) {
    const https = await get('/docs', { method: 'HEAD' });
    check('live', '启用 HSTS', !!https.headers['strict-transport-security'],
      https.headers['strict-transport-security'] ??
        '缺失 —— 该头由反代（Caddy）下发，不在 Next 代码里，需在部署侧加');
    const plain = await get(BASE.replace(/^https:/, 'http:') + '/docs');
    check('live', 'http 明文跳 https', plain.status >= 300 && plain.status < 400 &&
      (plain.headers.location ?? '').startsWith('https://'),
      `status=${plain.status} → ${plain.headers.location ?? ''}`);
  } else {
    console.log('  \x1b[2m·  HSTS / 明文跳转：本地明文容器无 TLS 层，跳过（仅对 https 目标断言）\x1b[0m');
  }

  // --- 11. 404 行为 --------------------------------------------------------
  group('11. 404 行为');
  const nf = await get('/docs/this-page-does-not-exist-' + 'x'.repeat(8));
  check('live', '不存在的路径返回 404', nf.status === 404, `status=${nf.status}`);
  const nf404Re = IS_AI ? /Page not found/ : /页面不存在|找不到/;
  check('next', `404 页为${IS_AI ? '英文' : '中文'}（随默认语言）`, nf404Re.test(nf.body),
    nf404Re.test(nf.body) ? '语言正确' : '语言不符（或仍是框架默认页）');
  check('next', '404 页 noindex', /name="robots"[^>]*noindex/.test(nf.body), '');

  // ==== 汇总 ================================================================
  const liveR = results.filter((r) => r.since === 'live');
  const nextR = results.filter((r) => r.since === 'next');
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));

  let lastG = '';
  for (const r of results) {
    if (r.group !== lastG) { console.log(`\n${r.group}`); lastG = r.group; }
    const mark = r.ok ? '[32m✓[0m' : (r.since === 'next' ? '[33m·[0m' : '[31m✗[0m');
    const tag = r.since === 'next' ? '[2m[v0.1.8][0m' : '        ';
    console.log(`  ${mark} ${tag} ${pad(r.name, 46)} ${r.ok ? '' : '[2m' + r.detail + '[0m'}`);
  }

  console.log('\n' + '─'.repeat(76));
  console.log(`当前版本应通过（live）：${liveR.filter((r) => r.ok).length}/${liveR.length} 通过` +
    (liveR.some((r) => !r.ok) ? `  [31m← ${liveR.filter((r) => !r.ok).length} 项真实缺陷[0m` : '  [32m全绿[0m'));
  console.log(`本轮上线后应通过（v0.1.8）：${nextR.filter((r) => r.ok).length}/${nextR.length} 通过` +
    `  [2m（现在不过属预期，作上线后回归基线）[0m`);
  console.log('─'.repeat(76) + '\n');

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
    console.log(`明细已写入 ${JSON_OUT}\n`);
  }

  process.exit(liveR.some((r) => !r.ok) ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
