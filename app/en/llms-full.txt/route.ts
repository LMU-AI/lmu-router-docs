import { buildLlmsFull, llmsResponse } from '@/lib/llms';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 英文全文 llms-full.txt。
export async function GET() {
  return llmsResponse(await buildLlmsFull('en'));
}
