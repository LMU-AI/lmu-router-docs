import { buildLlmsIndex, llmsResponse } from '@/lib/llms';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 英文 llms.txt：给英文语境的生成式引擎一个发现面（英文 36 页此前在 llms 层缺席）。
// 路径含「.」→ 命中 proxy.ts matcher 的排除规则，不经 i18n 改写，直达本 handler。
export function GET() {
  return llmsResponse(buildLlmsIndex('en'));
}
