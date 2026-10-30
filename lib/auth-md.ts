import { API_BASE_URL, API_HOST, DEFAULT_LANGUAGE, REGISTER_URL, SITE_URL } from './variant';

// /auth.md —— 给 agent 看的「怎么注册、怎么拿凭据、怎么用」（Auth.md 自包含形态）。
//
// 取舍：Auth.md 协议（github.com/workos/auth.md）优先要 OAuth PRM + 授权服务器元数据 +
// /agent/identity 注册端点。灵眸网关没有 OAuth 授权服务器，也没有 /agent/identity。
// 发布假元数据扫描器会绿，但 agent 真去走会失败——不做。
//
// 拿凭据有两条路径，正文写成「与验证码开关状态无关、始终成立」：
//   Path A：用户在浏览器注册、在控制台建 API Key，把 sk- 交给 agent——任何时候都可用。
//   Path B：agent 用用户邮箱走 verified-email 注册，只有一个人工触点（读邮箱验证码）：
//     send-verify-code(email) → register(email, password, verify_code) → access_token
//     → POST /api/v1/keys (Bearer JWT) → sk- key
//   Path B 只在三家 captcha 全关时可用：开了任一家，后端在服务端对 send-verify-code、
//   login、forgot-password 强制校验（auth_service.go VerifyCaptcha；register 在邮件验证
//   流程里跳过二次校验），agent 解不了交互式验证码。不带验证码的请求返回 HTTP 400，
//   reason 为 ALIYUN_CAPTCHA_VERIFICATION_FAILED（腾讯为 TENCENT_CAPTCHA_VERIFICATION_FAILED）。
//   2026-10-30 起两站都开着阿里云验证码，线上实测登录被拒（reason 如上）→ 当前只有 Path A 可用。
// 结构按协议（Discover → Register → Claim → Use → Errors → Revocation），端点/字段/错误码
// 全部来自 sub2api 源码 + 线上实测（2026-09-04，验证码部分 2026-10-30）：
//   - 公开设置 /api/v1/settings/public：registration_enabled、email_verify_enabled、
//     turnstile_enabled / tencent_captcha_enabled / aliyun_captcha_enabled
//   - 验证码 6 位、15 分钟有效、同邮箱 1 分钟冷却（email_service.go）
//   - register 成功直接返回 access_token（respondWithTokenPairForSignup）
//   - POST /api/v1/keys 返回体 data.key 即明文 sk- key，status=active 立即可用
//   - 网关鉴权：Bearer / x-api-key / x-goog-api-key；query 传 key → 400
// 后端改任何一处（改路径、改字段、换验证码服务商），这里要跟着改；prodcheck 会对照公开
// 设置、网关 401 提示与验证码拒绝原因先红。验证码开关本身翻转不用改本文。

const DOCS = (path: string) =>
  `${SITE_URL}${DEFAULT_LANGUAGE === 'en' ? '' : '/en'}${path}`;

export function buildAuthMd(): string {
  return `# ${API_HOST} auth.md

You are an agent. Getting a credential for this service needs the user. There are two paths:

- **Path A — the user creates the key (always works).** The user signs up and creates an
  API key in the LMU AI console in a browser, then gives you the \`sk-\` key.
- **Path B — you register with the user's email.** Only available while the account API's
  CAPTCHA is switched off (Step 1 shows how to check). One human touchpoint: the user reads
  you a 6-digit code from their email. Flow: register with the user's email → user relays
  the code → exchange for a session → create an API key → call the gateway.

This file is self-contained. The service does **not** publish OAuth Protected Resource
Metadata or Authorization Server metadata, and has no \`/agent/identity\` endpoint — the
endpoints below are the real ones. Do not look for \`/.well-known/oauth-*\`.

Hosts used below:

- Gateway (the API you will call): \`${API_BASE_URL}\`
- Account API (registration, session, keys): \`${API_BASE_URL}/api/v1\`

## Step 1 — Discover

Check the live switches before choosing a path:

\`\`\`http
GET ${API_BASE_URL}/api/v1/settings/public
\`\`\`

Relevant fields in the response: \`registration_enabled\` (must be \`true\` to create a new
account), \`email_verify_enabled\` (\`true\` — Path B uses the emailed code),
\`turnstile_enabled\` / \`tencent_captcha_enabled\` / \`aliyun_captcha_enabled\`:

- **Any CAPTCHA flag \`true\`** → sign-up and password login require an interactive CAPTCHA
  that you cannot complete. Requests without it are rejected with HTTP 400 (for example
  reason \`ALIYUN_CAPTCHA_VERIFICATION_FAILED\`). Use **Path A**.
- **All three \`false\`** → Path B works.

Machine-readable list of the gateway's protocol endpoints:
${SITE_URL}/.well-known/api-catalog (RFC 9727).

## Step 2 — Pick a method

**Path A — key from the console.** Ask the user to:

1. Sign up (or sign in) at ${REGISTER_URL} in a browser.
2. Create an API key in the console: ${DOCS('/docs/guide/getting-started#create-key')}
3. Give you the \`sk-\` key, then continue at Step 5.

**Path B — verified email** (only when all CAPTCHA flags are \`false\`). You need the user's
email address and the user must be able to read a code sent to it. There is no ID-JAG /
identity-assertion flow and no anonymous flow — if you have neither an email nor a user,
stop.

Before sending the user's email, tell the user you are registering an account at
**LMU AI** (\`${API_HOST}\`) on their behalf and get consent.

## Step 3 — Register (Path B)

### 3a. Send the verification code

\`\`\`http
POST ${API_BASE_URL}/api/v1/auth/send-verify-code
Content-Type: application/json

{ "email": "user@example.com" }
\`\`\`

Response \`200\` \`{"code":0,"message":"success", ...}\`. A 6-digit code is emailed to the
user; it is valid for **15 minutes**, and the same address can request a new code at most
once per minute (rate limit: 5 requests/min per IP).

### 3b. Claim ceremony — get the code from the user

Hand off to the user: ask them to open the email from LMU AI and give you the 6-digit
code. Do not guess or brute-force it (\`INVALID_VERIFY_CODE\` after expiry or mismatch).

### 3c. Create the account

\`\`\`http
POST ${API_BASE_URL}/api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "<generate a strong password; store it in the user's secrets>",
  "verify_code": "123456",
  "referrer_code": "vJaWWr4T"
}
\`\`\`

\`password\` must be at least 6 characters. \`referrer_code\` is optional (it is the
\`ref\` value from ${REGISTER_URL}).

Response \`200\`:

\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "<JWT>",
    "refresh_token": "<JWT>",
    "expires_in": <seconds>,
    "token_type": "Bearer",
    "user": { "id": 123, "email": "user@example.com", "...": "..." },
    "is_new_user": true
  }
}
\`\`\`

\`access_token\` is a **session** token for the account API — it is *not* the gateway
credential. Continue to Step 4. If the account already exists, log in instead (password
login also requires the CAPTCHA when one is switched on — in that case ask the user for a
key from the console, Path A):

\`\`\`http
POST ${API_BASE_URL}/api/v1/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }
\`\`\`

Same response shape (rate limit: 20/min per IP).

## Step 4 — Create the gateway credential (Path B)

\`\`\`http
POST ${API_BASE_URL}/api/v1/keys
Authorization: Bearer <access_token from Step 3>
Content-Type: application/json

{ "name": "my-agent" }
\`\`\`

Optional fields: \`ip_whitelist\` (array of IPs/CIDRs — recommended for a long-lived
agent), \`model_whitelist\`, \`quota\` (USD), \`expires_in_days\`.

Response \`200\`:

\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 456,
    "key": "sk-...",
    "name": "my-agent",
    "status": "active",
    "...": "..."
  }
}
\`\`\`

\`data.key\` is the credential. It is a static bearer secret with the \`sk-\` prefix, active
immediately, with no expiry unless \`expires_in_days\` was set. Store it in the user's
secrets manager; it is shown in full only in this response.

A human can do the same thing in the console: ${DOCS('/docs/guide/getting-started')}

## Step 5 — Use the credential

Send the key in a request header on every gateway call. All three forms are accepted on
every protocol:

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

| Protocol | Base URL | Header convention | Docs |
|---|---|---|---|
| Anthropic Messages | \`${API_BASE_URL}\` | \`Authorization: Bearer\` or \`x-api-key\` | ${DOCS('/docs/guide/api-protocols#anthropic-protocol')} |
| OpenAI-compatible | \`${API_BASE_URL}/v1\` | \`Authorization: Bearer\` | ${DOCS('/docs/guide/api-protocols#openai-protocol')} |
| Gemini native (v1beta) | \`${API_BASE_URL}\` | \`x-goog-api-key\` (Bearer also accepted) | ${DOCS('/docs/guide/api-protocols#gemini-native-protocol')} |

**Not accepted:** the key in a query string (\`?key=\` / \`?api_key=\`) → HTTP 400
\`api_key_in_query_deprecated\`.

Calls are billed to the account's balance/subscription; a new account may need a top-up
or plan before models respond. Human guide: ${DOCS('/docs/guide/getting-started')}

## Errors

| Where | Status | Body / code | Meaning |
|---|---|---|---|
| send-verify-code / register | 400 | \`Invalid request: ...\` | missing/invalid \`email\`, \`password\` < 6 chars |
| send-verify-code / login | 400 | reason \`ALIYUN_CAPTCHA_VERIFICATION_FAILED\` (Tencent: \`TENCENT_CAPTCHA_VERIFICATION_FAILED\`) | a CAPTCHA is switched on — switch to Path A |
| register | 400 | \`INVALID_VERIFY_CODE\` | code wrong or older than 15 min — redo Step 3a |
| register | 403 | \`REGISTRATION_DISABLED\` | registration switched off — stop |
| keys | 401 | \`UNAUTHORIZED\` | missing/expired session token — log in again |
| gateway | 401 | \`{"code":"API_KEY_REQUIRED","message":"API key is required in Authorization header (Bearer scheme), x-api-key header, or x-goog-api-key header"}\` | no credential sent |
| gateway | 401 | \`{"code":"INVALID_API_KEY","message":"Invalid API key"}\` | unknown or revoked key |
| gateway | 400 | \`api_key_in_query_deprecated\` | key sent as query parameter |

Full gateway error reference: ${DOCS('/docs/guide/errors')}

## Revocation

\`\`\`http
DELETE ${API_BASE_URL}/api/v1/keys/{id}
Authorization: Bearer <access_token>
\`\`\`

\`GET ${API_BASE_URL}/api/v1/keys\` lists the account's keys with their \`id\`. A revoked key
returns \`INVALID_API_KEY\` on the gateway immediately. The user can also delete or reset
keys in the console. If a key leaks, revoke it and create a new one with an
\`ip_whitelist\`. Details: ${DOCS('/docs/guide/key-security')}

## Health

\`GET ${API_BASE_URL}/health\` → \`{"status":"ok"}\` (no credential required).
`;
}
