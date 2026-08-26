import { buildLlmsIndex, llmsResponse } from '@/lib/llms';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 主 llms.txt 以中文为主（.com 主市场）。英文见 /en/llms.txt。
export function GET() {
  return llmsResponse(buildLlmsIndex('cn'));
}
