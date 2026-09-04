import { API_BASE_URL, DEFAULT_LANGUAGE, SITE_URL } from './variant';

// RFC 9727 API catalog（/.well-known/api-catalog）—— 本站是「Publisher 的文档站」，
// 列出的是 api.lmuai.* 网关真实提供的三种接入协议。route handler 与 prodcheck 的
// 断言都从这一处取数据，两边不会漂移。
//
// 铁律：只写真实存在、已实测可达的 URL。
//   - anchor 用「接入协议」页教用户填的 base URL（逐字一致），agent 读到就能直接用。
//   - 不写 service-desc（OpenAPI）——RFC 9727 §4.1 里它只是 RECOMMENDED，而网关并没有
//     发布 OpenAPI 规范（api.lmuai.*/openapi.json 等路径返回的是 SPA 兜底页，不是 spec）。
//     指向一个假 spec 比不写更糟：agent 会拿去解析然后失败。
//   - status 指向网关 GET /health（无鉴权、公网可达，返回 {"status":"ok"}）。
//   - service-doc 指向接入协议页对应协议的小节，中英各一条；锚点是线上真实渲染的 heading id。
//
// 格式：RFC 9264 linkset+json。hreflang 必须是数组、type 必须是字符串（§4.2.4.1）。

export const API_CATALOG_PATH = '/.well-known/api-catalog';
export const API_CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';
export const API_CATALOG_CONTENT_TYPE = `application/linkset+json; profile="${API_CATALOG_PROFILE}"`;

type Lang = 'cn' | 'en';

// 接入协议页路径；默认语言在裸路径、另一语言带 /{lang}，与 canonical / hreflang 规则一致
// （lib/i18n.ts localePrefix）。这里不 import i18n，免得把 fumadocs loader 链拖进
// .well-known 路由——变体层已经给出了默认语言。
const PROTOCOL_DOC_PATH = '/docs/guide/api-protocols';
const HREFLANG: Record<Lang, string> = { cn: 'zh-CN', en: 'en' };

// 每种协议在两语言页面上的小节 id（线上实测渲染结果；改标题要同步改这里，prodcheck 会验）。
const PROTOCOLS: {
  anchor: string;
  title: Record<Lang, string>;
  fragment: Record<Lang, string>;
}[] = [
  {
    // Anthropic SDK 习惯 base_url 不带 /v1（SDK 自己拼 /v1/messages）。
    anchor: API_BASE_URL,
    title: { cn: 'Anthropic 协议接入', en: 'Anthropic protocol' },
    fragment: { cn: 'anthropic-协议接入', en: 'anthropic-protocol' },
  },
  {
    // OpenAI SDK 习惯 base_url 带 /v1。
    anchor: `${API_BASE_URL}/v1`,
    title: { cn: 'OpenAI 协议接入', en: 'OpenAI protocol' },
    fragment: { cn: 'openai-协议接入', en: 'openai-protocol' },
  },
  {
    // Gemini 原生 v1beta：以主机为 base，调用完整 /v1beta/... 路径。
    anchor: `${API_BASE_URL}/v1beta`,
    title: { cn: 'Gemini 原生协议接入', en: 'Gemini native protocol' },
    fragment: { cn: 'gemini-原生协议接入', en: 'gemini-native-protocol' },
  },
];

function docUrl(lang: Lang, fragment: string): string {
  const prefix = lang === DEFAULT_LANGUAGE ? '' : `/${lang}`;
  // 中文锚点含非 ASCII，按 URL 规范做百分号编码，agent 直接 GET 也能命中。
  return `${SITE_URL}${prefix}${PROTOCOL_DOC_PATH}#${encodeURIComponent(fragment)}`;
}

export interface ApiCatalogEntry {
  anchor: string;
  'service-doc': { href: string; type: 'text/html'; hreflang: [string]; title: string }[];
  status: { href: string; type: 'application/json' }[];
}

export function buildApiCatalog(): { linkset: ApiCatalogEntry[] } {
  // 默认语言的文档放前面，与站点自身的语言优先级一致。
  const langs: Lang[] = DEFAULT_LANGUAGE === 'en' ? ['en', 'cn'] : ['cn', 'en'];
  return {
    linkset: PROTOCOLS.map((p) => ({
      anchor: p.anchor,
      'service-doc': langs.map((lang) => ({
        href: docUrl(lang, p.fragment[lang]),
        type: 'text/html' as const,
        hreflang: [HREFLANG[lang]] as [string],
        title: p.title[lang],
      })),
      status: [{ href: `${API_BASE_URL}/health`, type: 'application/json' as const }],
    })),
  };
}
