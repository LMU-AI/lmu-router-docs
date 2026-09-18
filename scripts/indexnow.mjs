#!/usr/bin/env node
// IndexNow 即时收录推送 —— docs.lmuai.com（com 变体）/ docs.lmuai.ai（ai 变体）
//
// 内容一变就主动通知搜索引擎，不必干等爬虫回访。参与方：Bing / Yandex / Naver /
// Seznam.cz / Yep / Amazon。**Google 不参与**，Google 侧仍只能靠 sitemap + GSC；
// **百度也不参与**，.com 的百度收录仍要走百度站长平台单独提交。
//
// 推哪些 URL：读**线上** sitemap.xml，按 <lastmod> 筛。lastmod 由 content-dates.json
// → lib/last-modified.ts 从 git 提交时间派生，逐页精确；且 sitemap 已刻意排除 /（308
// 跳转），天然不会把跳转 URL 推给搜索引擎。读线上 sitemap 还免费拿到 10 语前缀规则、
// .ai 的 en↔cn 角色对调、guide/compliance 仅 .com 这些变体差异 —— 自己从 content/
// 推 URL 得把这套 i18n 映射重造一遍。
//
// key 不写在本文件里：直接 GET <base>/indexnow-key.txt 取（唯一事实源在 lib/variant.ts），
// 顺带验证 key 文件确实已上线 —— 没上线就推送，搜索引擎取不到 key，必然 403。
//
// 何时跑：**两台机都部署完、prodcheck 绿之后**（见 .claude/skills/release/SKILL.md 步 5）。
// 别塞进 CI：CI 只负责推镜像，真正上线还要手动 SSH `docker compose pull`（实测约 10
// 分钟），在那之前推送只会让搜索引擎抓到旧页面。
//
// 用法：node scripts/indexnow.mjs [--base https://docs.lmuai.com] [--since <ISO|Nd>]
//                                [--all] [--dry-run] [--endpoint <url>]
//      npm run indexnow -- --base https://docs.lmuai.ai --all
// --since 省略时 = 上一个 tag 的提交时间（≈「本次发版改了哪些页」）。
// --all   全量提交，首次冷启动用（每站约 400 条，协议上限 10000）。
// --endpoint 省略时用全局端点，一次投递即分发给全部参与引擎。
//
// 退出码：0 成功（含「无变更、未发送」）/ 1 失败 / 2 意外抛出

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const argv = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const BASE = (argv('--base') ?? '').startsWith('http')
  ? argv('--base').replace(/\/$/, '')
  : 'https://docs.lmuai.com';
const ENDPOINT = (argv('--endpoint') ?? '').startsWith('http')
  ? argv('--endpoint')
  : 'https://api.indexnow.org/indexnow';
const SINCE_ARG = argv('--since');
const ALL = args.includes('--all');
const DRY = args.includes('--dry-run');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const OK = `${G}✓${X}`, NO = `${R}✗${X}`, WARN = `${Y}⚠${X}`;
const die = (msg) => { console.error(`${NO} ${msg}`); process.exit(1); };

// --- HTTP（超时抄 prodcheck.mjs，重试抄 translate-content.mjs 的 withRetry） -------
async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': 'lmu-indexnow/1.0', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
  });
  return { status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() };
}

async function withRetry(fn, label) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i === 2) break;
      process.stderr.write(`  ${Y}↻${X} 重试 ${label} (${i + 1}/3)：${e.message}\n`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

// --- 截止时间 ---------------------------------------------------------------
// 接受 ISO 日期时间，或 `7d` 这样的相对天数。
function parseSince(s) {
  const rel = /^(\d+)d$/.exec(s.trim());
  if (rel) return new Date(Date.now() - Number(rel[1]) * 86400_000);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 缺省截止时间 = 上一个 tag 的提交时间。发布流程是「先合并、再在 main 上打 tag」，
// 跑本脚本时最新 tag 就是这次发的，故取第 2 条；本次发版改动的页面，其 lastmod
// （= git 提交时间）必定晚于它。
function previousTag() {
  const git = (a) =>
    execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const tags = git(['tag', '--sort=-v:refname']).split('\n').filter(Boolean);
    if (tags.length < 2) return null;
    return { tag: tags[1], date: new Date(git(['log', '-1', '--format=%cI', tags[1]])) };
  } catch {
    return null;
  }
}

// --- 主流程 -----------------------------------------------------------------
async function main() {
  const host = new URL(BASE).hostname;
  const keyLocation = `${BASE}/indexnow-key.txt`;

  console.log(`${D}IndexNow 推送 · ${host} · 端点 ${ENDPOINT}${X}\n`);

  // ① 取 key —— 同时就是「key 文件已上线」的前置校验。
  const keyRes = await withRetry(() => req(keyLocation), 'key 文件');
  if (keyRes.status !== 200)
    die(`取不到 key 文件 ${keyLocation} → HTTP ${keyRes.status}。key 没上线就推送必然 403`);
  if (!/text\/plain/.test(keyRes.headers['content-type'] ?? ''))
    die(`key 文件 content-type 应为 text/plain，实际 ${keyRes.headers['content-type']}`);
  const key = keyRes.body.trim();
  if (!/^[0-9a-zA-Z-]{8,128}$/.test(key))
    die(`key 格式不合法（应为 8–128 位字母/数字/短横）：${JSON.stringify(key.slice(0, 40))}`);
  console.log(`${OK} key 文件已上线 ${D}${keyLocation} → ${key.slice(0, 8)}…${X}`);

  // ② 取线上 sitemap。
  const sm = await withRetry(() => req(`${BASE}/sitemap.xml`), 'sitemap');
  if (sm.status !== 200) die(`取不到 ${BASE}/sitemap.xml → HTTP ${sm.status}`);

  // sitemap 里的 loc 永远是线上绝对地址（SITE_URL 常量），即便这次跑的是本地容器。
  // 统一把 origin 换成 --base，否则本地 dry-run 会打印出一串生产地址。指向生产时
  // 这是恒等变换。（与 prodcheck.mjs 的 toBase 同一处理。）
  const toBase = (u) => {
    try { return new URL(new URL(u).pathname, BASE).href; } catch { return u; }
  };
  const entries = [...sm.body.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({
      loc: m[1].match(/<loc>([^<]+)/)?.[1],
      lastmod: m[1].match(/<lastmod>([^<]+)/)?.[1],
    }))
    .filter((e) => e.loc)
    .map((e) => ({ ...e, loc: toBase(e.loc) }));
  if (!entries.length) die('sitemap 解析不出任何 <url>');
  console.log(`${OK} sitemap 解析到 ${entries.length} 条 URL`);

  // ③ 按 lastmod 筛出本次要推的。
  let cutoff = null, cutoffLabel = '';
  if (!ALL) {
    if (SINCE_ARG) {
      cutoff = parseSince(SINCE_ARG);
      if (!cutoff) die(`--since 解析失败：${SINCE_ARG}（用 ISO 日期或 7d 这样的相对天数）`);
      cutoffLabel = `--since ${SINCE_ARG}`;
    } else {
      const prev = previousTag();
      if (!prev) die('推断不出上一个 tag 的时间（不在 git 仓库，或 tag 少于 2 个）。请显式传 --since 或 --all');
      cutoff = prev.date;
      cutoffLabel = `上一个 tag ${prev.tag}`;
    }
  }

  const selected = ALL
    ? entries
    : entries.filter((e) => e.lastmod && new Date(e.lastmod) >= cutoff);

  if (!selected.length) {
    console.log(`\n${WARN} 自${cutoffLabel}（${cutoff.toISOString()}）以来无页面变更，未发送。`);
    process.exit(0);
  }

  // 护栏：10000 是协议硬上限；超 1000 说明筛选条件多半不对，要显式 --all 才放行。
  if (selected.length > 10000) die(`选中 ${selected.length} 条，超过协议上限 10000`);
  if (selected.length > 1000 && !ALL)
    die(`选中 ${selected.length} 条（>1000），筛选条件可能不对。确认要全量推送请显式加 --all`);

  const scope = ALL ? `${D}--all 全量${X}` : `${D}${cutoffLabel} 起 · ${cutoff.toISOString()}${X}`;
  console.log(`\n待推送 ${selected.length} 条（${scope}）：`);
  for (const e of selected.slice(0, 5))
    console.log(`  ${D}·${X} ${e.loc}${e.lastmod ? ` ${D}${e.lastmod}${X}` : ''}`);
  if (selected.length > 5) console.log(`  ${D}… 其余 ${selected.length - 5} 条${X}`);

  if (DRY) {
    console.log(`\n${WARN} --dry-run：未发送。`);
    process.exit(0);
  }

  // ④ 提交。
  const res = await withRetry(
    () => req(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: selected.map((e) => e.loc) }),
    }),
    'IndexNow 提交',
  );

  const MEANING = {
    200: '成功，已接受',
    202: '已收到，key 待验证 —— 首次提交的正常返回，不是错误',
    400: '请求格式错误',
    403: 'key 无效，或搜索引擎取不到 key 文件',
    422: 'URL 与 host 不符，或 key 与文件内容不匹配',
    429: '提交过于频繁，被限流（官方建议两次提交间隔 ≥5 分钟）',
  };
  const note = MEANING[res.status] ?? '未知返回';

  if (res.status === 200 || res.status === 202) {
    console.log(`\n${OK} HTTP ${res.status} —— ${note}`);
    console.log(`${D}IndexNow 是推送通知，不保证立即收录；隔几天到 Bing 站长后台看「已编入索引」是否增长。${X}`);
    process.exit(0);
  }

  console.error(`\n${NO} HTTP ${res.status} —— ${note}`);
  if (res.body) console.error(`${D}${res.body.slice(0, 500)}${X}`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(2); });
