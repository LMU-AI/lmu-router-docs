import { INDEXNOW_KEY } from '@/lib/variant';

// /indexnow-key.txt —— IndexNow 的域名归属校验文件：搜索引擎收到推送后来取这里，
// 内容必须与提交时的 key 逐字相同（key 与缘由见 lib/variant.ts）。
//
// 官方默认是把文件放在根目录且「文件名即 key」（/<key>.txt），本仓库做不到：路由目录名
// 是字面量、无法随 SITE_VARIANT 变，而两站各有一把 key。故用规范里的第二种方式 ——
// 固定路径 + 提交时带 keyLocation 指向它（scripts/indexnow.mjs 负责）。
//
// 路径带「.」，proxy.ts 的 matcher 不会对它做语言改写。纯静态，构建期定死。
export const dynamic = 'force-static';

export function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
