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
