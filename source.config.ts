import { defineDocs, defineConfig, frontmatterSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
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
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'houston',
      },
    },
  },
});
