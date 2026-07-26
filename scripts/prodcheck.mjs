#!/usr/bin/env node
// 生产站点测试套件 —— docs.lmuai.com
//
// 每条断言标注 since：该项从哪个版本起应当为真。
//   'live'  —— 当前生产版本就该通过；失败 = 真实线上缺陷
//   'next'  —— 本轮（v0.1.8）才引入；在旧版本上失败属预期，用于上线后回归
//
// 用法：node scripts/prodcheck.mjs [--base https://docs.lmuai.com] [--json out.json]
//      npm run prodcheck

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] ?? '').startsWith('http')
  ? args[args.indexOf('--base') + 1]
  : 'https://docs.lmuai.com';
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

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

async function get(path, { ua, method = 'GET', redirect = 'manual' } = {}) {
  const key = `${method} ${path} ${ua ?? ''} ${redirect}`;
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

  const llms = await get('/llms.txt');
  check('live', '/llms.txt 200', llms.status === 200, `status=${llms.status}`);
  check('live', 'llms.txt 是 text/plain', /text\/plain/.test(llms.headers['content-type'] ?? ''),
    llms.headers['content-type']);
  check('live', 'llms.txt 用绝对 URL', !/\]\(\/docs/.test(llms.body),
    /\]\(\/docs/.test(llms.body) ? '仍含相对路径 ](/docs' : '全部绝对 URL');
  check('next', 'llms.txt 含「关键事实」块', llms.body.includes('关键事实'), '');
  check('next', 'llms.txt 指向错误码速查页', llms.body.includes('/docs/guide/errors'), '');
  check('next', 'llms.txt 不再提及 payment', !llms.body.includes('payment'), '');

  const llmsFull = await get('/llms-full.txt');
  check('live', '/llms-full.txt 200', llmsFull.status === 200, `status=${llmsFull.status}`);
  check('next', 'llms-full.txt 不含 payment 内容',
    !/Stripe|z-pay|APIv3/i.test(llmsFull.body),
    /Stripe/i.test(llmsFull.body) ? '仍含 Stripe/z-pay/APIv3 字样' : '干净');

  // AI 爬虫拿到的必须和普通访客一致（不做 cloaking，也别被 WAF 拦）
  for (const ua of ['GPTBot/1.0', 'ClaudeBot/1.0', 'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
    const r = await get('/docs', { ua });
    check('live', `${ua.split('/')[0]} 抓 /docs 得 200`, r.status === 200, `status=${r.status}`);
  }
  const asGpt = await get('/llms.txt', { ua: 'GPTBot/1.0' });
  check('live', 'GPTBot 抓 /llms.txt 得 200', asGpt.status === 200, `status=${asGpt.status}`);

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
      if (len < 40 || len > 100) issues.descLen.push(`${p}: ${len} 字`);
    }

    const h1s = html.match(/<h1[\s>]/g) ?? [];
    if (h1s.length !== 1) issues.h1.push(`${p}: ${h1s.length} 个`);

    if (!meta(html, 'og:title') || !meta(html, 'og:description')) issues.og.push(p);
    if (!/<html[^>]+lang="zh-CN"/.test(html)) issues.lang.push(p);
  }
  check('live', `每页 canonical 存在且自指（${pageBodies.size} 页）`, issues.canonical.length === 0,
    issues.canonical.slice(0, 6).join('; '));
  check('live', '每页有非空 <title>', issues.title.length === 0, issues.title.slice(0, 6).join('; '));
  check('live', '每页有 meta description', issues.desc.length === 0, issues.desc.slice(0, 6).join('; '));
  check('next', 'description 长度均在 40–100 字', issues.descLen.length === 0,
    `${issues.descLen.length} 页越界: ` + issues.descLen.slice(0, 8).join('; '));
  check('next', '每页恰好 1 个 <h1>', issues.h1.length === 0, issues.h1.slice(0, 6).join('; '));
  check('live', '每页有 og:title / og:description', issues.og.length === 0, issues.og.slice(0, 6).join('; '));
  check('live', '每页 <html lang="zh-CN">', issues.lang.length === 0, issues.lang.slice(0, 6).join('; '));

  const docsHome = byPathAll.get('/docs') ?? (await get('/docs')).body;
  check('live', '首页 twitter:card 已设', !!meta(docsHome, 'twitter:card'), meta(docsHome, 'twitter:card'));
  check('live', '未误发 noindex', !/<meta[^>]+name="robots"[^>]+noindex/i.test(docsHome), '');

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
  check('live', 'TechArticle 覆盖文档页', (typeCount.TechArticle ?? 0) >= 20,
    `${typeCount.TechArticle ?? 0} 页`);
  check('live', 'FAQPage 已产出', (typeCount.FAQPage ?? 0) >= 5, `${typeCount.FAQPage ?? 0} 页`);
  check('live', '模型广场有 ItemList', (typeCount.ItemList ?? 0) >= 1, `${typeCount.ItemList ?? 0}`);

  const FAQ_NEXT = ['obsidian', 'claude-code-gpt', 'cc-switch', 'claude-code-vscode',
    'claude-code-desktop', 'hermes', 'codex-cli-windows'];
  const missingFaq = FAQ_NEXT.filter((s) => {
    const html = byPathAll.get(`/docs/tools/${s}`);
    return !html || !html.includes('FAQPage');
  });
  check('next', `7 个工具页已回填 FAQPage`, missingFaq.length === 0, `缺: ${missingFaq.join(', ') || '无'}`);

  // --- 7b. 内容自洽性 ------------------------------------------------------
  // 发布前审计抓到两条「归纳过头」的断言：站上没有出处，且与既有页面直接冲突。
  // 这类缺陷编译器和链接检查都发现不了，只能对文案本身下断言。
  group('7b. 内容自洽性（审计发现的两条断言）');

  // sitemap 里的 loc 恒为线上绝对地址，而 --base 可能指向本地容器，
  // 所以按 pathname 取，而不是按完整 URL 取。
  const byPath = new Map([...pageBodies].map(([l, h]) => [new URL(l).pathname, h]));
  // 断言只看去掉 HTML 标签后的纯文本：**加粗** 会在句子中间插入 <strong>，
  // 直接对原始 HTML 做子串匹配会漏判。
  const textOf = (h) => h.replace(/<[^>]+>/g, '');
  const errHtml = textOf(byPath.get('/docs/guide/errors') ?? '');
  const modHtml = textOf(byPath.get('/docs/guide/models') ?? '');

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
  check('next', '404 页为中文', /页面不存在|找不到/.test(nf.body),
    /页面不存在|找不到/.test(nf.body) ? '中文' : '疑似英文默认页');
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
