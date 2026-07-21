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

默认访问地址为 `http://localhost:3000`。

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

本地构建并启动：

```bash
docker compose up --build -d
```

然后访问 `http://localhost:3000`。停止服务：

```bash
docker compose down
```

也可以直接构建镜像：

```bash
docker build -t uptcg-local .
docker run --rm -p 3000:3000 -v uptcg-database:/data uptcg-local
```

容器把 SQLite 数据库保存在 `/data/uptcg.sqlite`。请始终为 `/data` 挂载持久卷，否则删除容器时会同时丢失牌组与收藏记录。

## GitHub Actions 与 GHCR

推送到 `main` 或推送 `v*` 标签后，`.github/workflows/docker.yml` 会自动构建 `linux/amd64` 与 `linux/arm64` 镜像，并发布到：

```text
ghcr.io/jibril2333/uptcg-app:latest
```

卡图按分类打包在 `card-assets`，并使用 Git LFS 管理；GitHub Actions 会在构建前自动取回并解包完整卡图。普通克隆后如需在本地还原卡图，运行：

```bash
git lfs pull
npm run assets:unpack
```

更新本地卡图后，可用 `npm run assets:pack -- ua44bt` 重新打包指定分类，或用 `npm run assets:pack` 重新打包全部分类。

在 Docker 主机上部署已发布镜像：

```bash
export UPTCG_IMAGE=ghcr.io/jibril2333/uptcg-app:latest
docker compose pull
docker compose up -d
```

镜像默认是私有的。首次拉取私有 GHCR 镜像前，需要先使用具有 `read:packages` 权限的 GitHub Token 执行 `docker login ghcr.io`。
