import { REGISTER_URL } from '@/lib/site';

export function CtaFooter() {
  return (
    <div
      role="complementary"
      aria-label="注册灵眸 API"
      className="not-prose mt-10 rounded-xl border border-fd-border bg-fd-primary/10 p-6"
    >
      <h3 className="text-lg font-semibold text-fd-foreground">
        开通灵眸 API，立即用上 Claude / Codex 等主流 AI 工具
      </h3>
      <p className="mt-2 text-sm text-fd-muted-foreground">
        零门槛注册、套餐灵活、国内直连。支持 Claude Code、Codex CLI、Cursor、VS Code 插件、OpenCode、Cherry Studio 等工具接入。
      </p>
      <a
        href={REGISTER_URL}
        target="_blank"
        rel="noopener"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
      >
        前往注册
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
