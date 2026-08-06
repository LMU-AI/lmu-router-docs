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

export function LastUpdated({ date }: { date: Date }) {
  // zh-CN 的 format 产出 2026/08/04，统一换成 ISO 风格的短横线。
  const display = FORMATTER.format(date).replace(/\//g, '-');
  // datetime 属性给机器读，必须是完整 ISO 8601。
  const machine = date.toISOString();

  return (
    <p className="not-prose mt-8 border-t border-fd-border pt-4 text-sm text-fd-muted-foreground">
      最后更新：
      {/*
        用 {...{ datetime }} 而不是 JSX 的 dateTime 属性：实测 React 19 的
        server bundle 里没有 dateTime 的映射条目，它走通用透传，把属性名**原样**
        写进 HTML，产出 `<time dateTime="...">`。浏览器解析 HTML 属性名不区分
        大小写，所以功能不受影响，但规范里该属性是全小写 datetime，严格的
        XML / XHTML 解析器和一部分抓取工具只认小写。展开写法绕过 React 的
        属性名规范化，直接落小写。
      */}
      <time {...{ datetime: machine }}>{display}</time>
    </p>
  );
}
