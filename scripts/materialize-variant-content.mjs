#!/usr/bin/env node
// 物化 .ai 变体的内容树（SITE_VARIANT=ai 时才做事，否则直接退出）。
//
// 为什么存在：fumadocs parser:'dot' 把「裸文件名的语言」与 defaultLanguage 绑死
// （fumadocs-core loader 里裸 *.mdx 恒被标为 defaultLanguage）。.ai 站英文放根路径
// ⟺ defaultLanguage='en' ⟺ 裸文件物理上必须是英文 —— 三者绑定，光翻 lib/variant.ts
// 里的 DEFAULT_LANGUAGE 会把 37 个中文裸文件误标成 en 并与 .en.mdx 冲突。
//
// 做法：把 content/docs 复制成 content-ai/docs 并对调语言角色（仓库真文件一个不动，
// 本地跑 SITE_VARIANT=ai npm run build 也安全）：
//   X.en.mdx    → X.mdx      （英文成为裸文件 → defaultLanguage='en' 下标为 en）
//   X.mdx       → X.cn.mdx   （中文标为 cn）
//   meta.en.json → meta.json；meta.json → meta.cn.json
// 同时：
//   1. 全文替换 api.lmuai.com → api.lmuai.ai（.ai 站的配置端点；business@lmuai.com、
//      docs.lmuai.com 不含该子串，天然不受影响）。在文件字节层做而不是 remark 层做，
//      是因为这样正文、代码块、行内代码、链接、frontmatter 一次全覆盖，且发生在
//      一切处理（搜索索引、llms postprocess）之前，不存在传播遗漏。
//   2. frontmatter 区（首个 --- 包围块）内应用 FRONTMATTER_PHRASES 定位话术替换
//      （正文的定位差异走 <CN>/<Intl> 标记 + lib/remark-variant.ts，不在这里动）。
//   3. 把 content-dates.json 的 key 按同样的改名规则重映射成 content-ai-dates.json ——
//      不然 lib/last-modified.ts 查不到 git 时间、退回被 Docker COPY 抹平的 mtime，
//      全站 lastmod 变成同一天（sitemap 的日期信号即失效）。
//
// 在 package.json 的 build 里跑在 build-content-dates.mjs 之后、next build 之前。

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const SRC = 'content/docs';
const OUT_ROOT = 'content-ai';
const OUT = join(OUT_ROOT, 'docs');
const DATES_IN = 'content-dates.json';
const DATES_OUT = 'content-ai-dates.json';

// —— .ai 变体的端点替换（精确字面量，主机名级） ——
const HOST_FROM = 'api.lmuai.com';
const HOST_TO = 'api.lmuai.ai';

// —— .ai 变体排除的整页 ——
// 合规/备案是中国大陆专属概念（ICP / 公安 / 人工智能服务备案、账户数据境内驻留），
// 对海外新加坡线路（api.lmuai.ai）并不成立，放到 .ai 站会误导用户。故整页排除，
// 中英两版都不物化。相对 content/docs 的路径为 key。配套还要摘掉导航 meta 里的
// slug 与其它页的交叉链接（见 COMPLIANCE_LINKS），并在物化后做断链兜底扫描（文件末尾）。
const VARIANT_EXCLUDE = new Set([
  'guide/compliance.mdx',
  'guide/compliance.en.mdx',
]);

// —— 随排除页一并摘除的交叉引用（整块精确字符串） ——
// 在 transform() 最前面跑（早于端点/语言前缀替换），故按原文口径写 /docs、/en/docs。
// 中英字符串各自只出现在对应语言文件里，全局 split/join 不会互串。若将来措辞变动
// 导致这里匹配不上，文件末尾的断链扫描会让 .ai 构建**响亮失败**，不静默漏断链上线。
// 来源行号截至本次改动：
const COMPLIANCE_LINKS = [
  // 导航 meta.json / meta.en.json 的 pages 数组（compliance 为最后一项）
  ', "compliance"',
  // index.mdx:52 / index.en.mdx:63（列表整条 bullet，连前导换行一起删）
  '\n- [合规与备案](/docs/guide/compliance) — ICP / 公安备案可查验，合同、发票、DPA 支持',
  '\n- [Compliance & filings](/en/docs/guide/compliance) — verifiable ICP / public-security filings, contracts, invoices, DPA',
  // enterprise.mdx:81 / enterprise.en.mdx:81（段落内句子；删后前一句「…给出建议。」/「…requirements.」自然收尾）
  '备案、数据驻留、合同发票与 DPA 等合规事项的速查见[合规与备案](/docs/guide/compliance)。',
  ' For filings, data residency, contracts, invoices and DPA, see [Compliance & filings](/en/docs/guide/compliance).',
  // privacy.mdx:130 / privacy.en.mdx:130（段落首句；删后「企业档客户…」/「Enterprise customers…」成为段首）
  '备案信息、合同发票与合规事项速查见[合规与备案](/docs/guide/compliance)。',
  'For filings, contracts, invoices and a compliance checklist, see [Compliance & filings](/en/docs/guide/compliance). ',
];

// —— frontmatter 区的定位话术替换（枚举对，只在 frontmatter 块内生效） ——
// 只替换对新加坡线路**为假**的断言（网关在境内/国内直连/domestic）；对海外仍然
// 成立的话术（如 no proxy needed —— 海外直连 api.lmuai.ai 确实无需代理）保留。
// 每一对都只陈述已核实事实（新加坡节点、境外直连、账号打通），不得出现编造的
// 延迟/在线率数字。正文的定位差异不走这里，走 <CN>/<Intl> 标记（lib/remark-variant.ts）。
// 顺序敏感：具体长句在前，泛化短语兜底在后。跑在端点替换之前（原文口径书写）。
const FRONTMATTER_PHRASES = [
  // —— cn 整句（faq 答案 / ogDescription） ——
  ['可以。接入网关部署在中国国内，国内网络可直接调用，无需自建代理或科学上网。',
   '可以。海外接入网关部署在新加坡节点，境外网络可直接调用。'],
  ['不需要。灵眸接入网关部署在中国国内，国内网络可直接调用，无需 VPN 或代理。',
   '可以直接使用。海外接入网关部署在新加坡节点，境外网络可直接调用，无需 VPN 或代理。'],
  ['灵眸网关部署在中国境内、国内直连，关闭所有代理后重试即可',
   '灵眸海外网关部署在新加坡节点、境外直连，关闭所有代理后重试即可'],
  ['不需要。灵眸接入网关部署在中国境内，api.lmuai.com 国内直连即可获得最快速度与最稳定的连接。',
   '可以。灵眸海外网关部署在新加坡节点，api.lmuai.com 境外直连即可。'],
  ['国内能直接使用吗，需要科学上网吗？', '海外能直接使用吗？'],
  ['国内能直接使用吗？', '海外能直接使用吗？'],
  ['灵眸 API 需要科学上网吗？', '灵眸 API 境外可以直连吗？'],
  // —— cn 短语 / 关键词 ——
  ['国内直连、低延迟、多源故障转移', '境外直连、多源故障转移'],
  ['国内直连免代理', '境外直连'],
  ['国内直连、免代理', '境外直连'],
  ['国内免代理', '境外直连'],
  ['国内直连', '境外直连'],
  ['免代理使用', '直连使用'],
  ['免代理 Claude API', '海外直连 Claude API'],
  ['国内可用 Claude API', '海外可用 Claude API'],
  ['Claude 国内中转', 'Claude 海外中转'],
  ['Gemini API 国内中转', 'Gemini API 海外中转'],
  ['Claude Code 国内使用', 'Claude Code 海外使用'],
  ['Claude Desktop 国内', 'Claude Desktop'],
  ['桌面版国内接入', '桌面版接入'],
  ['Cherry Studio 国内使用', 'Cherry Studio 海外使用'],
  ['国内网络直连使用', '海外网络直连使用'],
  // 泛化兜底（务必放在所有具体 cn 对之后）：frontmatter 里残余的裸「免代理」
  // （如 keywords 的「Codex 免代理」）统一改为海外口径。
  ['免代理', '境外直连'],
  // —— en 整句（faq 答案） ——
  ['The LMU AI gateway is hosted inside mainland China with direct domestic access — turn off every proxy and retry.',
   'The LMU AI overseas gateway runs on a Singapore node with direct access — turn off every proxy and retry.'],
  ['No. The LMU AI gateway is hosted inside mainland China; api.lmuai.com is reachable directly from within China for the fastest, most stable connection.',
   'Yes, directly. The LMU AI overseas gateway runs on a Singapore node; api.lmuai.com is reachable directly from outside mainland China.'],
  ['Does the LMU AI API need a VPN?', 'Can I reach the LMU AI API directly from overseas?'],
  // —— en 整句（工具页 faq 答案） ——
  ["it's a direct domestic connection with no proxy", "it connects directly with no proxy"],
  ['The LMU AI API domain `api.lmuai.com` is a direct domestic connection, so once', 'The LMU AI API domain `api.lmuai.com` connects directly, so once'],
  ['`api.lmuai.com` is a direct domestic connection. But', '`api.lmuai.com` connects directly. But'],
  ['which may still need network optimization in China', 'which in some regions may still need network optimization'],
  // —— en 短语 / 关键词 ——
  ['is hosted inside mainland China', 'runs on a Singapore node'],
  ['direct connection in China with no proxy', 'direct overseas connection'],
  ['a direct connection in China and no proxy needed', 'a direct overseas connection'],
  ['a direct connection in China and no proxy', 'a direct overseas connection'],
  ['direct connection in China, no proxy', 'direct overseas connection'],
  ['connects directly in China', 'connects directly from overseas'],
  ['no proxy needed in China', 'a direct overseas connection'],
  ['direct connection on domestic networks', 'direct overseas connection'],
  ['with direct domestic access', 'with direct overseas access'],
  ['LMU AI is a direct domestic connection', 'the LMU AI overseas gateway connects directly'],
  ['Connect the Claude Code desktop app from China:', 'Connect the Claude Code desktop app:'],
  ['Claude Desktop in China', 'Claude Desktop'],
  ['with no proxy in China', 'with no proxy'],
  ['all with no proxy in China', 'all with no proxy'],
];

// —— .ai 物化产物的兜底扫描 ——
// 上面的字典是枚举式的：将来内容里新增一句大陆话术，字典不会自动覆盖。
// 这里在物化完成后对产物做禁词扫描（正文里 <CN>…</CN> 块除外——那是刻意保留、
// 会被 remark 在 .ai 构建时删除的大陆版内容），扫到即失败，别让它静默上线。
// 注意禁词只列「对海外为假」的断言；「中国国内」（privacy 页数据存储事实）、
// 「科学上网」（claude-code-desktop 讲下载官方客户端的大陆语境建议）不在列。
const BANNED_AI_PHRASES = [
  '国内直连', '免代理', '无需魔法',
  'inside mainland China', 'direct domestic', 'directly in China',
  'direct connection in China', 'no proxy in China', 'proxy-free',
];
const stripCnBlocks = (s) => s.replace(/<CN>[\s\S]*?<\/CN>/g, '');

function renameFor(name) {
  // 目录内的文件名（不含路径）。返回 null 表示跳过该文件。
  if (name === '.DS_Store') return null;
  if (name.endsWith('.en.mdx')) return name.slice(0, -'.en.mdx'.length) + '.mdx';
  if (name.endsWith('.mdx')) return name.slice(0, -'.mdx'.length) + '.cn.mdx';
  if (name === 'meta.en.json') return 'meta.json';
  if (name === 'meta.json') return 'meta.cn.json';
  return name; // 其他资源原样
}

function transform(content, role) {
  let out = content;
  // 0) 摘除被排除页（compliance）的交叉引用与导航 slug。放最前：这些串按原文
  //    /docs、/en/docs 前缀书写，须早于下面的端点/语言前缀替换。
  for (const s of COMPLIANCE_LINKS) out = out.split(s).join('');
  // 1) 定位话术：只动 frontmatter 块（--- 与 --- 之间）。先于端点替换跑，
  //    使字典可以按原文（api.lmuai.com）口径书写。
  if (out.startsWith('---\n')) {
    const end = out.indexOf('\n---', 4);
    if (end !== -1) {
      let fm = out.slice(0, end);
      for (const [from, to] of FRONTMATTER_PHRASES) fm = fm.split(from).join(to);
      out = fm + out.slice(end);
    }
  }
  // 2) 端点主机名：全文替换（frontmatter + 正文 + 代码块一次覆盖）。
  out = out.split(HOST_FROM).join(HOST_TO);
  // 3) 站内链接的语言前缀随角色对调（.ai 上英文在裸路径、中文带 /cn）：
  //    - 英文文件（对调后为裸文件）：](/en/docs… → ](/docs…
  //    - 中文文件（对调后带 .cn）：](/docs… → ](/cn/docs…
  //    只认 markdown 链接标记 ](/，不会碰代码块里的普通路径；相对链接（./faq）两边通用不用动。
  //    内容里两类前缀各自纯净（en 文件 0 个 ](/docs、cn 文件 0 个 ](/en，已核），无互串风险。
  if (role === 'en') out = out.split('](/en/docs').join('](/docs');
  else if (role === 'cn') out = out.split('](/docs').join('](/cn/docs');
  return out;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

if (process.env.SITE_VARIANT !== 'ai') {
  console.log('· SITE_VARIANT ≠ ai：跳过内容树物化（.com 构建直接用 content/docs）');
  process.exit(0);
}

rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let pages = 0;
for (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  if (VARIANT_EXCLUDE.has(rel)) continue; // .ai 排除整页（compliance），不物化
  const base = rel.split('/').pop();
  const newName = renameFor(base);
  if (newName === null) continue;
  // 语言角色：原 *.en.* → 对调后是默认语言（en）；其余 mdx/meta → 中文（cn）。
  const role = /\.en\.(mdx|json)$/.test(base) ? 'en' : 'cn';
  const dest = join(OUT, join(dirname(rel), newName));
  mkdirSync(dirname(dest), { recursive: true });
  if (/\.(mdx|json)$/.test(newName)) {
    writeFileSync(dest, transform(readFileSync(src, 'utf8'), role));
    if (newName.endsWith('.mdx')) pages++;
  } else {
    cpSync(src, dest);
  }
}

// 禁词兜底扫描（见 BANNED_AI_PHRASES 注释）。
const violations = [];
for (const p of walk(OUT)) {
  if (!/\.(mdx|json)$/.test(p)) continue;
  const body = stripCnBlocks(readFileSync(p, 'utf8'));
  for (const phrase of BANNED_AI_PHRASES) {
    if (body.includes(phrase)) violations.push(`${p}: ${phrase}`);
  }
}
if (violations.length > 0) {
  console.error('✗ .ai 物化产物含大陆定位话术（新增内容未包 <CN> 或未加字典对）：');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}

// 断链兜底扫描（VARIANT_EXCLUDE / COMPLIANCE_LINKS）：排除页删干净后，产物里不应
// 再出现指向 compliance 的站内链接（/docs/guide/compliance、/cn|en/… 皆含此子串），
// 导航 meta 里也不应残留 "compliance" slug。若某条交叉引用因措辞变动没匹配上，
// 这里让构建响亮失败，而不是把断链/空导航项静默发到 .ai。
const danglers = [];
for (const p of walk(OUT)) {
  const bn = p.split('/').pop();
  if (!/\.(mdx|json)$/.test(bn)) continue;
  const body = readFileSync(p, 'utf8');
  if (body.includes('docs/guide/compliance')) danglers.push(`${p}: 残留链接`);
  if (/^meta(\.cn)?\.json$/.test(bn) && body.includes('"compliance"')) danglers.push(`${p}: 残留导航项`);
}
if (danglers.length > 0) {
  console.error('✗ .ai 物化产物残留 compliance 引用（交叉引用措辞可能已改，请更新 COMPLIANCE_LINKS）：');
  for (const d of danglers) console.error('  ' + d);
  process.exit(1);
}

// 日期表重映射：key 是相对 content/docs 的路径，按同样规则改名。
let dateCount = 0;
if (existsSync(DATES_IN)) {
  const dates = JSON.parse(readFileSync(DATES_IN, 'utf8'));
  const remapped = {};
  for (const [key, iso] of Object.entries(dates)) {
    if (VARIANT_EXCLUDE.has(key)) continue; // 排除页不留日期
    const parts = key.split('/');
    const newName = renameFor(parts.pop());
    if (newName === null) continue;
    remapped[[...parts, newName].join('/')] = iso;
  }
  writeFileSync(DATES_OUT, JSON.stringify(remapped, null, 2) + '\n');
  dateCount = Object.keys(remapped).length;
}

console.log(`✓ content-ai/docs：${pages} 个 MDX 已物化（en↔cn 角色对调、端点→${HOST_TO}、compliance 整页排除）；日期重映射 ${dateCount} 条`);
