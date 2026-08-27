import { buildLlmsIndex, llmsResponse } from '@/lib/llms';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 中文 llms.txt 的带前缀入口。裸 /llms.txt 服务默认语言（.com 中文 / .ai 英文），
// 本路由让中文在 .ai（英文默认）上仍有稳定发现面；在 .com 上与裸版本内容相同，
// 与 /cn/docs 同理（canonical 去重、站内不外链）。
// 路径含「.」→ 命中 proxy.ts matcher 的排除规则，不经 i18n 改写，直达本 handler。
export function GET() {
  return llmsResponse(buildLlmsIndex('cn'));
}
