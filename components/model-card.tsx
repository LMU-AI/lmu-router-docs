'use client';

import { useState, type ReactNode } from 'react';

export function ModelCard({
  name,
  description,
  badge,
}: {
  name: string;
  description?: string;
  badge?: string;
}) {
  const [copied, setCopied] = useState(false);

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
      aria-label={`复制模型名称 ${name}`}
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
        {copied ? '已复制' : '复制'}
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
