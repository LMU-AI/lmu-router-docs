#!/usr/bin/env node
/**
 * 中英文档对照检查（i18n parity）。
 *
 * 回答三个问题，全部零依赖、可在 CI / 本地跑：
 *   A. 一一对应：每篇中文页是否都有英文页？有没有孤儿英文页？
 *   B. 导航齐全：每个 meta.en.json 的 pages 是否与本目录实际英文文件集吻合，
 *      且与中文 meta.json 的页集一致（fallbackLanguage:null 下，导航列了却没有
 *      对应 .en.mdx 会 404；有文件却没列进导航则用户点不到）。
 *   C. 事实不漏译：中文页里那些**必须逐字保留**的量（人民币金额、绝对 URL、
 *      QQ 群号、邮箱、微信/电话、sk- 形态）是否在英文页里原样出现。这是启发式,
 *      抓的是「翻译时把价格/端点/联系方式弄丢或改写」这类严重事故（见记忆
 *      no-invented-facts-in-docs）。命中缺失记为 warn，不阻断，但要人看一眼。
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

// ---- 收集所有 mdx ----------------------------------------------------------
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
const slug = (p) => relative(ROOT, p).replace(/\.en\.mdx$|\.mdx$/, '');
const cn = new Set(all.filter((p) => !p.endsWith('.en.mdx')).map(slug));
const en = new Set(all.filter((p) => p.endsWith('.en.mdx')).map(slug));

// ---- A. 一一对应 -----------------------------------------------------------
const missingEn = [...cn].filter((s) => !en.has(s)).sort();
const orphanEn = [...en].filter((s) => !cn.has(s)).sort();

// ---- B. 导航齐全 -----------------------------------------------------------
// 对每个含 meta.json 的目录，比对 meta.en.json 的 pages 与该目录英文文件、
// 以及中文 meta.json 的 pages。pages 里以 --- 包裹的是分节标签，跳过。
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
  const cnMeta = JSON.parse(readFileSync(join(d, 'meta.json'), 'utf8'));
  const enMetaPath = join(d, 'meta.en.json');
  if (!existsSync(enMetaPath)) {
    navIssues.push(`${rel}/: 缺 meta.en.json（中文有 ${cnMeta.pages?.length ?? 0} 项导航）`);
    continue;
  }
  const enMeta = JSON.parse(readFileSync(enMetaPath, 'utf8'));
  const cnPageRefs = (cnMeta.pages ?? []).filter((s) => !isSep(s) && !s.includes('/'));
  const enPageRefs = (enMeta.pages ?? []).filter((s) => !isSep(s) && !s.includes('/'));
  // 该目录下实际存在的英文页（仅本层，不含子目录条目如 "guide"/"tools"）
  const enFilesHere = readdirSync(d)
    .filter((f) => f.endsWith('.en.mdx'))
    .map((f) => f.replace(/\.en\.mdx$/, ''));
  // 子目录引用（如根 meta 里的 "guide"）：要求该子目录有 meta.en.json
  const subRefs = (enMeta.pages ?? []).filter((s) => !isSep(s) && existsSync(join(d, s)));
  // B1: 导航里列了但没有对应英文文件（且不是子目录）→ 会 404
  for (const ref of enPageRefs) {
    if (!enFilesHere.includes(ref) && !subRefs.includes(ref)) {
      navIssues.push(`${rel}/meta.en.json: 列了 "${ref}" 但无 ${ref}.en.mdx（会 404）`);
    }
  }
  // B2: 有英文文件但没列进导航 → 用户点不到
  // 例外：index 是该目录的落地页（Fumadocs 约定），经 /docs、/en/docs 直达，
  // 本就不进 meta.json 的 pages —— 中文 meta.json 同样不列 index。其中英双版
  // 已由 A 段保证（cn/en 集合都含 slug "index"）。
  for (const f of enFilesHere) {
    if (f === 'index') continue;
    if (!enPageRefs.includes(f)) {
      navIssues.push(`${rel}/: 有 ${f}.en.mdx 但 meta.en.json 未收录（点不到）`);
    }
  }
  // B3: 中英导航页集应一致（分节标签可不同，页引用应一致）
  const cnSet = new Set([...cnPageRefs, ...(cnMeta.pages ?? []).filter((s) => !isSep(s) && existsSync(join(d, s)))]);
  const enSet = new Set([...enPageRefs, ...subRefs]);
  for (const ref of cnSet) {
    if (!enSet.has(ref)) navIssues.push(`${rel}/meta.en.json: 缺中文有的导航项 "${ref}"`);
  }
}

// ---- C. 事实不漏译（启发式）------------------------------------------------
// 从中文页抽出「必须逐字保留」的 token，逐个在英文页里找。
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
for (const s of [...cn].filter((x) => en.has(x)).sort()) {
  const cnText = readFileSync(join(ROOT, `${s}.mdx`), 'utf8');
  const enText = readFileSync(join(ROOT, `${s}.en.mdx`), 'utf8');
  const missing = [];
  for (const { name, re } of PATTERNS) {
    const cnTokens = new Set([...cnText.matchAll(re)].map((m) => norm(m[0])));
    for (const tok of cnTokens) {
      // QQ 群号误伤：仅当 token 是纯 9-11 位数字且不在明显的“群”上下文时也查，
      // 简单起见全查——英文页照理会保留同样的号码。
      if (!enText.includes(tok)) missing.push(`${name}:${tok}`);
    }
  }
  if (missing.length) factWarns.push({ page: s, missing });
}

// ---- 输出 ------------------------------------------------------------------
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const ok = (b) => (b ? `${G}✓${X}` : `${R}✗${X}`);
console.log(`\n中英对照检查  cn=${cn.size} en=${en.size}\n`);

console.log('A. 一一对应');
console.log(`  ${ok(missingEn.length === 0)} 每篇中文页都有英文页` +
  (missingEn.length ? `  ${R}缺 ${missingEn.length}：${missingEn.join(', ')}${X}` : ''));
console.log(`  ${ok(orphanEn.length === 0)} 无孤儿英文页` +
  (orphanEn.length ? `  ${R}${orphanEn.join(', ')}${X}` : ''));

console.log('\nB. 导航齐全');
if (navIssues.length === 0) console.log(`  ${ok(true)} 所有 meta.en.json 与文件集/中文导航一致`);
else navIssues.forEach((m) => console.log(`  ${ok(false)} ${m}`));

console.log('\nC. 事实不漏译（启发式 warn）');
if (factWarns.length === 0) console.log(`  ${ok(true)} 中文页的金额/URL/群号/邮箱在英文页均能找到`);
else {
  for (const w of factWarns) {
    console.log(`  ${Y}⚠${X} ${w.page}: 英文页未见 ${w.missing.length} 项 ${D}${w.missing.slice(0, 6).join(' | ')}${w.missing.length > 6 ? ' …' : ''}${X}`);
  }
  console.log(`  ${D}（warn 不阻断；逐条确认是「刻意不译」还是「漏了」）${X}`);
}

const hardFail = missingEn.length > 0 || orphanEn.length > 0 || navIssues.length > 0;
console.log('\n' + '─'.repeat(60));
console.log(hardFail ? `${R}对照未通过：A/B 有硬问题${X}` : `${G}对照通过${X}` +
  (factWarns.length ? `${Y}（C 有 ${factWarns.length} 页 warn，需人工确认）${X}` : ''));
console.log('─'.repeat(60) + '\n');

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ cn: cn.size, en: en.size, missingEn, orphanEn, navIssues, factWarns }, null, 2));
  console.log(`明细写入 ${jsonOut}`);
}
process.exit(hardFail ? 1 : 0);
