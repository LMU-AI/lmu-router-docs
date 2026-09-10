'use client';

import { useState, type ReactNode } from 'react';

// 复制按钮文案 / aria-label 按语种取。本组件是 'use client'，SSR 时读不到服务端 locale，
// 故 locale 由 MDX 注册处（app/[lang]/docs/[[...slug]]/page.tsx）按页注入 —— 这样首屏 HTML
// 就是对应语种（不再对所有语种、连英文页都漏中文「复制」）。未知语种回退英文。
const COPY_LABELS: Record<string, { copy: string; copied: string; aria: (n: string) => string }> = {
  cn: { copy: '复制', copied: '已复制', aria: (n) => `复制模型名称 ${n}` },
  en: { copy: 'Copy', copied: 'Copied', aria: (n) => `Copy model name ${n}` },
  ja: { copy: 'コピー', copied: 'コピー済み', aria: (n) => `モデル名「${n}」をコピー` },
  ko: { copy: '복사', copied: '복사됨', aria: (n) => `모델 이름 ${n} 복사` },
  es: { copy: 'Copiar', copied: 'Copiado', aria: (n) => `Copiar el nombre del modelo ${n}` },
  pt: { copy: 'Copiar', copied: 'Copiado', aria: (n) => `Copiar o nome do modelo ${n}` },
  de: { copy: 'Kopieren', copied: 'Kopiert', aria: (n) => `Modellnamen ${n} kopieren` },
  fr: { copy: 'Copier', copied: 'Copié', aria: (n) => `Copier le nom du modèle ${n}` },
  ru: { copy: 'Копировать', copied: 'Скопировано', aria: (n) => `Скопировать имя модели ${n}` },
  ar: { copy: 'نسخ', copied: 'تم النسخ', aria: (n) => `نسخ اسم النموذج ${n}` },
};

export function ModelCard({
  name,
  description,
  badge,
  locale = 'cn',
}: {
  name: string;
  description?: string;
  badge?: string;
  locale?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = COPY_LABELS[locale] ?? COPY_LABELS.en;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = name;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t.aria(name)}
      className="group relative flex w-full items-center justify-between gap-3 rounded-xl border border-fd-border bg-fd-card px-3.5 py-3 text-left transition-all hover:border-fd-primary hover:bg-fd-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-fd-primary"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <code className="truncate font-mono text-sm font-medium text-fd-foreground">
            {name}
          </code>
          {badge ? (
            <span className="shrink-0 rounded-md bg-fd-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fd-primary">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <span className="mt-0.5 truncate text-xs text-fd-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <span
        className={
          'shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ' +
          (copied
            ? 'bg-fd-primary text-fd-primary-foreground'
            : 'bg-fd-muted text-fd-muted-foreground group-hover:bg-fd-primary group-hover:text-fd-primary-foreground')
        }
      >
        {copied ? t.copied : t.copy}
      </span>
    </button>
  );
}

export function ModelGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
