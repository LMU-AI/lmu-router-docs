# 灵眸文档 — AI API 中转使用指南

> 灵眸 AI API 官方用户文档，支持 Claude Code、Codex CLI、Cursor、VS Code、OpenCode、Cherry Studio、Kilo Code 等主流 AI 编程工具的接入配置。

**文档站：** [https://docs.fulitimes.com](https://docs.fulitimes.com)
**注册地址：** [https://clawapi.fulitimes.com/register?ref=vJaWWr4T](https://clawapi.fulitimes.com/register?ref=vJaWWr4T)

---

## 什么是灵眸 API

灵眸是一个面向开发者的 AI API 中转平台，提供稳定高速的 OpenAI Codex / GPT 系列模型代理服务，支持国内直连。注册即可生成 `sk-` 格式 API 密钥，直接替换各工具中的 API 地址和密钥即可上手使用。

**核心优势：**
- 支持 GPT-5.1 / 5.2 / 5.3 / 5.4 Codex 全系列模型
- 每日额度刷新，天卡 / 周卡 / 月卡灵活选择
- 兼容 OpenAI API 格式，零改造接入各类工具
- 国内可用，走 Cloudflare CDN 加速线路

[立即注册 →](https://clawapi.fulitimes.com/register?ref=vJaWWr4T)

---

## 支持的工具

| 工具 | 平台 | 配置教程 |
|------|------|----------|
| Claude Code | macOS / Linux / Windows | [查看文档](https://docs.fulitimes.com/docs/tools/claude-code) |
| Codex CLI | Windows | [查看文档](https://docs.fulitimes.com/docs/tools/codex-cli-windows) |
| Codex CLI | macOS / Linux | [查看文档](https://docs.fulitimes.com/docs/tools/codex-cli-mac) |
| Codex CLI | 服务器 / WSL2 / SSH | [查看文档](https://docs.fulitimes.com/docs/tools/codex-cli-server) |
| VS Code / Cursor / Trae | 插件配置 | [查看文档](https://docs.fulitimes.com/docs/tools/vscode-plugin) |
| Codex App | 桌面客户端 | [查看文档](https://docs.fulitimes.com/docs/tools/codex-app) |
| OpenCode | 终端 AI 工具 | [查看文档](https://docs.fulitimes.com/docs/tools/opencode) |
| Cherry Studio | 桌面 AI 助手 | [查看文档](https://docs.fulitimes.com/docs/tools/cherry) |
| IntelliJ IDEA (Kilo Code) | JetBrains 插件 | [查看文档](https://docs.fulitimes.com/docs/tools/kilo-code-idea) |
| CC Switch | 一键导入配置 | [查看文档](https://docs.fulitimes.com/docs/tools/cc-switch) |

---

## 快速开始

1. [注册账号](https://clawapi.fulitimes.com/register?ref=vJaWWr4T) — 填写邮箱和密码
2. 登录后点击「**兑换**」— 输入购买时的兑换码
3. 点击「**API 密钥**」→「创建密钥」— 选择对应套餐分组
4. 记下 `sk-` 开头的 API Key 和 API 地址 `https://clawapi.fulitimes.com`
5. 按工具教程完成配置，即可使用

详细步骤：[快速开始文档](https://docs.fulitimes.com/docs/guide/getting-started)

---

## 套餐规格

| 套餐 | 每日额度 | 适合场景 |
|------|----------|----------|
| 标准版 | $90/天 | 日常个人使用 |
| 进阶版 | $135/天 | 中度开发使用 |
| 专业版 | $200/天 | 重度开发 / 团队 |
| 大额套餐 | $400 / $800 / $2000 | 联系客服定制 |

套餐额度**每日自动刷新**，支持天卡、周卡、月卡。详见：[套餐说明](https://docs.fulitimes.com/docs/guide/plans)

---

## 本项目

本仓库是灵眸文档站的源码，基于 [Next.js](https://nextjs.org/) + [Fumadocs](https://fumadocs.vercel.app/) 构建，内容为 MDX 格式。

### 技术栈

- **框架：** Next.js 16 (App Router, 静态导出)
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
npm run build
```

### Docker 部署

```bash
docker-compose up -d
```

---

## 常见问题

遇到报错请先查阅 [常见问题文档](https://docs.fulitimes.com/docs/guide/faq)，涵盖：

- `stream disconnected` 断流超时
- `429 Too Many Requests` 额度用完
- `401 Unauthorized` 密钥配置错误
- Windows 脚本禁止运行
- Node.js 环境问题
- `503 No available accounts` 环境变量覆盖

如仍无法解决，可加入售后 QQ 群：**1044817922**

---

## 相关链接

- [灵眸 API 平台](https://clawapi.fulitimes.com/register?ref=vJaWWr4T)
- [注册账号](https://clawapi.fulitimes.com/register?ref=vJaWWr4T)
- [文档站](https://docs.fulitimes.com)
