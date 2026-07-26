// 检查文档里引用的模型 ID 是否都还在 lib/models.ts 的清单内。
// 手动运行：npm run check:models（刻意不挂进 build —— 文档可能合理地
// 提到已下线模型，硬门禁会阻塞正常发布）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'content/docs';
const KNOWN = new Set(
  readFileSync('lib/models.ts', 'utf8')
    .matchAll(/id: '([^']+)'/g)
    .map((m) => m[1]),
);

// 只认长得像模型 ID 的 inline code：厂商前缀 + 后面跟着版本号
const CANDIDATE =
  /`((?:claude|gpt|qwen|deepseek|MiniMax|glm|kimi|mimo|gemini|grok)[a-zA-Z0-9._-]*\d[a-zA-Z0-9._-]*)`/g;

// 刻意提及的非灵眸模型：作为反例或占位符出现，不该报错
const INTENTIONAL = new Set([
  'gpt-4', // cursor.mdx：填任意 OpenAI 模型名过 Verify 的绕坑步骤
  'gpt-5.3-codex', // codex-cli-*.mdx：说明它不支持 1M 上下文的反例
]);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.mdx')) yield path;
  }
}

let stale = 0;
for (const file of walk(CONTENT_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [, id] of line.matchAll(CANDIDATE)) {
      // 去掉 [1M] 之类的后缀再比对
      const base = id.replace(/\[.*$/, '');
      if (!KNOWN.has(base) && !INTENTIONAL.has(base)) {
        console.log(`${file}:${i + 1}  ${base}`);
        stale++;
      }
    }
  });
}

console.log(stale === 0 ? '✓ 所有模型引用均有效' : `\n✗ ${stale} 处引用不在模型清单内`);
process.exit(0);
