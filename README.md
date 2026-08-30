# UPTCG 本地版

仿照 [uptcg.app](https://uptcg.app) 首页制作的本地版本。保留深色视觉、响应式导航、功能介绍与系列卡片，并移除了顶部轮播横幅、侧栏广告、Cookie 弹窗和第三方追踪。

## 在这台 Mac 上运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址。生产模式：

```bash
npm run build
npm run start
```

默认开发地址为 `http://localhost:3000`。

官方卡牌目录位于 `http://localhost:3000/cards`。当前已缓存 UNION ARENA 官方卡表中的 56 个作品、168 个分类数据组，共 10,265 张卡牌资料与本地卡图。宣传卡与限定商品卡会按卡号中的作品代码归入对应作品，通用 AP 卡单独归入“UNION ARENA 通用卡”。首页的每张系列卡会直接打开对应作品的卡表。

牌组功能位于 `http://localhost:3000/decks`。可新建、编辑、搜索和删除牌组，编辑器支持筛选卡牌、统计能量曲线、保存与导出 PNG。牌组、收集记录与置顶系列保存在 `.wrangler` 下的本机 SQLite 数据库中。

设置页面位于 `http://localhost:3000/settings`。可查看牌组、收藏与置顶数量，导出或恢复 JSON 备份，也可以手动或自动增量更新官方卡表。ntfy 通知支持自定义 HTTPS 服务器、Topic 与可选访问令牌，并在卡牌更新成功或失败时通知。

## 更新官方卡牌数据

默认重新同步 UA54BT：

```bash
npm run sync:cards
```

自动识别并同步官方全部系列产品（支持断点续跑，已存在的完整产品会直接复用）：

```bash
npm run sync:all
```

检查官网全部分类，并只重新抓取新增或已变更的分类：

```bash
npm run sync:update
```

也可以指定官方卡表中的产品编号，或用逗号同步多个产品：

```bash
npm run sync:cards -- --series=570154
npm run sync:cards -- --series=570044,570144,570154
```

直接运行同步命令时，资料会写入被 Git 忽略的 `data/cards`，图片会缓存到
`public/cards/<分类编号>`。Docker 首次启动则会把同样的内容写入持久化
卷中的 `/data/card-data` 与 `/data/card-assets`。混合宣传卡与限定商品
卡池会自动按作品代码拆分。公开部署前请自行确认官方卡图与文本的转载
授权范围。

如果要让同一局域网内的其他设备访问开发版：

```bash
npm run dev -- --hostname 0.0.0.0
```

## Docker

Docker 镜像只包含应用程序，不包含卡牌资料或卡图。第一次启动时如果
持久化卷里没有完整卡表，容器会自动从 UNION ARENA 官方卡表下载全部
资料与图片；同步中断后重启容器会继续补齐。首次同步期间可查看进度：

```bash
docker compose up --build -d
docker compose logs -f uptcg
```

同步完成后访问 `http://localhost:3002`。默认使用 Docker 命名卷
`uptcg-data`，其中同时保存：

- `/data/uptcg.sqlite`：牌组、收藏数量和置顶系列。
- `/data/card-data`：官方卡牌 JSON 资料。
- `/data/card-assets`：官方卡图。
- `/data/card-data/update-settings.json`：自动更新开关、下次检查与最近结果。
- `/data/card-data/ntfy-settings.json`：ntfy 通知配置与访问令牌（不会写入镜像或个人资料备份）。

重建或升级容器会继续使用同一个卷。不要执行 `docker compose down -v`，
否则会删除这些资料。普通停止服务：

```bash
docker compose down
```

在这台 Mac 上手动运行时，可以使用宿主机目录，方便直接备份 SQLite 与卡表：

```bash
UPTCG_DATA_DIR="$HOME/Library/Application Support/UPTCG/data" \
UPTCG_UID="$(id -u)" \
UPTCG_GID="$(id -g)" \
docker compose up --build -d
```

首次自动抓取只会在卡牌存储完全不存在、未完成或损坏时运行；正常重启不会
重复下载全量资料。设置页开启自动更新后，可以选择每 6 小时、12 小时、每天、
每 2 天或每周，并指定日本时间的执行时刻；若 Mac 或 Docker 当时未运行，会在
服务下次启动后补查。公开分发或长期运行前请
自行确认官方卡图与文本的使用授权。

## GitHub Actions 与 TrueNAS 部署

生产环境使用 GitHub 托管 runner 构建 `linux/amd64`、`linux/arm64` 两种
架构的镜像，发布为 `ghcr.io/jibril2333/uptcg-app:latest`。TrueNAS 通过
`compose.nas.yaml` 运行镜像，并由现有的 label-enabled Watchtower 自动更新；
NAS 上不安装 self-hosted runner，也不会执行仓库中的代码。

镜像仍然只包含应用。SQLite、官方卡表、图片和通知设置全部保存在 NAS 的本地
ZFS dataset 中。空 dataset 首次启动会自动同步完整官方资料。

完整的首次安装、个人资料转移、健康检查、Cloudflare 切换和回滚顺序请参阅
[将 UPTCG 从 Mac 迁移到 TrueNAS](docs/nas-migration.md)。

仓库不保存卡牌 JSON、卡图或卡图归档。普通克隆和 Docker 镜像都只包含
应用代码；首次启动会从官方卡表建立持久化卡牌资料，源码目录中的手动同步
缓存也会被 Git 忽略。

## Linear → Codex 开发

通过 Linear Issue 委派 Codex Cloud、运行 PR 检查并由人工审核合并的配置，
请参阅 [Linear → Codex → Pull Request](docs/linear-codex-setup.md)。
