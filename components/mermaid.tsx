'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setSvg(`<pre>${(e as Error).message}</pre>`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, resolvedTheme, id]);

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
