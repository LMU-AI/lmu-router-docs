---
name: release
description: 发布上线灵眸文档站——同时更新国内 docs.lmuai.com 与海外 docs.lmuai.ai 两台机。当有人说「发布上线 / 发版 / 上线 / 部署文档 / release / deploy docs」时用。流程：提交代码→PR 合并进 main→在 main 打 tag→GitHub Action 出「双架构（amd64+arm64）× 双变体（com/ai）」镜像→北京+海外两台机 pull 部署→双站验证。
---

# 发布上线灵眸文档站（docs.lmuai.com + docs.lmuai.ai）

> **「发布上线」默认 = 两个站一起发**：国内 `.com`（北京 amd64）与海外 `.ai`（海外 arm64）同一次 tag、同时部署。
> 每次发布两个变体都会重新构建、镜像 digest 都会翻转——即使某次改动只影响其中一个变体（另一个变体 RENDERED 内容不变，但仍是新构建的镜像）。「这次有没有真实变化」看页面/prodcheck，不是看 digest（见 §6）。

这份 skill 提交在仓库里，**任何 clone 到本仓库的成员都能用**，不依赖任何个人机器上的本地 skill。照着做即可把「代码写完」发到两台生产机。

---

## 1. 拓扑（两台独立生产机）

| | 国内 `.com` | 海外 `.ai` |
|---|---|---|
| 域名 | docs.lmuai.com | docs.lmuai.ai |
| 机器 | `work@47.92.165.32`（北京，**amd64**） | `work@8.222.155.17`（海外，**arm64/aarch64**） |
| 项目目录 | `/home/work/routerDocs` | `/home/work/docs` |
| compose service | `limao-docs` | `limao-docs-ai` |
| 镜像 tag | `submit2mxh/lmu-router-docs:latest` | `submit2mxh/lmu-router-docs:latest-ai` |
| host 端口 | `3004` → 容器 3000 | `127.0.0.1:3005` → 容器 3000 |
| 反代 | Caddy（不在本仓库/不在本机）→ 3004 | 同机 Caddy `/etc/caddy/Caddyfile` vhost → 3005 |
| 变体机制 | `SITE_VARIANT=com`（未设时的默认，产物逐字节=历史） | `SITE_VARIANT=ai`（英文在根、端点 api.lmuai.ai） |

镜像源：**同一个 Docker Hub 仓库** `submit2mxh/lmu-router-docs`，两个变体靠 tag 后缀区分（com 无后缀、ai 加 `-ai`）。

---

## 2. GitHub Action 已就绪——不要重写

`.github/workflows/docker-build.yml` 已经做到「x86 + arm64 两个镜像」这件事，一次 tag 出 **4 个 tag**：

| tag | 变体 | 架构（同一 manifest 内） | 谁用 |
|---|---|---|---|
| `latest` / `vX.Y.Z` | com | linux/amd64 **+** linux/arm64 | 北京机 |
| `latest-ai` / `vX.Y.Z-ai` | ai | linux/amd64 **+** linux/arm64 | 海外机 |

- `PLATFORMS: linux/amd64,linux/arm64` → 每个 tag 都是**多架构 manifest**，`docker pull` 会自动挑本机架构。**arm64 镜像一直都有**——海外偶发拉不动是那台机的 DNS/mirror 问题（见 §7 的中转 fallback），不是镜像缺 arm 架构。
- 变体矩阵 `{com, suffix:''}` / `{ai, suffix:'-ai'}`，`fail-fast:false`（一条腿抖动不拖死另一条）。
- 每变体独立 buildcache（`:buildcache` / `:buildcache-ai`），互不覆盖。
- GitHub Release 只在 com 腿创建（一个 tag 一个 Release）。
- `guard` job：**tag 指向的 commit 必须在 `main` 上**才构建——这就是下面流程「先合并、再打 tag」的原因。
- `rebuild-on-merge.yml`：PR 合并后若 `vX` 或 `vX-ai` 任一缺失，自动补一次构建（矩阵一次补齐两变体）。

> 可选后续优化（**不要顺手塞进一次发布**，会动 CI）：把 arm64 腿从 QEMU 模拟换成原生 arm64 runner（`ubuntu-24.04-arm`），根治 §7 的 SIGILL 抖动。要做单独开 PR、单独验证。

---

## 3. 发布全流程（先合并 → 再在 main 打 tag）

从「代码写完」到「双站验完」约 35 分钟，其中 ~20 分钟在等 CI 与 pull。

### 步 0 — 预检

- [ ] 改动在**分支**上，不直接提交 `main`（团队规矩）。
- [ ] 动了**双语内容**：`node scripts/check-i18n-parity.mjs` 绿（中英 1:1 + 导航一致）。
- [ ] 动了 `.ai` 会看到的内容：`SITE_VARIANT=ai npm run build` 能过（物化脚本有大陆话术禁词扫描，新增「境内/免代理」类措辞会让 ai 构建**失败**——去包 `<CN>/<Intl>` 或加短语字典）。
- [ ] **不编造事实**：定价 / 限流 / 延迟 / 在线率必须是已核实的，没有就问用户或不写。
- [ ] `content-dates.json` **不要手动改/stage**——它由 CI 从 git 历史刷新（本地 `npm run build` 会重生成它，发版前 `git checkout -- content-dates.json` 还原）。

### 步 1 — 合并进 main

```bash
gh pr create --fill --base main        # 若还没建 PR
gh pr merge <N> --merge                # 用 --merge，不要 squash
```

### 步 2 — 在 main 上打 tag（版本 = 上个 tag 的 patch + 1）

```bash
git checkout main && git pull
git tag --sort=-v:refname | head -1    # 看上一个版本，例 v0.1.35 → 下一个 v0.1.36
git tag v0.1.36
git push origin v0.1.36                # 推 tag 触发 docker-build.yml
```

> 破坏性/大改动才升 minor（v0.2.0）；日常内容与修复升 patch。

### 步 3 — 等 CI 出镜像（~8–10 min），确认 4 个 tag 都推成

```bash
gh run list --workflow=docker-build.yml --limit 5 \
  --json databaseId,headBranch,status,conclusion \
  --jq '.[] | "\(.databaseId) \(.headBranch) \(.status)/\(.conclusion)"'

# run 整体 success 也可能某个 job skipped/failed——逐 job 看
gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'

# 抄两条腿的目标 digest（部署成功的判定基准）
gh run view <id> --log 2>/dev/null | grep 'containerimage.digest'

# 确认日期刷新那步真的跑了（决定 sitemap lastmod 与页面「最后更新」）
gh run view <id> --log 2>/dev/null | grep "篇有 git 时间"
```

想直接问 registry「某 tag 到底有没有」，**在目标机上 `docker pull`**（Mac/本地直连 Docker Hub API 常超时）：

```bash
ssh work@47.92.165.32 'docker pull -q submit2mxh/lmu-router-docs:v0.1.36 2>&1 | head -3'      # com
ssh work@8.222.155.17 'docker pull -q --platform linux/arm64 submit2mxh/lmu-router-docs:v0.1.36-ai 2>&1 | head -3'  # ai（海外是 arm64）
# "manifest unknown" = 没产出；能拉 = 有
```

- **build-and-push 是 `skipped`**：tag 打在了 PR 未合并时（commit 不在 main）→ guard 跳过。本流程「先合并再打 tag」不会遇到；万一遇到，`rebuild-on-merge` 会在合并后自动补，或手动 `gh workflow run docker-build.yml --ref v0.1.36 -f ref=v0.1.36`。
- **build-and-push 是 `failure`**：多半是 arm64 QEMU SIGILL（见 §7），直接重跑同一条命令即可。

### 步 4 — 两台机同时部署

**`docker compose pull` 实测 ~10 分钟**（~258MB × 双平台走国内 mirror），必然超过前台 300s 超时。**用 `run_in_background: true` 跑，别用前台。** 生产站全程不中断（`up -d` 排在 `pull` 之后，老容器服务到新镜像落地）。

#### 4a — 北京 `.com`

```bash
ssh work@47.92.165.32 'set -e; cd /home/work/routerDocs
echo "=== 部署前 :latest digest ==="
docker inspect submit2mxh/lmu-router-docs:latest --format "{{index .RepoDigests 0}}" 2>/dev/null || echo "no local latest"
echo "=== pull ==="
docker compose pull 2>&1 | tail -6
echo "=== 部署后 :latest digest ==="
docker inspect submit2mxh/lmu-router-docs:latest --format "{{index .RepoDigests 0}}"
echo "=== up -d ==="
docker compose up -d 2>&1 | tail -4
echo "=== ps ==="
docker compose ps
echo "=== http 自检（sleep 等冷启，别急）==="
sleep 8
curl -sSI -m 8 http://127.0.0.1:3004/ | head -1
curl -sSI -m 8 http://127.0.0.1:3004/docs/enterprise | head -1'
```

预期：`/` → **308**（跳 /docs，正常），`/docs/enterprise` → **200**。

#### 4b — 海外 `.ai`

先确认 compose 文件名（机器上可能叫 `docker-compose.yml`，也可能保留 `docker-compose.ai.yml`；后者要 `-f`）：

```bash
ssh work@8.222.155.17 'ls -la /home/work/docs'
```

```bash
ssh work@8.222.155.17 'set -e; cd /home/work/docs
echo "=== 部署前 :latest-ai digest ==="
docker inspect submit2mxh/lmu-router-docs:latest-ai --format "{{index .RepoDigests 0}}" 2>/dev/null || echo "no local latest-ai"
echo "=== pull ==="
docker compose pull 2>&1 | tail -6          # 若 compose 文件名非默认，改成： docker compose -f docker-compose.ai.yml pull
echo "=== 部署后 :latest-ai digest ==="
docker inspect submit2mxh/lmu-router-docs:latest-ai --format "{{index .RepoDigests 0}}"
echo "=== up -d ==="
docker compose up -d 2>&1 | tail -4
echo "=== ps ==="
docker compose ps
echo "=== http 自检 ==="
sleep 8
curl -sSI -m 8 http://127.0.0.1:3005/ | head -1
curl -sSI -m 8 http://127.0.0.1:3005/docs | head -1'
```

预期：`/` → **308**（跳 /docs，海外站根路径是英文），`/docs` → **200**。
**若 pull 卡住不动 → 那台机 DNS/mirror 挂了，走 §7 的北京中转 fallback。**

### 步 5 — 双站验证

```bash
# ① 本次改了什么就查什么（举例）
curl -sSL https://docs.lmuai.com/docs/enterprise | grep -c "关键词"
curl -sSL https://docs.lmuai.ai/docs             | grep -c "api.lmuai.ai"   # .ai 正文端点应是 .ai

# ② 每次都查：最后更新逐页不同（全站同一天 = CI 日期步没生效）
for p in enterprise guide/faq; do
  printf '%-14s ' "$p"; curl -sSL "https://docs.lmuai.com/docs/$p" | grep -o '最后更新：<time[^>]*>[^<]*' | head -1
done
# sitemap lastmod 种类数 > 1
curl -sSL https://docs.lmuai.com/sitemap.xml | grep -o '<lastmod>[^<]*' | sort -u | wc -l

# ③ 全量回归（两个变体各一次，按 --base 域名推断变体断言）
node scripts/prodcheck.mjs --base https://docs.lmuai.com --variant com
node scripts/prodcheck.mjs --base https://docs.lmuai.ai  --variant ai
```

基线（对照当前 `prodcheck` 输出，数字会随页数/规则微调）：
- `.com`：live 唯一已知红 = **HSTS**（要在 Caddy 加，不在本仓库）。除它以外任何红都要查清。
- `.ai`：若 Cloudflare 仍开着 AI 爬虫拦截，会有几条红（GPTBot/ClaudeBot 403 + robots 被 CF 覆写）——**这是代码外问题，需在 CF 面板关**（见 §7）。关掉后应满绿。

---

## 4. 判定「本次是否真的换了版本」

**digest 变化 = 真更新；digest 相同 = no-op。** 且部署后 digest 必须**等于步 3 从 CI 抄下的那个**，才说明生产跑的确实是这次的镜像。

```
部署前 digest: sha256:118c9494...
部署后 digest: sha256:2866db74...   ← 变了，且=CI 那个 → 成功
```

---

## 5. 回滚

Docker 保留镜像层，回退到上一个 digest（**不要 `docker system prune`——旧层就是回滚素材**）：

```bash
# 北京 .com
ssh work@47.92.165.32 'cd /home/work/routerDocs
docker image ls submit2mxh/lmu-router-docs --format "{{.Tag}} {{.ID}} {{.CreatedSince}}" | head
docker tag submit2mxh/lmu-router-docs:v0.1.35 submit2mxh/lmu-router-docs:latest && docker compose up -d'

# 海外 .ai（注意 -ai 后缀）
ssh work@8.222.155.17 'cd /home/work/docs
docker tag submit2mxh/lmu-router-docs:v0.1.35-ai submit2mxh/lmu-router-docs:latest-ai && docker compose up -d'
```

---

## 6. digest 每次都翻转；「no-op」指拉不到新镜像

每次成功发布，CI 都重新构建 com 与 ai 两个变体，**两个镜像 digest 都会翻转**——哪怕某次改动只影响一个变体（另一个变体 RENDERED 内容不变，但镜像是新构建的：`COPY . .` 的缓存键、层 mtime 都变了）。所以「某变体这次有没有真实变化」要看**页面内容 / prodcheck**，不是看 digest。

真正的 **no-op = `docker compose pull` 拉不到比在跑的更新的镜像**（digest 不翻转）。几乎总是因为 CI 还没出新 `:latest`/`:latest-ai`：build 还在跑、被 guard skip、或 failed。遇到就回步 3 查 CI，**别在机器上反复 pull**。

---

## 7. 坑 & fallback

1. **arm64 QEMU SIGILL（间歇）**：`docker-build.yml` 的 arm64 腿偶发
   `qemu: uncaught target signal 4 (Illegal instruction)` → `SIGILL`，出现在 `Generating static pages`。**不是代码问题**（同 commit 重跑即过，amd64 从不失败）。处理：`gh workflow run docker-build.yml --ref v0.1.36 -f ref=v0.1.36`。同 tag 连挂 2 次以上，再考虑临时把 `PLATFORMS` 收成 `linux/amd64`（仅当那次不急着更新海外机时）。

2. **海外机 pull 卡死（DNS/mirror）**：那台机 `systemd-resolved` 上游是阿里内网、`daemon.json` 首个 mirror 是腾讯内网，都可能不可达 → `docker compose pull` 挂住。**绕过 = 从能正常拉的机器中转**（北京机、或 Apple Silicon Mac 都能出 arm64）：

   ```bash
   # 在北京机（或本地 arm64 机器）拉 arm64 镜像，save 后 ssh 灌进海外机
   ssh work@47.92.165.32 'docker pull --platform linux/arm64 submit2mxh/lmu-router-docs:v0.1.36-ai && docker save submit2mxh/lmu-router-docs:v0.1.36-ai' \
     | ssh work@8.222.155.17 'docker load'
   # 灌好后在海外机 retag 成 latest-ai 并起容器
   ssh work@8.222.155.17 'docker tag submit2mxh/lmu-router-docs:v0.1.36-ai submit2mxh/lmu-router-docs:latest-ai
     cd /home/work/docs && docker compose up -d'
   ```

   **坑：海外机是 aarch64——中转必须 `--platform linux/arm64`**，默认会拉 amd64，容器起不来（`exec format error`）。回滚素材是 dangling 的旧 arm64 image（`docker image ls -a --filter dangling=true` 找 ID retag）。
   根治方向（需运维/有 sudo）：修 resolved 上游，或把 `daemon.json` mirror 换成该机可达的（如 daocloud）。

3. **Cloudflare 拦 AI 爬虫（仅 .ai，代码外）**：`docs.lmuai.ai` 的 DNS 在 Cloudflare 橙云代理，zone 开了 AI 爬虫拦截 → GPTBot/ClaudeBot/Perplexity 等 403，且 CF 覆写 `robots.txt`。**这与海外站做 GEO 的目的直接冲突**，需在 **CF 面板关**（AI Crawl Control / Block AI bots），代码侧无解。Googlebot/Baidu/Bing 正常。

4. **别把 compose 的 image tag 固化成具体版本**（如 `:v0.1.36`）——那样以后 `latest`/`latest-ai` 更新后 `pull` 不再自动生效。除非明确要钉住某版。

5. **`.dockerignore` 里的 `.git` 必须保留**：CI 用 `cache-to: mode=max` 导出所有层到**公开** buildcache，`.git` 一旦进构建上下文，`GITHUB_TOKEN` 会随缓存发到公网（已实际发生过）。别动它。

6. **`docker compose ps --format` 在目标机可能报错**（Compose v2.17.3 不支持该 template）——用不带 `--format` 的 `docker compose ps`。

7. **同机可能还有别的容器**（北京机上有个 `lmu-docs` / `submit2mxh/lmu-docs`，跑了几个月，**不是本项目**）。本项目容器前缀是 `limao`（`limao-docs` / `limao-docs-ai`），别误操作。

---

## 8. 相关

- CI 主 workflow：`.github/workflows/docker-build.yml`（双架构 × 双变体矩阵 + guard + Release + 日期刷新步）
- CI 补构建：`.github/workflows/rebuild-on-merge.yml`
- compose 参考：`docker-compose.yml`（com）、`docker-compose.ai.yml`（ai，含海外 Caddy vhost 示例）
- 变体机制单一事实源：`lib/variant.ts`；`.ai` 内容物化：`scripts/materialize-variant-content.mjs`
- 生产测试套件：`scripts/prodcheck.mjs`（`--variant com|ai`）
