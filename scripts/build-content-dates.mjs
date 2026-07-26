// 把每篇 MDX 的 git 最后提交时间物化成 content-dates.json，供 lib/last-modified.ts 读取。
// 为什么不能直接用文件 mtime：Dockerfile 的 `COPY . .` 会把所有文件 mtime 重置成
// 同一时刻，导致生产 sitemap 里 36 个 URL 共享同一个 lastmod —— 这比没有 lastmod
// 更糟，Google 判定该字段不可信后会长期忽略它。
//
// content-dates.json 随仓库提交，Docker 构建上下文里**没有** .git（.dockerignore
// 屏蔽了，理由见那里的注释：CI 的 cache mode=max 会把 builder 层连同 .git 里的
// GITHUB_TOKEN 一起发到公开 registry）。所以本脚本在无 git 时必须**保留**已提交的
// JSON 而不是覆盖成空表 —— 否则 lastmod 会静默退回 mtime，正好是本文件要修的 bug。
// 挂在 build 前（npm run build），任何情况下都不阻塞构建。
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const CONTENT_DIR = 'content/docs';
const OUT = 'content-dates.json';

// 没有 .git（Docker 构建上下文 / 打包下载的源码）就直接沿用已提交的 JSON。
try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  const kept = existsSync(OUT);
  console.log(
    kept
      ? `✓ 无 git 仓库，沿用已提交的 ${OUT}（未覆盖）`
      : `! 无 git 仓库且缺 ${OUT}，lastmod 将回落到 mtime`,
  );
  process.exit(0);
}

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
