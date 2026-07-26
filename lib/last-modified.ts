import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// 构建时刻，用作前两级都拿不到时的兜底。
const BUILD_TIME = new Date();

const CONTENT_DIR = resolve(process.cwd(), 'content/docs');

// scripts/build-content-dates.mjs 在 next build 之前生成，key 是相对 content/docs 的路径。
// 读不到（首次运行 / 手动 next build）就整张表为空，自动退到 mtime。
const GIT_DATES: Record<string, string> = (() => {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), 'content-dates.json'), 'utf8'));
  } catch {
    return {};
  }
})();

/**
 * 页面的最后修改时间，三级取值：git 提交时间 → 文件 mtime → 构建时刻。
 *
 * 优先 git 而非 mtime，是因为 Docker 的 `COPY . .` 会把所有文件 mtime 重置成同一
 * 时刻，只用 mtime 会让全站 lastmod 变成同一个值（等于没有信号）。git 提交时间
 * 语义上也更准确 —— 那才是内容真正变更的时间，且跨重建稳定。
 *
 * 调用方（sitemap.ts / docs page.tsx）必须保持构建期预渲染：content/ 不进入
 * standalone 产物，statSync 只在 `next build` 期间可用。切勿加 force-dynamic。
 */
export function lastModifiedOf(absolutePath?: string): Date {
  if (!absolutePath) return BUILD_TIME;

  const iso = GIT_DATES[relative(CONTENT_DIR, absolutePath)];
  if (iso) return new Date(iso);

  try {
    return statSync(absolutePath).mtime;
  } catch {
    return BUILD_TIME;
  }
}
