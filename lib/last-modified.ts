import { statSync } from 'node:fs';

// 构建时刻，用作拿不到文件 mtime 时的兜底。
const BUILD_TIME = new Date();

/**
 * 用 MDX 源文件的 mtime 作为页面的最后修改时间。
 *
 * 调用方（sitemap.ts / docs page.tsx）必须保持构建期预渲染：content/ 不进入
 * standalone 产物，statSync 只在 `next build` 期间可用。切勿加 force-dynamic。
 * 另：Docker 镜像基于 node:22-alpine 且 .dockerignore 排除了 .git，所以拿不到
 * git 提交时间，只能用 mtime。
 */
export function lastModifiedOf(absolutePath?: string): Date {
  if (!absolutePath) return BUILD_TIME;
  try {
    return statSync(absolutePath).mtime;
  } catch {
    return BUILD_TIME;
  }
}
