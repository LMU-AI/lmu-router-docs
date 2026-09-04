import { buildAuthMd } from '@/lib/auth-md';

// /auth.md（Auth.md 自包含形态，内容与取舍见 lib/auth-md.ts）。
// 路径带「.」，proxy.ts 的 matcher 不会对它做语言改写。纯静态，构建期定死。
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildAuthMd(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
