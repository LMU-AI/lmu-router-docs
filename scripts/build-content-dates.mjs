// 把每篇 MDX 的 git 最后提交时间物化成 content-dates.json，供 lib/last-modified.ts 读取。
// 为什么不能直接用文件 mtime：Dockerfile 的 `COPY . .` 会把所有文件 mtime 重置成
// 同一时刻，导致生产 sitemap 里 36 个 URL 共享同一个 lastmod —— 这比没有 lastmod
// 更糟，Google 判定该字段不可信后会长期忽略它。
// 挂在 build 前（npm run build），失败不阻塞构建：拿不到 git 就回落到 mtime。
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const CONTENT_DIR = 'content/docs';
const OUT = 'content-dates.json';

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.mdx')) yield path;
  }
}

const dates = {};
let missing = 0;

for (const file of walk(CONTENT_DIR)) {
  let iso = '';
  try {
    iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // 无 git（浅克隆 / 非仓库）—— 留空，运行时回落到 mtime
  }
  // 未提交的新文件 git log 返回空字符串，同样回落
  if (iso) dates[relative(CONTENT_DIR, file)] = iso;
  else missing++;
}

writeFileSync(OUT, JSON.stringify(dates, null, 2) + '\n');
console.log(
  `✓ ${OUT}：${Object.keys(dates).length} 篇有 git 时间` +
    (missing > 0 ? `，${missing} 篇回落到 mtime` : ''),
);
