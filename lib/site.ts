// 域名 / API 端点 / 注册链接随站点变体走（.com 国内站 / .ai 海外站），
// 单一事实源在 lib/variant.ts；这里 re-export 维持既有 import 路径不变。
export { SITE_URL, API_BASE_URL, API_HOST, REGISTER_URL } from './variant';

export const SITE_NAME = '灵眸文档';
export const SITE_SHORT_NAME = '灵眸';
export const SITE_SHORT_NAME_EN = 'LMU AI';
export const SITE_DESCRIPTION =
  '灵眸 AI API 使用文档：支持 Gemini、GPT、Grok 文生图和图片编辑、Gemini 批量生图，以及 Claude Code / Codex CLI / Cursor 等主流 AI 工具接入。';

import { IS_AI } from './variant';

// 英文站点文案（用于 /en 页面的 <html lang>、metadata、JSON-LD）。忠实翻译，不新增事实。
export const SITE_NAME_EN = 'LMU AI Docs';
export const SITE_DESCRIPTION_EN =
  'LMU AI (Lingmou AI) API documentation: a stable, reliable relay for Claude, GPT, Gemini and Grok — plus leading Chinese models — with one API key across Claude Code, Codex CLI, Cursor, Cherry Studio and other AI coding tools.';

// 新增主流语种的站点级文案（忠实翻译既有中立描述，不新增事实；不含大陆/海外定位
// 断言——新语种同一份文案两站通用）。cn/en 仍走上面的字面量常量，逐字节不变。
const SITE_NAME_I18N: Record<string, string> = {
  ja: 'LMU AI ドキュメント',
  ko: 'LMU AI 문서',
  es: 'Documentación de LMU AI',
  pt: 'Documentação da LMU AI',
  de: 'LMU AI Dokumentation',
  fr: 'Documentation LMU AI',
  ru: 'Документация LMU AI',
  ar: 'وثائق LMU AI',
};
const SITE_DESCRIPTION_I18N: Record<string, string> = {
  ja: 'LMU AI（Lingmou AI）API ドキュメント：Claude、GPT、Gemini、Grok に加え主要な中国製モデルにも対応する安定した中継サービス。1 つの API キーで Claude Code、Codex CLI、Cursor、Cherry Studio などの AI コーディングツールに接続できます。',
  ko: 'LMU AI(Lingmou AI) API 문서: Claude, GPT, Gemini, Grok과 주요 중국 모델까지 지원하는 안정적인 중계 서비스. 하나의 API 키로 Claude Code, Codex CLI, Cursor, Cherry Studio 등 AI 코딩 도구에 연결합니다.',
  es: 'Documentación de la API de LMU AI (Lingmou AI): un relay estable y fiable para Claude, GPT, Gemini y Grok, además de los principales modelos chinos, con una sola clave API en Claude Code, Codex CLI, Cursor, Cherry Studio y otras herramientas de programación con IA.',
  pt: 'Documentação da API da LMU AI (Lingmou AI): um relay estável e confiável para Claude, GPT, Gemini e Grok — além dos principais modelos chineses — com uma única chave de API no Claude Code, Codex CLI, Cursor, Cherry Studio e outras ferramentas de programação com IA.',
  de: 'LMU AI (Lingmou AI) API-Dokumentation: ein stabiler, zuverlässiger Relay-Dienst für Claude, GPT, Gemini und Grok sowie führende chinesische Modelle – mit einem einzigen API-Schlüssel in Claude Code, Codex CLI, Cursor, Cherry Studio und anderen KI-Programmierwerkzeugen.',
  fr: "Documentation de l'API LMU AI (Lingmou AI) : un relais stable et fiable pour Claude, GPT, Gemini et Grok, ainsi que les principaux modèles chinois, avec une seule clé API sur Claude Code, Codex CLI, Cursor, Cherry Studio et d'autres outils de développement IA.",
  ru: 'Документация API LMU AI (Lingmou AI): стабильный и надёжный релей для Claude, GPT, Gemini и Grok, а также ведущих китайских моделей — с единым API-ключом в Claude Code, Codex CLI, Cursor, Cherry Studio и других инструментах ИИ-разработки.',
  ar: 'وثائق واجهة LMU AI (Lingmou AI) البرمجية: خدمة تحويل مستقرة وموثوقة لـ Claude وGPT وGemini وGrok إضافةً إلى أبرز النماذج الصينية، بمفتاح API واحد عبر Claude Code وCodex CLI وCursor وCherry Studio وغيرها من أدوات البرمجة بالذكاء الاصطناعي.',
};

export function siteName(locale: string): string {
  if (locale === 'cn') return SITE_NAME;
  return SITE_NAME_I18N[locale] ?? SITE_NAME_EN;
}
export function siteDescription(locale: string): string {
  if (locale === 'cn') return SITE_DESCRIPTION;
  return SITE_DESCRIPTION_I18N[locale] ?? SITE_DESCRIPTION_EN;
}

// 产品实体（区别于「文档站」SITE_NAME=灵眸文档）：灵眸 AI 本体是大模型 API 中转服务。
// 供 SoftwareApplication JSON-LD 使用——让生成式引擎/搜索明确「这个实体是什么」。
// 全部取自站内既有文案，忠实描述；不虚构价格、评分与不存在的能力（见 no-invented-facts）。
export const PRODUCT_NAME = '灵眸 AI';
export const PRODUCT_NAME_EN = 'LMU AI';
export function productName(locale: string): string {
  // 品牌名：中文站用「灵眸 AI」，其余语种一律用英文品牌「LMU AI」（不逐字翻译品牌）。
  return locale === 'cn' ? PRODUCT_NAME : PRODUCT_NAME_EN;
}

// 定位描述按变体走：.com 陈述北京网关（境内直连免代理）；.ai 陈述国际站网关
// （境外直连、账号与大陆端点互通）。均只写已核实事实，不带延迟/在线率数字。
// 对外口径（2026-09-02 用户定）：.ai 一律称「国际站」，不提具体节点城市。
// com 分支字面量与引入变体机制前逐字一致（构建产物 diff 闸门依赖这一点）。
export const PRODUCT_DESCRIPTION = IS_AI
  ? '灵眸 AI 是大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT、Gemini 与国产大模型；国际站网关境外可直接访问，账号、密钥与余额与大陆端点通用，兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 工具。'
  : '灵眸 AI 是面向中国大陆用户的大模型 API 中转服务，一把 API Key 即可调用 Claude、OpenAI GPT、Gemini 与国产大模型，网关部署在中国境内、国内直连免代理，兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 工具。';
export const PRODUCT_DESCRIPTION_EN = IS_AI
  ? 'LMU AI (Lingmou AI) is a large-model API relay. One API key calls Claude, OpenAI GPT, Gemini and leading Chinese models; the international gateway offers direct access from outside mainland China, and the same account, key and balance also work on the mainland endpoint. Compatible with mainstream AI tools such as Claude Code, Codex CLI, Cursor and Cherry Studio.'
  : 'LMU AI (Lingmou AI) is a large-model API relay for users in mainland China. One API key calls Claude, OpenAI GPT, Gemini and leading Chinese models; the gateway is hosted inside mainland China for direct, proxy-free access, and it is compatible with mainstream AI tools such as Claude Code, Codex CLI, Cursor and Cherry Studio.';
// 新语种产品描述用海外中立措辞：不写网关位置（大陆/海外均不断言），同一份文案两站
// 通用，避免在某一站说错定位（no-fabrication）。cn/en 仍走上面的 IS_AI 字面量。
const PRODUCT_DESCRIPTION_I18N: Record<string, string> = {
  ja: 'LMU AI（Lingmou AI）は大規模モデルの API 中継サービスです。1 つの API キーで Claude、OpenAI GPT、Gemini および主要な中国製大規模モデルを呼び出せ、Claude Code、Codex CLI、Cursor、Cherry Studio などの主流 AI ツールに対応します。',
  ko: 'LMU AI(Lingmou AI)는 대규모 모델 API 중계 서비스입니다. 하나의 API 키로 Claude, OpenAI GPT, Gemini 및 주요 중국 대규모 모델을 호출할 수 있으며 Claude Code, Codex CLI, Cursor, Cherry Studio 등 주요 AI 도구와 호환됩니다.',
  es: 'LMU AI (Lingmou AI) es un relay de API de grandes modelos. Una sola clave API llama a Claude, OpenAI GPT, Gemini y los principales modelos chinos, y es compatible con herramientas de IA populares como Claude Code, Codex CLI, Cursor y Cherry Studio.',
  pt: 'A LMU AI (Lingmou AI) é um relay de API de grandes modelos. Uma única chave de API chama Claude, OpenAI GPT, Gemini e os principais modelos chineses, e é compatível com ferramentas de IA populares como Claude Code, Codex CLI, Cursor e Cherry Studio.',
  de: 'LMU AI (Lingmou AI) ist ein Relay-Dienst für Large-Model-APIs. Ein einziger API-Schlüssel ruft Claude, OpenAI GPT, Gemini und führende chinesische Modelle auf und ist mit gängigen KI-Tools wie Claude Code, Codex CLI, Cursor und Cherry Studio kompatibel.',
  fr: "LMU AI (Lingmou AI) est un service de relais d'API de grands modèles. Une seule clé API appelle Claude, OpenAI GPT, Gemini et les principaux modèles chinois, et il est compatible avec les outils d'IA courants comme Claude Code, Codex CLI, Cursor et Cherry Studio.",
  ru: 'LMU AI (Lingmou AI) — это релей API больших моделей. Один API-ключ вызывает Claude, OpenAI GPT, Gemini и ведущие китайские модели и совместим с популярными ИИ-инструментами, такими как Claude Code, Codex CLI, Cursor и Cherry Studio.',
  ar: 'إن LMU AI (Lingmou AI) خدمة تحويل لواجهات النماذج الكبيرة البرمجية. يستدعي مفتاح API واحد نماذج Claude وOpenAI GPT وGemini وأبرز النماذج الصينية، وهي متوافقة مع أدوات الذكاء الاصطناعي الشائعة مثل Claude Code وCodex CLI وCursor وCherry Studio.',
};
export function productDescription(locale: string): string {
  if (locale === 'cn') return PRODUCT_DESCRIPTION;
  if (locale === 'en') return PRODUCT_DESCRIPTION_EN;
  return PRODUCT_DESCRIPTION_I18N[locale] ?? PRODUCT_DESCRIPTION_EN;
}

// featureList：逐条对应站内既有卖点（首页 OG、SITE_DESCRIPTION、关键事实、models.ts）。
// 仅第 3 条（网关位置）随变体走，其余两站相同。
export const PRODUCT_FEATURES = [
  '一把 API Key 通用 Anthropic、OpenAI 兼容、Gemini 原生三种协议',
  '兼容 Claude Code、Codex CLI、Cursor、Cherry Studio 等主流 AI 编程工具',
  IS_AI ? '国际站网关，境外直接访问' : '网关部署在中国境内，国内直连、低延迟、免代理',
  '多源故障转移',
  '覆盖 Claude、GPT、Gemini 及通义千问、DeepSeek、GLM、Kimi、MiniMax、MiMo 等国产大模型',
  '提供文生图与图片编辑 API',
];
export const PRODUCT_FEATURES_EN = [
  'One API key works across the Anthropic, OpenAI-compatible and Gemini native protocols',
  'Compatible with mainstream AI coding tools such as Claude Code, Codex CLI, Cursor and Cherry Studio',
  IS_AI
    ? 'International gateway with direct access from outside mainland China'
    : 'Gateway hosted inside mainland China for direct, low-latency, proxy-free access',
  'Multi-source failover',
  'Covers Claude, GPT, Gemini and Chinese models including Qwen, DeepSeek, GLM, Kimi, MiniMax and MiMo',
  'Image generation and image editing API',
];
// 新语种 featureList 去掉「网关位置」这一条（该条随站点变体走，新语种两站共用一份文案，
// 不对某一站做错误定位），其余 5 条忠实翻译。cn/en 仍走上面的 IS_AI 六条数组。
const PRODUCT_FEATURES_I18N: Record<string, string[]> = {
  ja: [
    '1 つの API キーで Anthropic、OpenAI 互換、Gemini ネイティブの 3 プロトコルに対応',
    'Claude Code、Codex CLI、Cursor、Cherry Studio などの主流 AI プログラミングツールに対応',
    'マルチソースのフェイルオーバー',
    'Claude、GPT、Gemini と、通義千問（Qwen）、DeepSeek、GLM、Kimi、MiniMax、MiMo などの中国製大規模モデルをカバー',
    '画像生成・画像編集 API を提供',
  ],
  ko: [
    '하나의 API 키로 Anthropic, OpenAI 호환, Gemini 네이티브 세 가지 프로토콜 지원',
    'Claude Code, Codex CLI, Cursor, Cherry Studio 등 주요 AI 프로그래밍 도구와 호환',
    '다중 소스 장애 조치(failover)',
    'Claude, GPT, Gemini와 Qwen, DeepSeek, GLM, Kimi, MiniMax, MiMo 등 중국 대규모 모델 지원',
    '이미지 생성 및 이미지 편집 API 제공',
  ],
  es: [
    'Una sola clave API funciona con los protocolos Anthropic, compatible con OpenAI y nativo de Gemini',
    'Compatible con herramientas de programación con IA como Claude Code, Codex CLI, Cursor y Cherry Studio',
    'Conmutación por error de múltiples fuentes',
    'Cubre Claude, GPT, Gemini y modelos chinos como Qwen, DeepSeek, GLM, Kimi, MiniMax y MiMo',
    'API de generación y edición de imágenes',
  ],
  pt: [
    'Uma única chave de API funciona nos protocolos Anthropic, compatível com OpenAI e nativo do Gemini',
    'Compatível com ferramentas de programação com IA como Claude Code, Codex CLI, Cursor e Cherry Studio',
    'Failover de múltiplas fontes',
    'Cobre Claude, GPT, Gemini e modelos chineses como Qwen, DeepSeek, GLM, Kimi, MiniMax e MiMo',
    'API de geração e edição de imagens',
  ],
  de: [
    'Ein einziger API-Schlüssel funktioniert über die Protokolle Anthropic, OpenAI-kompatibel und Gemini-nativ',
    'Kompatibel mit gängigen KI-Programmierwerkzeugen wie Claude Code, Codex CLI, Cursor und Cherry Studio',
    'Multi-Source-Failover',
    'Unterstützt Claude, GPT, Gemini sowie chinesische Modelle wie Qwen, DeepSeek, GLM, Kimi, MiniMax und MiMo',
    'API zur Bildgenerierung und Bildbearbeitung',
  ],
  fr: [
    'Une seule clé API fonctionne avec les protocoles Anthropic, compatible OpenAI et natif Gemini',
    'Compatible avec les outils de développement IA courants comme Claude Code, Codex CLI, Cursor et Cherry Studio',
    'Bascule multi-source (failover)',
    'Couvre Claude, GPT, Gemini et des modèles chinois comme Qwen, DeepSeek, GLM, Kimi, MiniMax et MiMo',
    "API de génération et d'édition d'images",
  ],
  ru: [
    'Один API-ключ работает с протоколами Anthropic, OpenAI-совместимым и нативным Gemini',
    'Совместим с популярными инструментами ИИ-разработки: Claude Code, Codex CLI, Cursor и Cherry Studio',
    'Отказоустойчивость с несколькими источниками',
    'Поддерживает Claude, GPT, Gemini и китайские модели: Qwen, DeepSeek, GLM, Kimi, MiniMax и MiMo',
    'API генерации и редактирования изображений',
  ],
  ar: [
    'مفتاح API واحد يعمل عبر بروتوكولات Anthropic والمتوافق مع OpenAI وGemini الأصلي',
    'متوافق مع أدوات البرمجة بالذكاء الاصطناعي الشائعة مثل Claude Code وCodex CLI وCursor وCherry Studio',
    'تجاوز الفشل من مصادر متعددة',
    'يغطي Claude وGPT وGemini والنماذج الصينية مثل Qwen وDeepSeek وGLM وKimi وMiniMax وMiMo',
    'واجهة برمجية لتوليد الصور وتحريرها',
  ],
};
export function productFeatures(locale: string): string[] {
  if (locale === 'cn') return PRODUCT_FEATURES;
  if (locale === 'en') return PRODUCT_FEATURES_EN;
  return PRODUCT_FEATURES_I18N[locale] ?? PRODUCT_FEATURES_EN;
}

// SoftwareApplication.applicationSubCategory：产品所属细分类别（「大模型 API 中转服务」）。
// 语言无关的实体描述，逐语忠实翻译（措辞对齐上面的 productDescription），不新增事实。
// cn/en 字面量与此前 layout.tsx 内联值逐字一致。
const APPLICATION_SUBCATEGORY_CN = '大模型 API 中转服务';
const APPLICATION_SUBCATEGORY_EN = 'Large-model API relay';
const APPLICATION_SUBCATEGORY_I18N: Record<string, string> = {
  ja: '大規模モデル API 中継サービス',
  ko: '대규모 모델 API 중계 서비스',
  es: 'Servicio de relay de API de grandes modelos',
  pt: 'Serviço de relay de API de grandes modelos',
  de: 'Relay-Dienst für Large-Model-APIs',
  fr: "Service de relais d'API de grands modèles",
  ru: 'Релей API больших моделей',
  ar: 'خدمة تحويل لواجهات النماذج الكبيرة البرمجية',
};
export function applicationSubCategory(locale: string): string {
  if (locale === 'cn') return APPLICATION_SUBCATEGORY_CN;
  return APPLICATION_SUBCATEGORY_I18N[locale] ?? APPLICATION_SUBCATEGORY_EN;
}

export const SITE_KEYWORDS = [
  '灵眸',
  '灵眸 API',
  'Claude API',
  'Claude Code',
  'Codex CLI',
  'Codex App',
  'Cursor',
  'VS Code',
  'Trae',
  'OpenCode',
  'Cherry Studio',
  'Kilo Code',
  'Anthropic 中转',
  'AI API 代理',
  'Gemini 生图 API',
  'GPT 生图 API',
  'Grok 生图 API',
  'Gemini 批量生图',
  '国产大模型',
  'Qwen',
];

export const THEME_COLOR = '#dd7627';
