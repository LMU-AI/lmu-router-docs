---
name: deploy-docs
description: 发布 docs.lmuai.com。触发场景：用户说 "发布 / 上线 / 更新线上 / 部署 / deploy docs" 且当前项目是 limao-docs / lmu-router-docs。SSH 到 work@47.92.165.32:/home/work/routerDocs 拉 :latest 并 up -d，含幂等检测和验证。
---

# 部署 docs.lmuai.com

## 拓扑

- **源**：本仓库 `LMU-AI/lmu-router-docs`，CI 打 tag → GitHub Actions build → 推送 `submit2mxh/lmu-router-docs:${tag}` 与 `:latest` 到 Docker Hub
- **目标机**：`work@47.92.165.32`
- **项目目录**：`/home/work/routerDocs`（仅 `docker-compose.yml`，无 git 源码）
- **compose service**：`limao-docs`，image = `submit2mxh/lmu-router-docs:latest`，host 端口 3004 → 容器 3000
- **前端反代**：Caddy（不在本仓库、不在本机管），把 `docs.lmuai.com` 转到 3004

## 部署前提

不要跳过：

1. **确认目标 tag 已构建**：CI 里对应 tag 的 `Docker Build & Push` run 必须 `success` 且 build-and-push job **未 skip、未 failure**。

   ```bash
   gh run list --workflow=docker-build.yml --limit 5 \
     --json databaseId,headBranch,status,conclusion \
     --jq '.[] | "\(.databaseId) \(.headBranch) \(.status)/\(.conclusion)"'
   # 再逐个 run 看 job 级结论——run 整体 success 也可能 build-and-push: skipped
   gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
   ```

   两种「有 run 但没镜像」的情况：
   - **skipped**：tag 在 PR 未 merge 时打的，guard 判定 commit 不在 main 上 → `docker compose pull` 拿到的还是老 :latest → **部署无效果**（幂等 no-op）。PR#9 (v0.1.17+) 的 `rebuild-on-merge.yml` 会在 PR merge 后自动补构建。
   - **failure**：见「坑 5」的 arm64 SIGILL，重试即可。

   手动补：`gh workflow run docker-build.yml --ref vX.Y.Z -f ref=vX.Y.Z`（PR 已 merge 且 commit 在 main 上才会成功）

   想直接问 registry「这个 tag 到底有没有」，**在目标机上用 `docker pull`**（原因见「坑 1」）：

   ```bash
   ssh work@47.92.165.32 'docker pull -q submit2mxh/lmu-router-docs:vX.Y.Z 2>&1 | head -3'
   # "manifest unknown" = 镜像不存在，CI 没产出
   ```
2. **别在 tag push 后立刻部署** —— build 要 ~8-10 min

## 部署步骤

一条 SSH 命令跑完，含前后 digest 对比和 http 自检：

```bash
ssh work@47.92.165.32 'set -e; cd /home/work/routerDocs
echo "=== 部署前 :latest digest ==="
docker inspect submit2mxh/lmu-router-docs:latest --format "{{index .RepoDigests 0}}" 2>/dev/null || echo "no local latest"
echo
echo "=== docker compose pull ==="
docker compose pull 2>&1 | tail -6
echo
echo "=== 部署后 :latest digest ==="
docker inspect submit2mxh/lmu-router-docs:latest --format "{{index .RepoDigests 0}}"
echo
echo "=== 重建容器 ==="
docker compose up -d 2>&1 | tail -4
echo
echo "=== 容器状态 ==="
docker compose ps
echo
echo "=== 本机 http 自检 ==="
sleep 4
curl -sSI -m 8 http://127.0.0.1:3004/ | head -1
curl -sSI -m 8 http://127.0.0.1:3004/docs/enterprise | head -1'
```

## 判定「本次是否真的推送了新版本」

关键：**digest 变化 = 真更新；digest 相同 = no-op**。

```
部署前 digest: sha256:47913f8f...
部署后 digest: sha256:47913f8f...   ← 相同 → 什么也没换，Docker Hub :latest 未更新
```

no-op 时不用惊慌，也不用重试；99% 情况是 CI 还没跑完或该 tag 的 build 被 skip 了。回上面「部署前提」核查。

## 验证发布内容

从**外网**验证具体页面确实换了新内容（比本机自检更可靠——过 Caddy 全链路）：

```bash
# 举例：验证 PR#11 的「40 起」并发列
curl -sSL https://docs.lmuai.com/docs/enterprise | grep -c "40 起"     # 期望 ≥ 1
# 举例：验证 PR#10 的 LMU 全称
curl -sSL https://docs.lmuai.com/docs/     | grep -c "Large Model Unified"
```

## 回滚

Docker 保留镜像层，回退到上一个 digest：

```bash
ssh work@47.92.165.32 'cd /home/work/routerDocs
docker image ls submit2mxh/lmu-router-docs --format "{{.Tag}} {{.ID}} {{.CreatedSince}}" | head
# 找到想回退的 tag（例 v0.1.11）后：
docker tag submit2mxh/lmu-router-docs:v0.1.11 submit2mxh/lmu-router-docs:latest
docker compose up -d'
```

不要 `docker system prune` —— 旧镜像层就是回滚素材。

## 已踩过的坑

1. **查「某个 tag 有没有发布」只有一条路走得通：目标机上 `docker pull`。** 另外两条都不通：
   - **Mac 上 `curl https://hub.docker.com/v2/...`** —— 15s timeout，连不上 Docker Hub HTTP API。
   - **目标机上 `docker manifest inspect`** —— 报 `error pinging v2 registry: ... Client.Timeout exceeded`。该命令**绕过 registry mirror 直连 `registry-1.docker.io`**，而那个域名在目标机的网络下不可达。

   目标机 `/etc/docker/daemon.json` 配了 4 个国内加速器（daocloud / 1panel / 1ms / 百度云），`docker pull` 和 `docker compose pull` 走 mirror，所以正常。判读：`manifest unknown` = 镜像确实不存在；能拉下来 = 存在。

   注意 `docker inspect <image>` 查的是**本地已有**镜像，不回答「registry 上有没有」——只适合做部署前后的 digest 对比。
2. **`:latest` 有滞后**：只有当 CI 的 `Build & push` 步骤成功执行时才会更新 :latest。tag push 但 guard skip → :latest 不动。
3. **同机上还有一个 `lmu-docs` 容器**（`submit2mxh/lmu-docs:latest`，跑了 2 个月）—— 那**不是本项目**，别误操作。本项目是 `limao-docs`（前缀 `limao`）。
4. **别改 compose 的 image tag 为具体版本**（如 `:v0.1.16`）—— 那样 `rebuild-on-merge` 更新 :latest 后就不会自动生效，需要手动改文件。除非明确要固化某版。
5. **arm64 构建会间歇性 SIGILL**（已在 v0.1.16、v0.1.19 各发生一次）：

   ```
   qemu: uncaught target signal 4 (Illegal instruction) - core dumped
   ⨯ Next.js build worker exited with code: null and signal: SIGILL
   ```

   出现在 `Generating static pages` 阶段——QEMU 模拟 arm64 时 Next.js 的 worker 撞上不支持的指令，**不是代码问题**（同一 commit 重试即可通过，amd64 从未失败）。处理：直接重跑 `gh workflow run docker-build.yml --ref vX.Y.Z -f ref=vX.Y.Z`。
   若同一 tag 连续失败 2 次以上，再考虑把 `docker-build.yml` 的 `PLATFORMS` 临时收成 `linux/amd64`（目标机 47.92.165.32 是 amd64，arm64 只为本地 Mac 备用）。

## 相关

- CI 修 race 的 workflow：`.github/workflows/rebuild-on-merge.yml`
- CI 主 workflow：`.github/workflows/docker-build.yml`
- 生产测试套件：`scripts/prodcheck.mjs`（`npm run prodcheck` 打 live 站的 77 项断言，deploy 后应该跑一遍）
