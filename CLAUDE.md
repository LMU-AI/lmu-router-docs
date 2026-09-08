# limao-docs — 贡献前必读（人与 AI agent 都适用）

> 本仓库**同一套源码构建两个文档站 × 中英双语**。任何内容改动都必须同时满足下面**两条硬规则**，否则 CI 门禁（`.github/workflows/content-guard.yml`）会拦住 PR。
> 动手前请读技能 **`docs-contributing`**（`.claude/skills/docs-contributing/SKILL.md`）——那里有完整流程、示例与「漏了会怎样」速查表。发布上线走技能 **`release`**。

## 两个站（双域名双站）

| | 国内站 | 国际站 |
|---|---|---|
| 域名 | docs.lmuai.com | docs.lmuai.ai |
| 默认语言 | **中文在根** / 英文在 `/en` | **英文在根** / 中文在 `/cn` |
| 变体开关 | `SITE_VARIANT` 未设（默认） | `SITE_VARIANT=ai` |
| API 端点 | `api.lmuai.com` | `api.lmuai.ai`（**构建期自动改写**） |

单一事实源：`lib/variant.ts`。国际站内容目录 `content-ai/`、`content-ai-dates.json` 是**构建期物化产物、已 gitignore——永远别手动改**。两个域名各自独立收录（无跨域 canonical / hreflang）。

## 硬规则一：双语对照（中英 1:1）

- 只在 `content/docs/**` 编辑。页面**成对存在**：`X.mdx`（中文） + `X.en.mdx`（英文）。
- 导航**成对同步**：改了某目录的页面集，`meta.json`（中）和 `meta.en.json`（英）的 `pages[]` 都要改。
- 英文页要**逐节真翻译**，不是只译标题（金额 / URL / 群号 / 邮箱要原样保留）。

## 硬规则二：双站变体（.com 与 .ai 都要对）

- **别碰** `content-ai/`、`content-ai-dates.json`（gitignore 产物，构建期由 `scripts/materialize-variant-content.mjs` 生成）。
- 站点差异的**正文**文案：用块级 `<CN>…</CN>` / `<Intl>…</Intl>` 包裹（**大写、独立成块、前后留空行、绝不包标题**）。
- 站点差异的 **frontmatter** 文案：加进 `scripts/materialize-variant-content.mjs` 的 `FRONTMATTER_PHRASES` 字典（remark 处理不到 frontmatter）。
- 正文里 API 端点一律写 `api.lmuai.com`（`.ai` 构建自动改写）；**别在源码里写 `api.lmuai.ai`**。
- 新增站点常量 / 端点 / 定位文案：改 `lib/variant.ts`（**`com` 分支必须与旧字面量逐字节一致**——`.com` 发布门禁靠它）；产品文案改 `lib/site.ts`。
- `guide/compliance`（备案）是 **.com 独有**，`.ai` 整页排除；改它的交叉引用要同步 `COMPLIANCE_LINKS`。

## 还要注意

- **不编造事实**：定价 / 限流 / 延迟 / 在线率等必须已核实，没有就问用户、别写（详见 `release` skill 步 0）。
- 走**分支 + PR**，不直接提交 `main`。`content-dates.json` 别手改 / 别 stage（CI 从 git 历史刷新）。

## 提交前自检（= CI 门禁跑的两件事，本地绿≈CI 绿）

```bash
node scripts/check-i18n-parity.mjs                             # ① 双语 1:1 + 导航齐全
SITE_VARIANT=ai node scripts/materialize-variant-content.mjs   # ② .ai 变体守卫（大陆话术泄漏 / 断链）
# 更彻底：SITE_VARIANT=ai npm run build（连 .ai 能否真正构建通过一起验）
```
