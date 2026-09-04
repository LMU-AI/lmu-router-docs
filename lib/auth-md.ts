import { API_BASE_URL, API_HOST, DEFAULT_LANGUAGE, REGISTER_URL, SITE_URL } from './variant';

// /auth.md —— 给 agent 看的「怎么拿凭据、怎么用」说明（Auth.md 自包含形态）。
//
// 取舍：Auth.md 规范优先要的是 OAuth PRM + 授权服务器元数据 + agent_auth 自助注册块。
// 灵眸网关没有 OAuth 授权服务器，注册也需要人机验证（Turnstile / 腾讯验证码），
// 不存在 agent 可自助调用的注册端点。发布一份假的 OAuth 元数据或编一个
// /agent/auth 端点，扫描器会绿，但 agent 真去走会失败——所以这里走规范允许的
// 「If OAuth metadata is not available, keep /auth.md self-contained」路线：
// 如实写清 ① 凭据由人在控制台创建 ② 三种请求头 ③ 401/400 的真实响应 ④ 撤销方式。
//
// 每一条都对应线上实测（2026-09-04）：
//   - 无凭据 → 401 {"code":"API_KEY_REQUIRED", message 列出三个头}
//   - query ?key= / ?api_key= → 400 {"code":"api_key_in_query_deprecated"}
//   - Bearer / x-api-key / x-goog-api-key 三个头都被识别（假 key 得 INVALID_API_KEY）
//   - Key 前缀 sk-（sub2api api_key_service.go）
// 改后端鉴权逻辑时要同步这里；prodcheck 会拿 401 body 与本文对照。

const DOCS = (path: string) =>
  `${SITE_URL}${DEFAULT_LANGUAGE === 'en' ? '' : '/en'}${path}`;

export function buildAuthMd(): string {
  return `# ${API_HOST} auth.md

> How an AI agent obtains and uses credentials for the LMU AI gateway (\`${API_BASE_URL}\`).
> This document is self-contained: the gateway does not publish OAuth authorization-server
> metadata and has no agent self-registration endpoint. Nothing below requires a browser
> except the one-time human step of creating an API key.

## Audience

Agents and automated clients calling the LMU AI gateway through any of its three protocols:

| Protocol | Base URL | Docs |
|---|---|---|
| Anthropic Messages | \`${API_BASE_URL}\` | ${DOCS('/docs/guide/api-protocols#anthropic-protocol')} |
| OpenAI-compatible | \`${API_BASE_URL}/v1\` | ${DOCS('/docs/guide/api-protocols#openai-protocol')} |
| Gemini native (v1beta) | \`${API_BASE_URL}\` | ${DOCS('/docs/guide/api-protocols#gemini-native-protocol')} |

Machine-readable list of these endpoints: ${SITE_URL}/.well-known/api-catalog (RFC 9727).

## Credential type

A single static **API key** with the \`sk-\` prefix. It is a bearer secret; there is no
token exchange, refresh flow, or scope negotiation.

## Registration / provisioning

Provisioning is a **human step, not an API call**:

1. A person registers an account at ${REGISTER_URL} (sign-up requires human verification;
   there is no programmatic registration endpoint for agents).
2. In the console, open **API Keys** and create a key.
3. Hand the key to the agent through its configuration (environment variable, secrets
   manager, or the client's own config file). Do not embed it in prompts or code.

Human walkthrough: ${DOCS('/docs/guide/getting-started')}

## Using the credential

Send the key in a request header. All three forms are accepted on every protocol:

\`\`\`http
Authorization: Bearer sk-...
\`\`\`

\`\`\`http
x-api-key: sk-...
\`\`\`

\`\`\`http
x-goog-api-key: sk-...
\`\`\`

Per protocol, as documented:

- Anthropic protocol: \`Authorization: Bearer\` or \`x-api-key\`
- OpenAI-compatible: \`Authorization: Bearer\`
- Gemini native: \`x-goog-api-key\` recommended, Bearer also accepted

**Not accepted:** the key in a query string (\`?key=\` or \`?api_key=\`) is rejected with
HTTP 400 \`api_key_in_query_deprecated\`.

## Error responses

| Situation | Status | Body |
|---|---|---|
| No credential | 401 | \`{"code":"API_KEY_REQUIRED","message":"API key is required in Authorization header (Bearer scheme), x-api-key header, or x-goog-api-key header"}\` |
| Unknown or revoked key | 401 | \`{"code":"INVALID_API_KEY","message":"Invalid API key"}\` |
| Key passed as query parameter | 400 | \`{"code":"api_key_in_query_deprecated", ...}\` |

Full error reference: ${DOCS('/docs/guide/errors')}

## Revocation and rotation

Keys are revoked or reset by a person in the console; there is no revocation API.
If a key leaks, delete or reset it in the console immediately. An optional IP allowlist
on the key limits what a leaked key can do from unknown addresses.
Details: ${DOCS('/docs/guide/key-security')}

## Health

\`GET ${API_BASE_URL}/health\` → \`{"status":"ok"}\` (no credential required).
`;
}
