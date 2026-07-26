FROM node:22-alpine AS builder
WORKDIR /app
# git：构建期由 scripts/build-content-dates.mjs 读取每篇文档的最后提交时间。
# COPY . . 会把所有 mtime 重置成同一时刻，只靠 mtime 会让全站 sitemap lastmod 相同。
RUN apk add --no-cache git
COPY package*.json ./
COPY patches ./patches
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
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
