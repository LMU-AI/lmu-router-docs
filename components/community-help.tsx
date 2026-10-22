import { COMMUNITY_HELP_URL } from '@/lib/site';

// 文档页尾、紧跟「最后更新」的一行求助入口：读完还没解决，就去社区「使用求助」提问。
// 只在国际站渲染（COMMUNITY_HELP_URL 在 .com 为 null，见 lib/variant.ts）。
// 样式与 LastUpdated 同一档（小号、弱化色），不做成卡片，免得和下面的注册 CTA 抢视线。
// 社区以中文为主，非中文语种明确标出「中文」，不让读者以为那里有本语种的讨论。
// 未知语种回退英文（与 LastUpdated / CtaFooter 一致）。
const COPY: Record<string, { before: string; link: string; after: string }> = {
  cn: { before: '还有问题？到 ', link: '灵眸 AI 社区', after: ' 提问，用控制台账号直接登录。' },
  en: {
    before: 'Still have questions? Ask in the ',
    link: 'LMU AI Community',
    after: ' (in Chinese) and sign in with your console account.',
  },
  ja: {
    before: 'まだ解決しない場合は、',
    link: 'LMU AI コミュニティ',
    after: '（中国語）で質問できます。コンソールのアカウントでそのままログインできます。',
  },
  ko: {
    before: '아직 궁금한 점이 있다면 ',
    link: 'LMU AI 커뮤니티',
    after: '(중국어)에 질문하세요. 콘솔 계정으로 바로 로그인할 수 있습니다.',
  },
  es: {
    before: '¿Sigues con dudas? Pregunta en la ',
    link: 'Comunidad de LMU AI',
    after: ' (en chino); inicia sesión con tu cuenta de la consola.',
  },
  pt: {
    before: 'Ainda com dúvidas? Pergunte na ',
    link: 'Comunidade da LMU AI',
    after: ' (em chinês); entre com a sua conta do console.',
  },
  de: {
    before: 'Noch Fragen? Stell sie in der ',
    link: 'LMU AI Community',
    after: ' (auf Chinesisch) – du meldest dich mit deinem Konsolen-Konto an.',
  },
  fr: {
    before: 'Encore des questions ? Posez-les sur la ',
    link: 'communauté LMU AI',
    after: ' (en chinois) ; connectez-vous avec votre compte de la console.',
  },
  ru: {
    before: 'Остались вопросы? Задайте их в ',
    link: 'сообществе LMU AI',
    after: ' (на китайском языке) — вход через аккаунт консоли.',
  },
  ar: {
    before: 'هل لديك أسئلة أخرى؟ اطرحها في ',
    link: 'مجتمع LMU AI',
    after: ' (باللغة الصينية)، وسجّل الدخول بحساب لوحة التحكم.',
  },
};

export function CommunityHelp({ locale = 'cn' }: { locale?: string }) {
  if (!COMMUNITY_HELP_URL) return null;
  const t = COPY[locale] ?? COPY.en;
  return (
    <p className="not-prose mt-2 text-sm text-fd-muted-foreground">
      {t.before}
      <a
        href={COMMUNITY_HELP_URL}
        target="_blank"
        rel="noopener"
        className="font-medium text-fd-primary underline-offset-4 hover:underline"
      >
        {t.link}
      </a>
      {t.after}
    </p>
  );
}
