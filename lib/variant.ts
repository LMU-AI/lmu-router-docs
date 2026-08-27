// 站点变体开关：同一套代码库按构建期环境变量 SITE_VARIANT 产出两个站点。
//   - 未设置 / 非 'ai' → 'com'：docs.lmuai.com（国内站，中文默认，北京网关）
//   - 'ai'             → docs.lmuai.ai（海外站，英文默认，新加坡网关）
//
// 铁律：SITE_VARIANT 未设置时，本文件所有导出必须与引入变体机制之前 lib/site.ts
// 里的字面量逐字相同 —— .com 的构建产物要能与旧代码逐字节对上（发布闸门会 diff）。
// 所以 com 分支一律写死字面量，不做任何推导。
//
// 本文件是最底层模块：不 import lib/ 下任何其他模块（site.ts / i18n.ts 都要消费
// 它，反向引用会成环）。source.config.ts 走 fumadocs-mdx 自己的打包器，从那边只能
// 用相对路径引用本文件。

export type Variant = 'com' | 'ai';

export const VARIANT: Variant = process.env.SITE_VARIANT === 'ai' ? 'ai' : 'com';
export const IS_AI = VARIANT === 'ai';

// —— 站点身份 ——
export const SITE_URL = IS_AI ? 'https://docs.lmuai.ai' : 'https://docs.lmuai.com';
// OG 图右下角的裸域名（不是 URL，不拼协议）。
export const OG_DOMAIN = IS_AI ? 'docs.lmuai.ai' : 'docs.lmuai.com';

// —— API 网关 ——
// .com → 北京网关（境内线路）；.ai → 新加坡网关（海外线路）。账号/Key/计费两边通用，
// 仅端点与线路不同（已实测：两域名 /register 均 200、/v1/models 均 401 要鉴权）。
export const API_BASE_URL = IS_AI ? 'https://api.lmuai.ai' : 'https://api.lmuai.com';
// 正文里以裸主机名出现的写法（如「`api.lmuai.com` 国内可直接访问」）。
export const API_HOST = IS_AI ? 'api.lmuai.ai' : 'api.lmuai.com';
// 注册链接：主机随变体走；?ref= 推广归因参数两个站都保留。
export const REGISTER_URL = `${API_BASE_URL}/register?ref=vJaWWr4T`;

// —— 默认语言 ——
// .com 中文在裸路径（保百度既有收录）；.ai 英文在裸路径（海外受众 English-first）。
// 注意：fumadocs parser:'dot' 把「裸文件名的语言」与 defaultLanguage 绑死
// （fumadocs-core loader：裸 *.mdx 恒被标为 defaultLanguage），所以光改这里不够 ——
// ai 构建前由 scripts/materialize-variant-content.mjs 把内容树角色对调
// （*.en.mdx 变裸文件、裸中文变 *.cn.mdx），见该脚本注释。
export const DEFAULT_LANGUAGE: 'cn' | 'en' = IS_AI ? 'en' : 'cn';

// —— 统计 ——
// 两个站默认共用同一个 GA 媒体资源；将来要分开时给 .ai 构建传 SITE_GA_ID 即可。
export const GA_MEASUREMENT_ID = process.env.SITE_GA_ID ?? 'G-3YQJ477Z5W';
