# 灵眸文档 — AI API 中转使用指南

> 灵眸 AI API 官方用户文档，支持 Claude Code、Codex CLI、Cursor、VS Code、OpenCode、Cherry Studio、Kilo Code 等主流 AI 编程工具的接入配置。

**国际站文档：** [https://docs.lmuai.ai](https://docs.lmuai.ai)（英文为主，中文在 [/cn/docs](https://docs.lmuai.ai/cn/docs)）
**国内站文档：** [https://docs.lmuai.com](https://docs.lmuai.com)（中文为主，英文在 [/en/docs](https://docs.lmuai.com/en/docs)）
**注册地址：** [国际站注册](https://api.lmuai.ai/register?ref=vJaWWr4T) ｜ [国内站注册](https://api.lmuai.com/register?ref=vJaWWr4T)

---

## 什么是灵眸 API

灵眸是目前稳定运行的**商用版 AI API 中转平台**，专为追求稳定性的个人开发者与企业提供 API 服务。**模型保真、服务稳定，是我们的服务核心**——调用什么模型，返回的就是什么模型，不偷换、不降级。注册即可生成 `sk-` 格式 API 密钥，直接替换各工具中的 API 地址和密钥即可上手使用。

### 两个站点，按需选择

|  | 国际站 | 国内站 |
|------|--------|--------|
| API 端点 | `https://api.lmuai.ai` | `https://api.lmuai.com` |
| 模型范围 | **全部模型**：Claude、GPT / Codex、Gemini、Grok 及国产大模型 | **仅国产大模型**：通义千问、DeepSeek、GLM、Kimi、MiniMax、MiMo 等 |
| 网关位置 | 新加坡节点，境外直连 | 中国境内，国内直连 |
| 配套文档 | [docs.lmuai.ai](https://docs.lmuai.ai) | [docs.lmuai.com](https://docs.lmuai.com) |

账号、API 密钥与余额两个站点通用——按需要的模型范围与所处网络环境选择端点即可。

**核心优势：**

- **模型保真**：不偷换、不降级模型，稳定是服务核心
- 支持 GPT-5.1 / 5.2 / 5.3 / 5.4 Codex 全系列模型（国际站）
- 一把 API Key 通用 Anthropic、OpenAI 兼容、Gemini 原生三种协议，零改造接入各类工具
- 每日额度刷新，天卡 / 周卡 / 月卡灵活选择
- 多源故障转移

[国际站注册 →](https://api.lmuai.ai/register?ref=vJaWWr4T) ｜ [国内站注册 →](https://api.lmuai.com/register?ref=vJaWWr4T)

---

## 支持的工具

| 工具 | 平台 | 配置教程 |
|------|------|----------|
| Claude Code | macOS / Linux / Windows | [查看文档](https://docs.lmuai.com/docs/tools/claude-code) |
| Codex CLI | Windows | [查看文档](https://docs.lmuai.com/docs/tools/codex-cli-windows) |
| Codex CLI | macOS / Linux | [查看文档](https://docs.lmuai.com/docs/tools/codex-cli-mac) |
| Codex CLI | 服务器 / WSL2 / SSH | [查看文档](https://docs.lmuai.com/docs/tools/codex-cli-server) |
| VS Code / Cursor / Trae | 插件配置 | [查看文档](https://docs.lmuai.com/docs/tools/vscode-plugin) |
| Codex App | 桌面客户端 | [查看文档](https://docs.lmuai.com/docs/tools/codex-app) |
| OpenCode | 终端 AI 工具 | [查看文档](https://docs.lmuai.com/docs/tools/opencode) |
| Cherry Studio | 桌面 AI 助手 | [查看文档](https://docs.lmuai.com/docs/tools/cherry) |
| IntelliJ IDEA (Kilo Code) | JetBrains 插件 | [查看文档](https://docs.lmuai.com/docs/tools/kilo-code-idea) |
| CC Switch | 一键导入配置 | [查看文档](https://docs.lmuai.com/docs/tools/cc-switch) |
| Gemini 生图 API | Gemini 原生文生图 / 图生图 | [查看文档](https://docs.lmuai.com/docs/api/gemini-image) |
| GPT 生图 API | `gpt-image-2` 文生图 / 图片编辑 | [查看文档](https://docs.lmuai.com/docs/api/gpt-image) |
| Grok 生图 API | Grok 文生图 / 图片编辑 | [查看文档](https://docs.lmuai.com/docs/api/grok-image) |
| Gemini 批量生图 API | Gemini 异步多任务 | [查看文档](https://docs.lmuai.com/docs/api/gemini-image-batch) |

> 上表为国内站文档链接；国际站文档路径相同，把域名换成 `docs.lmuai.ai` 即可（如 [docs.lmuai.ai/docs/tools/claude-code](https://docs.lmuai.ai/docs/tools/claude-code)）。

---

## 快速开始

1. 注册账号（[国际站](https://api.lmuai.ai/register?ref=vJaWWr4T) / [国内站](https://api.lmuai.com/register?ref=vJaWWr4T)）— 填写邮箱和密码
2. 登录后点击「**兑换**」— 输入购买时的兑换码
3. 点击「**API 密钥**」→「创建密钥」— 选择对应套餐分组
4. 记下 `sk-` 开头的 API Key；API 地址按站点选择——国际站 `https://api.lmuai.ai`（全部模型）/ 国内站 `https://api.lmuai.com`（仅国产大模型）
5. 按工具教程完成配置，即可使用

详细步骤：[快速开始文档](https://docs.lmuai.com/docs/guide/getting-started)

---

## 套餐规格

| 套餐 | 每日额度 | 适合场景 |
|------|----------|----------|
| 标准版 | $90/天 | 日常个人使用 |
| 进阶版 | $135/天 | 中度开发使用 |
| 专业版 | $200/天 | 重度开发 / 团队 |
| 大额套餐 | $400 / $800 / $2000 | 联系客服定制 |

套餐额度**每日自动刷新**，支持天卡、周卡、月卡。详见：[套餐说明](https://api.lmuai.com/pricing)

---

## 本项目

本仓库是灵眸文档站的源码，基于 [Next.js](https://nextjs.org/) + [Fumadocs](https://fumadocs.vercel.app/) 构建，内容为 MDX 格式。**同一套代码构建两个文档站**：默认构建产出国内站（docs.lmuai.com，中文在根路径）；`SITE_VARIANT=ai npm run build` 产出国际站（docs.lmuai.ai，英文在根路径），详见 `lib/variant.ts`。

### 技术栈

- **框架：** Next.js 16（App Router，SSG + standalone 输出）
- **文档引擎：** Fumadocs UI + Fumadocs MDX
- **样式：** Tailwind CSS v4
- **语言：** TypeScript

### 本地开发

```bash
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看效果。

### 构建

```bash
npm run build                 # 国内站（docs.lmuai.com）
SITE_VARIANT=ai npm run build # 国际站（docs.lmuai.ai）
```

### Docker 部署

```bash
docker-compose up -d
```

---

## 常见问题

遇到报错请先查阅 [常见问题文档](https://docs.lmuai.com/docs/guide/faq)，涵盖：

- `stream disconnected` 断流超时
- `429 Too Many Requests` 额度用完
- `401 Unauthorized` 密钥配置错误
- Windows 脚本禁止运行
- Node.js 环境问题
- `503 No available accounts` 环境变量覆盖

如仍无法解决，可加入售后 QQ 群：**1044817922**

---

## 相关链接

- [灵眸 API 平台（国际站，全部模型）](https://api.lmuai.ai/register?ref=vJaWWr4T)
- [灵眸 API 平台（国内站，国产模型）](https://api.lmuai.com/register?ref=vJaWWr4T)
- [国际站文档](https://docs.lmuai.ai)
- [国内站文档](https://docs.lmuai.com)
