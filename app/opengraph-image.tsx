import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

export const alt = `${SITE_NAME} — Claude / Codex / Cursor 一站式 AI API 接入`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px',
          background: 'linear-gradient(135deg, #dd7627 0%, #c45a15 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 40,
            lineHeight: 1.3,
            opacity: 0.92,
            maxWidth: 980,
          }}
        >
          Claude Code / Codex CLI / Cursor
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 36,
            lineHeight: 1.3,
            opacity: 0.85,
            maxWidth: 980,
          }}
        >
          一站式 AI API 接入指南
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 80,
            fontSize: 28,
            opacity: 0.8,
          }}
        >
          docs.fulitimes.com
        </div>
      </div>
    ),
    { ...size },
  );
}
