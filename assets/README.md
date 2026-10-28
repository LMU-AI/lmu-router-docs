# assets/

## NotoSansSC-Bold-subset.ttf

`app/opengraph-image.tsx` 用的字体子集，**只包含 OG 图上出现的字形**（约 7 KB）。

OG 图文案随站点变体走（`lib/variant.ts`）：国内站 docs.lmuai.com 中文标题、
国际站 docs.lmuai.ai 英文标题。**两个变体共用这一份字体文件**，所以子集必须
覆盖**两套文案的并集**——漏掉任何一个变体的字符，那个站的 OG 图就出方块。

内嵌而不是让 satori 构建期去 `fonts.googleapis.com` 拉，是因为那条路径静默失败：
`loadGoogleFont` 自己 catch 掉网络错误并返回 undefined，回落到无 CJK 字形的
sans-serif（渲染成一排方块），而构建照样 exit 0 —— 发出去几周都不会有人发现。

### 改了 OG 图文案后需要重新生成

字符集变了但字体没重生成，新字会渲染成空白。

```bash
# 这些字符串必须与 app/opengraph-image.tsx 里两个变体的文本逐字一致——
# 中文标题/副题来自 .com 变体，英文标题/副题来自 .ai 变体（SITE_NAME /
# SITE_NAME_EN 在 lib/site.ts，OG_DOMAIN 在 lib/variant.ts）。
# 漏掉哪个字符，那个字符就会回落到 @vercel/og 自带的 Geist（无 CJK），
# 字重和字形都对不上。
TXT=$(python3 -c "
import urllib.parse
s=('灵眸文档' 'LMU AI Docs'
   'Claude Code / Codex CLI / Cursor'
   '一站式 AI API 接入指南' 'One-stop AI API integration guide'
   'docs.lmuai.com' 'docs.lmuai.ai')
print(urllib.parse.quote(''.join(sorted(set(s)))))
")

# User-Agent 必须是老浏览器，否则 Google 返回 woff2 —— satori 不支持 woff2
URL=$(curl -s -H 'User-Agent: Mozilla/4.0' \
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&text=$TXT" \
  | grep -o 'https://fonts.gstatic.com/[^)]*')

curl -s -o assets/NotoSansSC-Bold-subset.ttf "$URL"
```

验证：**两个变体都要看**。`npm run build` 与 `SITE_VARIANT=ai npm run build` 后
分别把 `.next/server/app/opengraph-image.body` 改名成 `.png` 打开，确认中英文
均正常显示、没有 □ 方块。

## Logo 与站点图标

**矢量母版是 `app/icon.svg`**（viewBox `0 0 64 64`，两条 path：玫红 `#ED1C50`、
橙 `#F97A00`）。其余位图都按同一份几何导出，换 logo 时一起换：

| 文件 | 尺寸 | 背景 | 取景 |
|---|---|---|---|
| `app/icon.svg` | 矢量 | 透明 | logo 高度占 75%，以六边形环中心居中 |
| `public/favicon.ico` | 16 / 32 / 48 / 64 / 128 / 256 | 透明 | 同上 |
| `public/icon-192.png`、`public/icon-512.png` | 192、512 | 透明 | 同上（manifest `purpose: any`） |
| `app/apple-icon.png` | 180 | **白底** | logo 高度占 70%（iOS 不支持透明，会自己加圆角） |
| `public/icon-maskable-512.png` | 512 | **白底** | logo 整体落在中心半径 39% 的圆内（maskable 安全区是 40%，Android 会裁成圆或圆角方） |

注意事项：

- **透明底取景定为 75%，是为了和同品牌其他站点的页签图标一样大**：community.lmuai.ai
  的 32×32 图标 logo 高 75%，api.lmuai.com 直接用设计原图（高 77%）。曾用过 92%，
  和它们并排开着时明显大一圈。75% 在 16 / 32px 下正好是 12 / 24px 整像素，边缘更清楚。
- **logo 是透明底，所以 maskable 必须单独一张白底图**，不能拿 `icon-512.png` 兼作——
  透明处会被系统填黑，边缘还会被裁掉。
- 当前这套（2026-10）由设计稿 PNG（1024×1024，AI 生成）重建为矢量：几何上是一个
  从正中断开的六边形环（斜边 tan≈0.6）加一根斜切平行四边形竖条，圆角是三次贝塞尔
  平滑角。重建结果与原图逐像素比对，误差都在边缘 1.5px 以内（1024 尺度下）；原图里
  的低透明度杂点和轻微的左右不对称没有带进来。
- 用 SVG 母版导出位图时，任何 SVG 渲染器都可以（Chrome 无头截图、Inkscape 等），
  按上表的尺寸、底色、取景来。
