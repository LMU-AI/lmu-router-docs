import { buildLlmsIndex, llmsResponse } from '@/lib/llms';
import { i18n } from '@/lib/i18n';

// content/ 不进入 standalone 产物，必须构建期预渲染。
export const dynamic = 'force-static';

// 主 llms.txt 用默认语言（.com 中文 / .ai 英文）。另一语言见 /en/ 或 /cn/ 前缀版。
export function GET() {
  return llmsResponse(buildLlmsIndex(i18n.defaultLanguage));
}
