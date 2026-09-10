import { REGISTER_URL } from '@/lib/site';
import { IS_AI } from '@/lib/variant';

const COPY = {
  cn: {
    ariaLabel: '注册灵眸 API',
    heading: '开通灵眸 API，立即用上 Claude / Codex 等主流 AI 工具',
    // 「国内直连」只对 .com（北京网关）为真；.ai（国际站网关）说境外直连。
    body: IS_AI
      ? '零门槛注册、套餐灵活、国际站境外直连。支持 Claude Code、Codex CLI、Cursor、VS Code 插件、OpenCode、Cherry Studio 等工具接入。'
      : '零门槛注册、套餐灵活、国内直连。支持 Claude Code、Codex CLI、Cursor、VS Code 插件、OpenCode、Cherry Studio 等工具接入。',
    cta: '前往注册',
  },
  en: {
    ariaLabel: 'Sign up for LMU AI',
    heading: 'Get an LMU AI key and start using Claude, Codex and more',
    body: 'Free sign-up, flexible plans, one key across Claude Code, Codex CLI, Cursor, VS Code, OpenCode, Cherry Studio and other AI tools.',
    cta: 'Sign up',
  },
  // 新语种：一律「海外中立」措辞，不写网关位置（大陆/境外均不断言）——同一份文案两站通用，
  // 既不会在某站说错定位（no-fabrication），也天然过 .ai 物化器的大陆话术扫描。品牌名统一用 LMU AI。
  ja: {
    ariaLabel: 'LMU AI に登録',
    heading: 'LMU AI の API キーを取得して、Claude や Codex をすぐに使う',
    body: '登録は無料、プランは柔軟。1 つの API キーで Claude Code、Codex CLI、Cursor、VS Code 拡張、OpenCode、Cherry Studio などの AI ツールに接続できます。',
    cta: '登録する',
  },
  ko: {
    ariaLabel: 'LMU AI 가입',
    heading: 'LMU AI API 키를 발급받고 Claude와 Codex를 바로 사용하세요',
    body: '무료 가입, 유연한 요금제. 하나의 API 키로 Claude Code, Codex CLI, Cursor, VS Code 확장, OpenCode, Cherry Studio 등 AI 도구에 연결됩니다.',
    cta: '가입하기',
  },
  es: {
    ariaLabel: 'Regístrate en LMU AI',
    heading: 'Consigue una clave de API de LMU AI y empieza a usar Claude, Codex y más',
    body: 'Registro gratuito y planes flexibles. Una sola clave API para Claude Code, Codex CLI, Cursor, la extensión de VS Code, OpenCode, Cherry Studio y otras herramientas de IA.',
    cta: 'Registrarse',
  },
  pt: {
    ariaLabel: 'Cadastre-se na LMU AI',
    heading: 'Obtenha uma chave de API da LMU AI e comece a usar Claude, Codex e muito mais',
    body: 'Cadastro gratuito e planos flexíveis. Uma única chave de API para Claude Code, Codex CLI, Cursor, extensão do VS Code, OpenCode, Cherry Studio e outras ferramentas de IA.',
    cta: 'Cadastrar-se',
  },
  de: {
    ariaLabel: 'Bei LMU AI registrieren',
    heading: 'Hol dir einen LMU-AI-API-Schlüssel und nutze Claude, Codex und mehr',
    body: 'Kostenlose Registrierung, flexible Tarife. Ein API-Schlüssel für Claude Code, Codex CLI, Cursor, die VS-Code-Erweiterung, OpenCode, Cherry Studio und weitere KI-Tools.',
    cta: 'Registrieren',
  },
  fr: {
    ariaLabel: "S'inscrire à LMU AI",
    heading: 'Obtenez une clé API LMU AI et utilisez Claude, Codex et plus encore',
    body: "Inscription gratuite et forfaits flexibles. Une seule clé API pour Claude Code, Codex CLI, Cursor, l'extension VS Code, OpenCode, Cherry Studio et d'autres outils d'IA.",
    cta: "S'inscrire",
  },
  ru: {
    ariaLabel: 'Регистрация в LMU AI',
    heading: 'Получите API-ключ LMU AI и начните использовать Claude, Codex и другие инструменты',
    body: 'Бесплатная регистрация и гибкие тарифы. Один API-ключ для Claude Code, Codex CLI, Cursor, расширения VS Code, OpenCode, Cherry Studio и других ИИ-инструментов.',
    cta: 'Зарегистрироваться',
  },
  ar: {
    ariaLabel: 'التسجيل في LMU AI',
    heading: 'احصل على مفتاح API من LMU AI وابدأ باستخدام Claude وCodex والمزيد',
    body: 'تسجيل مجاني وباقات مرنة. مفتاح API واحد لـ Claude Code وCodex CLI وCursor وإضافة VS Code وOpenCode وCherry Studio وغيرها من أدوات الذكاء الاصطناعي.',
    cta: 'سجّل الآن',
  },
};

export function CtaFooter({ locale = 'cn' }: { locale?: string }) {
  const t = COPY[locale as keyof typeof COPY] ?? COPY.en;
  return (
    <div
      role="complementary"
      aria-label={t.ariaLabel}
      className="not-prose mt-10 rounded-xl border border-fd-border bg-fd-primary/10 p-6"
    >
      <h3 className="text-lg font-semibold text-fd-foreground">{t.heading}</h3>
      <p className="mt-2 text-sm text-fd-muted-foreground">{t.body}</p>
      <a
        href={REGISTER_URL}
        target="_blank"
        rel="noopener"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
      >
        {t.cta}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
