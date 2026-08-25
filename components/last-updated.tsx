/**
 * 页面底部的「最后更新」标记。
 *
 * 为什么不用 fumadocs-ui 内建的 `<DocsPage lastUpdate>` / `PageLastUpdate`：
 * 那个组件把日期放在 `useEffect` 里 `setDate(value.toLocaleDateString())`，
 * 首屏 SSR 的 HTML 里日期是**空的**，只有客户端 hydrate 后才出现。爬虫和
 * AI 检索拿到的就是一个没有日期的空标签——「让人感知到持续更新」这个目的
 * 恰好在最需要它的读者那里落空。另外它的默认文案是英文 "Last updated on"，
 * 站上没配 I18nProvider，会直接漏出英文。
 *
 * 这里做成纯服务端组件：日期在构建期格式化进 HTML，零客户端 JS。
 */

// 固定用 Asia/Shanghai 格式化。不传 timeZone 的话，构建机（GitHub runner 是
// UTC）和读者本地时区会得出不同的日子，同一次构建产出的静态 HTML 却是唯一的
// ——等于随机偏移一天。站是 zh-CN 面向国内，钉死东八区最贴近读者预期。
const FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function LastUpdated({ date, locale = 'cn' }: { date: Date; locale?: string }) {
  // zh-CN 的 format 产出 2026/08/04，统一换成 ISO 风格的短横线。
  const display = FORMATTER.format(date).replace(/\//g, '-');
  // datetime 属性给机器读，必须是完整 ISO 8601。
  const machine = date.toISOString();

  return (
    <p className="not-prose mt-8 border-t border-fd-border pt-4 text-sm text-fd-muted-foreground">
      {locale === 'en' ? 'Last updated: ' : '最后更新：'}
      {/*
        用 JSX 规范的 dateTime（驼峰）。React 19 的 server 渲染并不会把它降成小写，
        产出的就是 `<time dateTime="...">`——这没问题：页面以 text/html 提供，HTML5
        属性名大小写不敏感，浏览器与爬虫都按 datetime 读；真正给机器读的 dateModified
        另在 JSON-LD 里。别为了拿全小写而改用 {...{ datetime }} 透传——那会触发 React 19
        dev-only 的 "Invalid DOM property `datetime`. Did you mean `dateTime`?" 告警。
      */}
      <time dateTime={machine}>{display}</time>
    </p>
  );
}
