FROM node:22-alpine AS builder
WORKDIR /app
# 站点变体：com（默认，docs.lmuai.com）/ ai（docs.lmuai.ai）。默认值保证不传
# build-arg 的构建与旧行为逐字节一致。域名/端点/默认语言/定位文案全在构建期
# 按它烤死（SSG），见 lib/variant.ts。
ARG SITE_VARIANT=com
ENV SITE_VARIANT=${SITE_VARIANT}
# 刻意不装 git、也不把 .git 放进构建上下文（见 .dockerignore）：
# CI 的 cache-to 是 mode=max，会把 builder 的每一层导出到公开可读的 :buildcache，
# 而 actions/checkout 默认把 GITHUB_TOKEN 写进 .git/config —— 那等于公网发凭据。
# sitemap 的 lastmod 改由随仓库提交的 content-dates.json 提供，不需要构建期读 git。
COPY package*.json ./
COPY patches ./patches
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# ARG 不跨 FROM，需重声明。一切已在构建期烤死，这个运行期 ENV 只是给
# proxy.ts 中间件的 process.env 读取兜底，保证与烤死的页面永不打架。
ARG SITE_VARIANT=com
ENV SITE_VARIANT=${SITE_VARIANT}
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# standalone 产物不含 public/。正文图片走 /_next/image（构建期已编译进 static），
# 但 favicon.ico 及任何直引 /images/... 的静态文件都需要这一行。
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
