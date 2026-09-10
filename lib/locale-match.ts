// 零依赖的 BCP-47 语言协商 + 爬虫识别。供 proxy.ts 在运行时按访客 Accept-Language
// 选择最佳语种（无前缀路径的自动跳转）。
//
// 为什么手写、不引 negotiator / @formatjs/intl-localematcher：
// 需求很窄——按 q 值排序 + 主子标签精确匹配 + zh*/pt* 归并——手写纯函数即可，既省一层
// 依赖（守供应链纪律），也便于单测。关键不变量：**只按主子标签精确相等匹配**，因此
// `ja` 永远只命中 `ja`、`ko` 永远只命中 `ko`，绝不做任何跨语言近似（用户明确要求）。

// 把 Accept-Language 里的单个语言标签规范化到受支持的短码；无法映射返回 null。
// 入参如 'zh-CN' / 'ja' / 'pt-BR' / 'en-US' / 'fr-CA'（大小写不敏感）。
function tagToLocale(tag: string, supported: readonly string[]): string | null {
  const lower = tag.toLowerCase().trim();
  if (!lower || lower === '*') return null;
  const primary = lower.split('-')[0];
  // 中文各变体（zh / zh-CN / zh-TW / zh-HK / zh-Hans / zh-Hant …）统一归简体 cn：
  // 本站只有简体中文，落 cn 远好于落英文。葡语各变体（pt / pt-BR / pt-PT）归 pt（巴西葡语）。
  if (primary === 'zh') return supported.includes('cn') ? 'cn' : null;
  if (primary === 'pt') return supported.includes('pt') ? 'pt' : null;
  // 其余：主子标签必须**精确命中**受支持短码（en/ja/ko/es/de/fr/ru/ar）。
  // 只认主子标签精确相等 —— 绝不把 ja 近似成 ko、也绝不做区域回退到别的语言。
  return supported.includes(primary) ? primary : null;
}

// 解析 Accept-Language，按 q 值降序取第一个能映射到受支持语种的标签；全不匹配则
// 返回 defaultLocale。例：'ja,en;q=0.8' → 'ja'；'en-US,en;q=0.9' → 'en'；
// 'fr-CA' → 'fr'；'zh-TW' → 'cn'；'' / null / 未知语种 → default。
export function matchLocale(
  acceptLanguage: string | null | undefined,
  supported: readonly string[],
  defaultLocale: string,
): string {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q=([0-9.]+)$/i);
        if (m) q = parseFloat(m[1]);
      }
      return { tag: (tag ?? '').trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const loc = tagToLocale(tag, supported);
    if (loc) return loc;
  }
  return defaultLocale;
}

// 搜索 / AI 爬虫识别（User-Agent 子串，大小写不敏感）。命中者**跳过语言协商**：始终
// 看到站点规范默认语言页，靠 hreflang + sitemap 收录全部语种 —— 无 cloaking 风险，
// 且保住 .com 既有百度收录。名单涵盖各大搜索引擎 + 主流 AI 抓取/训练 UA（与
// app/robots.txt/route.ts 的允许爬虫同源），外加社交分享抓取（生成分享卡）。
const BOT_RE =
  /bot\b|crawler|spider|crawling|googlebot|bingbot|baiduspider|yandex|duckduckbot|slurp|applebot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|amazonbot|meta-externalagent|cohere-ai|facebookexternalhit|twitterbot|embedly|whatsapp|telegrambot|discordbot|linkedinbot/i;

export function isBot(ua: string | null | undefined): boolean {
  return !!ua && BOT_RE.test(ua);
}
