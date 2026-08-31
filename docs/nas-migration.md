# 将 UPTCG 从 Mac 迁移到 TrueNAS

生产形态与 `card-deck-builder`、`Bandai30` 一致：GitHub 托管 runner 构建
`linux/amd64` 与 `linux/arm64` 镜像并发布到 GHCR；TrueNAS 只拉取镜像，现有的
label-enabled Watchtower 负责更新。NAS 上不安装 GitHub Actions runner。

## 合并前准备

1. 在设置页导出个人资料备份。该备份包含牌组、收藏和置顶，不包含 ntfy 令牌。
2. 在 NAS 创建本地 ZFS dataset，例如
   `/mnt/default_pool/appdata/uptcg`，所有者设为运行 Apps 的 `568:568`。
3. 在仓库的 GitHub Actions secrets/variables 配置：
   - `TS_AUTHKEY`，或 `TS_OAUTH_CLIENT_ID` + `TS_OAUTH_SECRET`
   - `NAS_WATCHTOWER_TOKEN`
   - `NAS_HOST`（secret 优先，也可用 variable）
   - `NAS_WATCHTOWER_PORT=8080`（可省略，默认值相同）
   - `NAS_APP_PORT=3002`（可省略，默认值相同）

不要让 Mac 和 NAS 同时写同一份 SQLite 文件，也不要把数据库放在 SMB/NFS
挂载上。

## 首次发布

合并迁移 PR 后，`image.yml` 会产生
`ghcr.io/jibril2333/uptcg-app:latest`。首次产生包后确认 GHCR package 对 NAS
可读；当前共享 Watchtower 未挂载 registry 凭据，因此该 package 应设为公开。

在 TrueNAS Custom App 中使用 `compose.nas.yaml`，至少设置：

```text
UPTCG_DATA_DIR=/mnt/default_pool/appdata/uptcg
UPTCG_UID=568
UPTCG_GID=568
UPTCG_PORT=3002
UPTCG_LAN_HOST=<NAS 的局域网名称或地址>
```

空 dataset 会触发完整官方卡表资料同步；卡面由浏览器直接从 UA 官网加载，
不会写入 dataset。同步完成前应用不会监听端口，容器日志会显示进度。服务健康
后，在设置页导入先前的个人资料备份并重新填写 ntfy 令牌。

如果选择离线搬运整份数据而不是重新同步，必须先停止 Mac 上的 `uptcg-app`
容器，再由管理员把完整数据目录复制到上述 dataset；复制完成后将所有文件的
owner 调整为 `568:568`。不要在源容器运行时直接复制 SQLite 主文件。

## 验证与切换

1. `http://<NAS>:3002/api/health` 返回 `ok: true`，且 `version` 为刚合并的提交。
2. 检查首页、卡表、牌组、收藏、设置页以及一项写入操作。
3. 将 Cloudflare Tunnel 的 UPTCG origin 改为 NAS 的 `http://<NAS>:3002`。
4. 通过域名复查以上页面和写入，再停止 Mac 上的旧容器。
5. 确认后停用并移除 Mac 上旧的 `uptcg-mac-mini` self-hosted runner；新的
   workflow 不再向它派发任务。

旧容器和旧数据先保留作回滚，确认 NAS 稳定后再另行决定是否清理。
