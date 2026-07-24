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

## 更新官方卡牌数据

默认重新同步 UA54BT：

```bash
npm run sync:cards
```

自动识别并同步官方全部系列产品（支持断点续跑，已存在的完整产品会直接复用）：

```bash
npm run sync:all
```

也可以指定官方卡表中的产品编号，或用逗号同步多个产品：

```bash
npm run sync:cards -- --series=570154
npm run sync:cards -- --series=570044,570144,570154
```

同步内容会写入 `data/cards`，供页面按需读取的资料与图片会缓存在 `public/cards/<分类编号>`。混合宣传卡与限定商品卡池会自动按作品代码拆分。公开部署前请自行确认官方卡图与文本的转载授权范围。

如果要让同一局域网内的其他设备访问开发版：

```bash
npm run dev -- --hostname 0.0.0.0
```

## Docker

这台 Mac 上的生产容器使用端口 `3002`，并直接挂载原有 SQLite
目录，保留牌组、收藏与置顶数据。手动构建并启动：

```bash
UPTCG_DATA_DIR="$HOME/Library/Application Support/UPTCG/data" \
UPTCG_UID="$(id -u)" \
UPTCG_GID="$(id -g)" \
docker compose up --build -d
```

然后访问 `http://localhost:3002`。停止服务：

```bash
docker compose down
```

也可以直接构建镜像：

```bash
docker build -t uptcg-local .
docker run --rm -p 3002:3000 \
  --user "$(id -u):$(id -g)" \
  -v "$HOME/Library/Application Support/UPTCG/data:/data" \
  uptcg-local
```

容器把 SQLite 数据库保存在 `/data/uptcg.sqlite`。请始终为 `/data`
挂载持久目录，否则删除容器时会同时丢失牌组与收藏记录。

## GitHub Actions 自动部署到这台 Mac

仓库使用这台 Mac 上的 self-hosted runner：

```text
名称：uptcg-mac-mini
标签：self-hosted / macOS / ARM64 / uptcg
目录：~/actions-runner-uptcg
```

每次推送 `main` 后，`.github/workflows/deploy.yml` 会自动：

1. 在本机 runner 工作区检出代码与 Git LFS 卡图。
2. 执行 `docker compose build` 构建 `uptcg-app:prod`。
3. 停用原先直接运行 Node 的 `com.rayne.uptcg-local` LaunchAgent。
4. 备份现有 SQLite 数据库并用新镜像重建容器。
5. 检查 `http://127.0.0.1:3002/`，成功后清理悬空镜像。

workflow 只接受 `push` 到 `main` 或手动触发，绝不能增加
`pull_request` 触发器，否则不受信任的 PR 代码可能在这台 Mac 上执行。
连续推送会排队部署，不会同时操作同一个容器。

日常更新只需要：

```bash
git push origin main
gh run watch
```

不再依赖 GHCR、SSH 或远程服务器。runner 作为用户级 LaunchAgent
常驻并主动向 GitHub 拉取任务；Cloudflare Tunnel 继续访问本机的
`3002` 端口。Docker Desktop 必须处于运行状态。

卡图按分类打包在 `card-assets`，并使用 Git LFS 管理。Docker 构建时
会从归档直接生成最终卡图层，不会把归档或重复卡图留在中间镜像里。
普通克隆后如需在工作区还原卡图，运行：

```bash
git lfs pull
npm run assets:unpack
```

更新本地卡图后，可用 `npm run assets:pack -- ua44bt` 重新打包指定分类，
或用 `npm run assets:pack` 重新打包全部分类。
