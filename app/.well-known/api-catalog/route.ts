import {
  API_CATALOG_CONTENT_TYPE,
  API_CATALOG_PATH,
  buildApiCatalog,
} from '@/lib/api-catalog';

// RFC 9727 API catalog：/.well-known/api-catalog。内容与取舍见 lib/api-catalog.ts。
//
// §2 要求：GET 返回 catalog 文档；HEAD 的响应要带 rel="api-catalog" 的 Link 头
// （Next 用 GET handler 自动应答 HEAD，所以头直接挂在这个响应上）。
// 路径带「.」，proxy.ts 的 matcher 不会对它做语言改写。纯静态，构建期定死。
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(buildApiCatalog(), null, 2) + '\n', {
    headers: {
      'Content-Type': API_CATALOG_CONTENT_TYPE,
      Link: `<${API_CATALOG_PATH}>; rel="api-catalog"`,
    },
  });
}
