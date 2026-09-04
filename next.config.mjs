import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Agent 发现用的 Link 头值（RFC 8288）。/llms.txt 在默认语言裸路径，两站各自正确。
// /auth.md 不在这里：Auth.md 没有定义/注册 Link 关系类型，agent 按固定路径发现它；
// 自造一个 rel URI 就是编造，不做。
const AGENT_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
].join(', ');

/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // 24 张工具截图目前按 PNG 发（Obsidian / Cherry Studio 那几张 UI 大图尤其大），
    // 转 AVIF/WebP 是图片密集页 LCP 的直接收益。
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        // Agent 发现（RFC 8288 Link 头）：根路径与文档首页（含两个语言前缀）都带上——
        // 扫描器/agent 读 / 时拿到 308，跟到 /docs 再读一次，两处都要能看到。
        //   api-catalog → RFC 9727 目录（/.well-known/api-catalog）
        //   describedby → 本站的机器可读说明（llms.txt）
        // 只指向真实存在的资源；相对路径按响应的 origin 解析，两站各自正确。
        source: '/',
        headers: [{ key: 'Link', value: AGENT_LINK_HEADER }],
      },
      {
        source: '/:lang(cn|en)?/docs',
        headers: [{ key: 'Link', value: AGENT_LINK_HEADER }],
      },
    ];
  },
};

export default withMDX(config);
