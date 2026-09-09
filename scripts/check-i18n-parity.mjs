#!/usr/bin/env node
/**
 * 多语言文档对照检查（i18n parity）。
 *
 * 以中文（裸 *.mdx）为事实基准，逐一核对每个附加语种（*.{lang}.mdx）。回答三问，
 * 全部零依赖、可在 CI / 本地跑：
 *   A. 一一对应：每篇中文页在「该页要求的每个语种」都有对应译页？有没有孤儿译页
 *      （某语种有、中文没有）？有没有「不该出现」的译页（如把 compliance 译进新语种）？
 *   B. 导航齐全：每个 meta.{lang}.json 的 pages 是否与本目录该语种的实际文件集吻合，
 *      且与中文 meta.json 的页集（按该语种要求过滤后）一致（fallbackLanguage:null 下，
 *      导航列了却没有对应 .{lang}.mdx 会 404；有文件却没列进导航则用户点不到；
 *      新语种若多列了 compliance 这种不该有的项也要抓）。
 *   C. 事实不漏译：中文页里那些**必须逐字保留**的量（人民币金额、绝对 URL、
 *      QQ 群号、邮箱）是否在每个译页里原样出现。启发式，抓「翻译时把价格/端点/
 *      联系方式弄丢或改写」这类严重事故（见记忆 no-invented-facts-in-docs）。
 *      命中缺失记为 warn，不阻断，但要人看一眼。
 *
 * 增删语种：改下方 EXTRA_LOCALES（与 lib/i18n.ts 的 languages 去掉 cn 后一致）；
 * 某页只在部分语种存在（如 compliance 仅 cn/en）时，加进 PARTIAL。
 *
 * 用法：node scripts/check-i18n-parity.mjs [--json out.json]
 * 退出码：A 或 B 有问题 → 1；只有 C 的 warn → 0。
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'content/docs');
const jsonOut = (() => {
  const i = process.argv.indexOf('--json');
  return i >= 0 ? process.argv[i + 1] : null;
})();

// 附加语种（cn 是裸文件基准，不在此列）。与 lib/i18n.ts 的 languages 去掉 cn 后对应。
const EXTRA_LOCALES = ['en', 'ja', 'ko', 'es', 'pt', 'de', 'fr', 'ru', 'ar'];

// 每页「除 cn 外要求的语种」白名单。默认要求全部 EXTRA_LOCALES；只有少数页例外：
// compliance（备案）是中国大陆专属概念，只在 cn/en 存在（.ai 整页排除、新语种不译），
// 故除 cn 外只要求 en——新语种既不要求该页、出现了反而要报（见 A 的 unexpected）。
const PARTIAL = {
  'guide/compliance': ['en'],
};
const requiredLocalesFor = (s) => PARTIAL[s] ?? EXTRA_LOCALES;

// ---- 收集所有 mdx，按 slug 归拢各语种 --------------------------------------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else if (name.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}
const all = walk(ROOT);
// 语种：文件名带 .{lang}.mdx（lang∈EXTRA_LOCALES）即该语种，否则裸文件为 cn。
const LOCALE_RE = new RegExp(`\\.(${EXTRA_LOCALES.join('|')})\\.mdx$`);
const localeOf = (p) => {
  const m = relative(ROOT, p).match(LOCALE_RE);
  return m ? m[1] : 'cn';
};
// slug：剥掉 .{lang}.mdx 或裸 .mdx，得到语言无关的页标识（如 guide/models）。
const slug = (p) => relative(ROOT, p).replace(LOCALE_RE, '').replace(/\.mdx$/, '');

const bySlug = new Map(); // slug -> Set(存在的语种)
for (const p of all) {
  const s = slug(p);
  if (!bySlug.has(s)) bySlug.set(s, new Set());
  bySlug.get(s).add(localeOf(p));
}
const cn = new Set([...bySlug].filter(([, set]) => set.has('cn')).map(([s]) => s));

// ---- A. 一一对应 -----------------------------------------------------------
// missing：中文页在某要求语种缺译；orphan：某语种有页但中文没有；
// unexpected：某页在「不要求的语种」出现（如 compliance 被译进新语种，会误上 .ai）。
const missing = [];
for (const s of [...cn].sort()) {
  for (const L of requiredLocalesFor(s)) {
    if (!bySlug.get(s)?.has(L)) missing.push(`${s} [${L}]`);
  }
}
const orphan = [];
const unexpected = [];
for (const [s, locales] of [...bySlug].sort()) {
  for (const L of locales) {
    if (L === 'cn') continue;
    if (!cn.has(s)) orphan.push(`${s}.${L}`);
    else if (!requiredLocalesFor(s).includes(L)) unexpected.push(`${s}.${L}`);
  }
}
orphan.sort();
unexpected.sort();

// ---- B. 导航齐全 -----------------------------------------------------------
// 对每个含 meta.json 的目录，逐个 EXTRA_LOCALE 比对 meta.{lang}.json 与该语种实际
// 文件、以及中文 meta.json 的页集（按该语种要求过滤）。pages 里以 --- 包裹的是分节
// 标签，跳过；含 '/' 或指向子目录的是子目录引用。
const navIssues = [];
function metaDirs(dir) {
  const dirs = [];
  const rec = (d) => {
    const entries = readdirSync(d, { withFileTypes: true });
    if (entries.some((e) => e.name === 'meta.json')) dirs.push(d);
    for (const e of entries) if (e.isDirectory()) rec(join(d, e.name));
  };
  rec(dir);
  return dirs;
}
const isSep = (s) => /^---.*---$/.test(s);
for (const d of metaDirs(ROOT)) {
  const rel = relative(ROOT, d) || '.';
  const dirPrefix = rel === '.' ? '' : `${rel}/`;
  const cnMeta = JSON.parse(readFileSync(join(d, 'meta.json'), 'utf8'));
  const cnPageRefs = (cnMeta.pages ?? []).filter((s) => !isSep(s) && !s.includes('/'));
  // 子目录引用（如根 meta 里的 "guide"）：pages 项对应一个真实存在的子目录。
  const cnSubRefs = (cnMeta.pages ?? []).filter((s) => !isSep(s) && existsSync(join(d, s)));

  for (const L of EXTRA_LOCALES) {
    // 本目录在语种 L 下「应有」的页引用 = 中文页引用里 L 要求的那些（compliance 对新语种剔除）。
    const expectedPageRefs = cnPageRefs.filter((ref) =>
      requiredLocalesFor(`${dirPrefix}${ref}`).includes(L),
    );
    // 子目录只要在 L 下有任何内容即应引用；本目录树每个子目录都含非 compliance 页，
    // 故子目录引用对所有语种一致沿用中文的。
    const expectedSet = new Set([...expectedPageRefs, ...cnSubRefs]);
    if (expectedSet.size === 0) continue; // 该目录在 L 下无内容，无需 meta.{L}.json

    const metaPath = join(d, `meta.${L}.json`);
    if (!existsSync(metaPath)) {
      navIssues.push(`${rel}/: 缺 meta.${L}.json（应含 ${expectedSet.size} 项导航）`);
      continue;
    }
    const lMeta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const lPageRefs = (lMeta.pages ?? []).filter((s) => !isSep(s) && !s.includes('/'));
    const lSubRefs = (lMeta.pages ?? []).filter((s) => !isSep(s) && existsSync(join(d, s)));
    const suffix = `.${L}.mdx`;
    const lFilesHere = readdirSync(d)
      .filter((f) => f.endsWith(suffix))
      .map((f) => f.slice(0, -suffix.length));
    // B1: 导航里列了但没有对应该语种文件（且不是子目录）→ 会 404
    for (const ref of lPageRefs) {
      if (!lFilesHere.includes(ref) && !lSubRefs.includes(ref)) {
        navIssues.push(`${rel}/meta.${L}.json: 列了 "${ref}" 但无 ${ref}${suffix}（会 404）`);
      }
    }
    // B2: 有该语种文件但没列进导航 → 用户点不到（index 是落地页，约定不进 pages）
    for (const f of lFilesHere) {
      if (f === 'index') continue;
      if (!lPageRefs.includes(f)) {
        navIssues.push(`${rel}/: 有 ${f}${suffix} 但 meta.${L}.json 未收录（点不到）`);
      }
    }
    // B3/B4: 该语种导航页集应与「期望集」完全一致——既不缺（缺应有项），也不多
    //        （如新语种误列了 compliance 这种不该有的项）。
    const lSet = new Set([...lPageRefs, ...lSubRefs]);
    for (const ref of expectedSet) {
      if (!lSet.has(ref)) navIssues.push(`${rel}/meta.${L}.json: 缺应有的导航项 "${ref}"`);
    }
    for (const ref of lSet) {
      if (!expectedSet.has(ref)) navIssues.push(`${rel}/meta.${L}.json: 多出不应有的导航项 "${ref}"`);
    }
  }
}

// ---- C. 事实不漏译（启发式）------------------------------------------------
// 从中文页抽出「必须逐字保留」的 token，逐个在每个译页里找。
// URL 负字符集排除 CJK 表意字（一-鿿）、CJK 标点（　-〿：。、《》）、
// 全角形（＀-￯：；（）！），否则 https://a.com；OpenAI 会被整段吞进来。
const PATTERNS = [
  { name: '人民币金额', re: /¥[\d,]+(?:\.\d+)?/g },
  { name: '绝对URL', re: /https?:\/\/[^\s)"'`<>　-〿＀-￯一-鿿]+/g },
  { name: 'QQ群号', re: /\b\d{9,11}\b/g },
  { name: '邮箱', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
];
// 归一化 URL：去掉尾随标点
const norm = (t) => t.replace(/[.,;:、。]+$/, '');
const factWarns = [];
for (const s of [...cn].sort()) {
  const cnText = readFileSync(join(ROOT, `${s}.mdx`), 'utf8');
  for (const L of requiredLocalesFor(s)) {
    const lPath = join(ROOT, `${s}.${L}.mdx`);
    if (!existsSync(lPath)) continue; // 缺失已由 A 段报告
    const lText = readFileSync(lPath, 'utf8');
    const miss = [];
    for (const { name, re } of PATTERNS) {
      const cnTokens = new Set([...cnText.matchAll(re)].map((m) => norm(m[0])));
      for (const tok of cnTokens) {
        if (!lText.includes(tok)) miss.push(`${name}:${tok}`);
      }
    }
    if (miss.length) factWarns.push({ page: s, locale: L, missing: miss });
  }
}

// ---- 输出 ------------------------------------------------------------------
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const ok = (b) => (b ? `${G}✓${X}` : `${R}✗${X}`);
const counts = EXTRA_LOCALES.map(
  (L) => `${L}=${[...bySlug].filter(([, set]) => set.has(L)).length}`,
).join(' ');
console.log(`\n多语言对照检查  cn=${cn.size}  ${counts}\n`);

console.log('A. 一一对应');
console.log(`  ${ok(missing.length === 0)} 每篇中文页在要求语种都有译页` +
  (missing.length ? `  ${R}缺 ${missing.length}：${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}${X}` : ''));
console.log(`  ${ok(orphan.length === 0)} 无孤儿译页` +
  (orphan.length ? `  ${R}${orphan.join(', ')}${X}` : ''));
console.log(`  ${ok(unexpected.length === 0)} 无「不该出现」的译页（如 compliance 译进新语种）` +
  (unexpected.length ? `  ${R}${unexpected.join(', ')}${X}` : ''));

console.log('\nB. 导航齐全');
if (navIssues.length === 0) console.log(`  ${ok(true)} 所有 meta.{lang}.json 与文件集/中文导航一致`);
else navIssues.forEach((m) => console.log(`  ${ok(false)} ${m}`));

console.log('\nC. 事实不漏译（启发式 warn）');
if (factWarns.length === 0) console.log(`  ${ok(true)} 中文页的金额/URL/群号/邮箱在各译页均能找到`);
else {
  for (const w of factWarns) {
    console.log(`  ${Y}⚠${X} ${w.page} [${w.locale}]: 未见 ${w.missing.length} 项 ${D}${w.missing.slice(0, 6).join(' | ')}${w.missing.length > 6 ? ' …' : ''}${X}`);
  }
  console.log(`  ${D}（warn 不阻断；逐条确认是「刻意不译」还是「漏了」）${X}`);
}

const hardFail =
  missing.length > 0 || orphan.length > 0 || unexpected.length > 0 || navIssues.length > 0;
console.log('\n' + '─'.repeat(60));
console.log(hardFail ? `${R}对照未通过：A/B 有硬问题${X}` : `${G}对照通过${X}` +
  (factWarns.length ? `${Y}（C 有 ${factWarns.length} 条 warn，需人工确认）${X}` : ''));
console.log('─'.repeat(60) + '\n');

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(
    { cn: cn.size, locales: EXTRA_LOCALES, missing, orphan, unexpected, navIssues, factWarns },
    null, 2));
  console.log(`明细写入 ${jsonOut}`);
}
process.exit(hardFail ? 1 : 0);
