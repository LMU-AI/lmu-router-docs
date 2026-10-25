import { ICP_RECORD, ICP_URL } from '@/lib/variant';

// 页脚的 ICP 备案号（#68）：国内站部署在大陆服务器，须在页面上展示备案号并链到工信部
// 备案系统。只在国内站渲染（ICP_RECORD 在 .ai 为 null，见 lib/variant.ts）。
// 备案号是法定标识，各语种原样展示、不翻译。放在文档页正文最末（CTA 卡片之后），
// 样式与 LastUpdated 同一档（小号、弱化色），不抢正文视线。
export function IcpFooter() {
  if (!ICP_RECORD) return null;
  return (
    <p className="not-prose mt-8 text-center text-xs text-fd-muted-foreground">
      <a
        href={ICP_URL}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="hover:text-fd-foreground hover:underline underline-offset-4"
      >
        {ICP_RECORD}
      </a>
    </p>
  );
}
