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
