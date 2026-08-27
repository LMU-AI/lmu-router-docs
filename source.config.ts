import { defineDocs, defineConfig, frontmatterSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';
// 本文件由 fumadocs-mdx 单独打包，'@/' 别名不保证解析 —— 只用相对路径。
import { remarkVariant } from './lib/remark-variant';

export const docs = defineDocs({
  // .ai 变体读 scripts/materialize-variant-content.mjs 物化出的角色对调内容树
  // （英文为裸文件、中文带 .cn 后缀，端点已换成 api.lmuai.ai）。目录不存在说明
  // 忘了跑物化脚本 —— 让构建响亮地失败，别静默退回中文树。
  dir: process.env.SITE_VARIANT === 'ai' ? 'content-ai/docs' : 'content/docs',
  docs: {
    schema: frontmatterSchema.extend({
      keywords: z.array(z.string()).optional(),
      ogDescription: z.string().optional(),
      alternateNames: z.array(z.string()).optional(),
      faq: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .optional(),
    }),
    // 供 /llms-full.txt 使用。ModelCard 等自闭合 JSX 在默认的 filterElement 下
    // 会被判为 'children-only'，而它没有 children —— 输出会是空字符串。列进
    // mdxAsPlaceholder 后至少保留结构。
    postprocess: {
      includeProcessedMarkdown: {
        mdxAsPlaceholder: ['ModelCard', 'ModelGrid', 'Mermaid'],
      },
    },
  },
});

export default defineConfig({
  mdxOptions: {
    // remarkVariant 处理正文里的 <CN>/<Intl> 分站标记（.com 保留 CN、.ai 保留 Intl）。
    // 它跑在 fumadocs 的 remarkStructure（搜索索引）与 remarkPostprocess（llms 用的
    // processed markdown）之前，拆封结果会一并进入页面、搜索与 llms 三个面。
    remarkPlugins: [remarkVariant],
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'houston',
      },
    },
  },
});
