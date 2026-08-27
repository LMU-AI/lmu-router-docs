import { buildLlmsFull, llmsResponse } from '@/lib/llms';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 中文全文 llms-full.txt 的带前缀入口（说明见 app/cn/llms.txt/route.ts）。
export async function GET() {
  return llmsResponse(await buildLlmsFull('cn'));
}
