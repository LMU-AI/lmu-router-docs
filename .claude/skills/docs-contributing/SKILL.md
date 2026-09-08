---
name: docs-contributing
description: 改动 limao-docs 文档内容前必读。本仓库同一套源码构建「中英双语 × 双域名双站」（docs.lmuai.com 国内站 / docs.lmuai.ai 国际站），两条硬约束：①中英页面必须 1:1 对照且导航同步；②只编辑 content/docs、站点差异用 <CN>/<Intl> 标记与变体字典、绝不碰 gitignore 的 content-ai。当你要加/删/改/翻译文档页、动 meta.json 导航、写站点相关文案或 API 端点、或处理 <CN>/<Intl> 变体标记时，先按本 skill 做，并在提交前跑校验（CI 门禁 content-guard 也会硬拦）。
---

# 贡献 limao-docs 文档内容（双语 × 双站硬约束）

> 这份 skill 提交在仓库里，**任何 clone 到本仓库的成员 / agent 都能用**。改内容前照着做，能避开本项目最容易踩的坑。
> 本 skill 只管**内容更新时的约束**；**发布上线**（双站一次 tag 同发）走 `release` skill，不在这里重复。

## 0. 一句话心智模型：为什么这个项目容易踩坑

**同一套源码 `content/docs/**` → 构建出两个站，每个站又是中英双语。**

- 一份 MDX 要同时对：`.com`（中文在根）和 `.ai`（英文在根）两个站。
- 每个页面要同时有中、英两份文件。
- `.ai` 的内容不是你手写的——是构建期从 `content/docs` **物化**出来的（`scripts/materialize-variant-content.mjs`：英↔中角色对调、端点改写、备案页排除）。产物在 `content-ai/`，**已 gitignore，改了白改**。

所以每次动内容，脑子里要同时过**两个维度**：中/英对不对得上（规则一）、.com/.ai 两个站都对不对（规则二）。

| | 国内站 | 国际站 |
|---|---|---|
| 域名 | docs.lmuai.com | docs.lmuai.ai |
| 变体 | `SITE_VARIANT` 未设（默认，产物逐字节=历史） | `SITE_VARIANT=ai` |
| 默认语言 | 中文在根 `/docs`，英文在 `/en/docs` | 英文在根 `/docs`，中文在 `/cn/docs` |
| API 端点 | `api.lmuai.com` | `api.lmuai.ai`（构建期自动改写） |
| 独有内容 | `guide/compliance`（备案） | —— |

单一事实源：`lib/variant.ts`。

---

## 1. 硬规则一：双语对照（中英 1:1）

**文件布局用「点后缀」区分语言**（Fumadocs `parser:'dot'`，见 `lib/i18n.ts`）：

- `X.mdx` = **中文**（裸文件名 = 默认语言）
- `X.en.mdx` = **英文**
- 每个目录的导航：`meta.json`（中） + `meta.en.json`（英），各自的 `pages[]` 列出该目录页面顺序。
- **没有 `app/en` 内容树**；语言由 loader 决定，别去 `app/` 下建对应文件。

**必须成对、必须同步：**

1. 每个中文页 `X.mdx` 都要有英文页 `X.en.mdx`（反之亦然，不能有孤儿英文页）。
2. 某目录 `meta.json` 的 `pages[]` 里有的 slug，`meta.en.json` 里也要有（且对应 `.en.mdx` 真实存在）。
3. 英文页**逐节真翻译**，不是只译标题。金额（`¥`）、绝对 URL、QQ 群号、邮箱等**事实要原样出现在英文页**（校验器会启发式扫这个）。

**校验：** `node scripts/check-i18n-parity.mjs`
断言：A. 中英 1:1（无缺英文页 / 无孤儿英文页）；B. 导航齐全（`meta.en.json` 与文件集、与中文导航一致，不多不少）；C.（warn）金额/URL/群号/邮箱不漏译。A 或 B 不过 → 退出码 1。

---

## 2. 硬规则二：双站变体（.com 与 .ai 都要对）

### 2.1 只编辑 `content/docs`，别碰物化产物
`content-ai/`、`content-ai-dates.json` 是构建期生成的、已 gitignore。**手改无效**（下次构建被覆盖）。

### 2.2 站点差异的**正文**文案 → 块级 `<CN>` / `<Intl>`
同一段文字在两个站说法不同（如国内「境内直连、免代理」 vs 国际「境外直连」）时，用标记包裹，两个站从同一份 MDX 各取所需（`lib/remark-variant.ts`）：

```mdx
<CN>

> 国内直连，免代理即可访问。

</CN>

<Intl>

> Direct overseas access, no proxy needed.

</Intl>
```

规则（违反会静默出错或构建失败）：
- **大写 `CN` / `Intl`**：万一插件没处理到，MDX 会当成未定义组件让构建**响亮报错**，而不是漏出小写标签。
- **独立成块、前后留空行**（block 级）。约定就是块级用法。
- **绝不包标题**：标题 slug id 在本插件之前就分配了，包标题会把锚点搞出 `-1` 后缀、破坏链接。定位差异只放正文 / `<Callout>`。

### 2.3 站点差异的 **frontmatter** 文案 → 变体字典
remark 到不了 frontmatter。frontmatter 里（如 `description`）有大陆专属定位话术时，去 `scripts/materialize-variant-content.mjs` 的 `FRONTMATTER_PHRASES` 加一对「中文原句 → 国际版改写」。

### 2.4 API 端点：源码里一律写 `.com`
正文写 `api.lmuai.com` 即可，`.ai` 构建会整文件改写成 `api.lmuai.ai`。**别在源码里写 `api.lmuai.ai`**（改写是单向的，写反了 round-trip 不回来）。

### 2.5 站点常量 / 定位文案：改单一事实源
- 新增站点级常量（域名、端点、注册地址、GA ID、默认语言…）→ `lib/variant.ts`。**铁律：`com` 分支必须与「引入变体前的字面量」逐字节一致**——`.com` 的发布门禁靠「产物 diff-match 历史」。所以 `com` 分支永远是硬编码字面量，只有 `ai` 分支可以变。
- 产品描述 / 功能点这类文案 → `lib/site.ts`。

### 2.6 备案页是 .com 独有
`guide/compliance.mdx`(+`.en.mdx`) 只在国内站，`.ai` 整页排除。若新增/改名指向 compliance 的交叉引用，要同步 `materialize-variant-content.mjs` 的 `COMPLIANCE_LINKS`，否则 `.ai` 构建**断链扫描失败**。

**校验（本地）：** `SITE_VARIANT=ai npm run build`
物化脚本内置两道**会让构建失败**的守卫：① 违禁话术扫描（`BANNED_AI_PHRASES`：物化后的输出里若残留「境内/免代理」等大陆话术——即没被 `<CN>` 包住的——直接 fail）；② 断链扫描（compliance 交叉引用没清干净）。
> 想快速只跑守卫（不整包 build）：`SITE_VARIANT=ai node scripts/materialize-variant-content.mjs`（这正是 CI 门禁跑的）。

---

## 3. 标准流程

### 新增一个文档页 `content/docs/<dir>/foo`
1. 建中文页 `content/docs/<dir>/foo.mdx`（写好 frontmatter：`title` / `description`）。
2. 建英文页 `content/docs/<dir>/foo.en.mdx`，**逐节翻译**。
3. `content/docs/<dir>/meta.json` 的 `pages[]` 加 `"foo"`；`meta.en.json` 也加 `"foo"`。
4. 站点差异：正文用 `<CN>/<Intl>`（§2.2）；frontmatter 差异进 `FRONTMATTER_PHRASES`（§2.3）。
5. 端点写 `api.lmuai.com`（§2.4）。
6. 跑 §4 两条校验，都绿。
7. 分支提交 → PR（别直接推 `main`）；CI `content-guard` 绿后合并；上线走 `release` skill。

### 改现有页 / 删页 / 调导航顺序
同理**两侧一起动**：改中文也改英文；删 `foo.mdx` 也删 `foo.en.mdx` 并从两个 `meta*.json` 移除；调顺序两个 `meta*.json` 一起调。

### 本地预览
- 国内站：`npm run dev`（默认）。
- 国际站：没有 `dev:ai`；用 `SITE_VARIANT=ai npm run build && SITE_VARIANT=ai npm start` 看物化后的 `.ai`。

---

## 4. 提交前必跑（= CI 门禁 `content-guard` 跑的东西）

```bash
node scripts/check-i18n-parity.mjs                             # ① 双语 1:1 + 导航
SITE_VARIANT=ai node scripts/materialize-variant-content.mjs   # ② .ai 变体守卫
```

两个脚本零依赖、只写 gitignore 产物，秒级完成。**本地两条绿 ≈ CI 绿。** PR 到 `main` 时 `.github/workflows/content-guard.yml` 会自动跑这两条，红了合不了（须在分支保护里把 `content-guard` 设为 required）。

> 发布后还要跑生产验证（两个变体各一次），那属于 `release` 流程：
> `node scripts/prodcheck.mjs --base https://docs.lmuai.com --variant com` / `--base https://docs.lmuai.ai --variant ai`。

---

## 5. 漏了会怎样（失败速查表）

| 你漏了 | 后果 | 谁抓到 |
|---|---|---|
| 只改中文，没建/改英文页 | 缺英文页 / 孤儿英文页 | parity A → **CI 红** |
| `meta.en.json` 没同步 | 英文页 404 或不可达 | parity B → **CI 红** |
| 大陆话术（境内/免代理）没包 `<CN>` | `.ai` 构建失败，或话术漏到国际站 | materialize 守卫 → **CI 红** / prodcheck 7b |
| frontmatter 差异没进 `FRONTMATTER_PHRASES` | 错误定位文案发到 `.ai`（remark 到不了 frontmatter） | 人工 / prodcheck，**CI 抓不到** |
| 源码里写了 `api.lmuai.ai` | 端点改写失效，round-trip 不回来 | prodcheck 端点断言 |
| 用 `<CN>` 包了标题 | 锚点 slug 变 `-1`、链接断 | 人工 review |
| 改 `lib/variant.ts` 的 `com` 分支为非字面量 | 破坏 `.com` 逐字节发布门禁 | release 对比 |
| 手改 `content-ai/**` | 白改（构建期被覆盖） | —— |
| 手改 / stage `content-dates.json` | 与 CI 从 git 刷新的版本冲突 | release 步 0 |
| 改 compliance 交叉引用没更 `COMPLIANCE_LINKS` | `.ai` 构建断链失败 | materialize 守卫 → **CI 红** |
| 编造定价 / 限流 / 延迟 / 在线率 | 事实错误上线 | 人工 / 用户 |

> 注意「CI 抓不到」的两行（frontmatter 定位、写反端点）——CI 门禁覆盖不到，靠这份 skill 和 review 把关。

---

## 6. 相关

- **发布上线**：`release` skill（双站一次 tag 同发、部署、回滚、prodcheck 基线）。
- **不编造事实**：定价 / 限流 / 分组等未核实就问用户或不写（`release` skill 步 0）。
- 关键文件：
  - 变体单一事实源 `lib/variant.ts`；产品文案 `lib/site.ts`
  - i18n `lib/i18n.ts` / `lib/source.ts` / `proxy.ts`
  - 变体标记 `lib/remark-variant.ts`（在 `source.config.ts` 挂载）
  - `.ai` 物化 / 角色对调 `scripts/materialize-variant-content.mjs`（含 `FRONTMATTER_PHRASES` / `BANNED_AI_PHRASES` / `COMPLIANCE_LINKS`）
  - 双语校验 `scripts/check-i18n-parity.mjs`
  - 生产测试 `scripts/prodcheck.mjs`
  - CI 门禁 `.github/workflows/content-guard.yml`
