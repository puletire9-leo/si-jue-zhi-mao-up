# 日常更新 Docker

> 本文件只讲**已经在跑的生产栈**怎么改代码、换镜像。  
> 空机、清过镜像、第一次把整套栈拉起来，走 [部署流程.md](部署流程.md) 的「首次部署」，不要把那一节当成每天的操作。  
> 命令仍以 [部署流程.md](部署流程.md) 为准；本文件禁止再发明一套 `compose build` 全量命令。

## 和首次部署的差别

| | 首次部署 | 日常更新 |
|---|---|---|
| 什么时候用 | Docker 里没有这套生产栈，或镜像/容器被清光 | 服务已经在跑，只改了某一层代码 |
| 构建范围 | 按首次部署把缺的组件一次补齐 | **只构建改过的那一个组件** |
| 禁止 | — | 为了“干净”把 java/frontend/backend/ai-center 全量 `compose build` |
| 入口 | `部署流程.md` 首次部署 | 本文件 + `deploy_prod.ps1 -Component ...` |

日常更新不要复制首次部署的全量 `docker compose build`。MySQL、Redis、Nacos 数据卷本次不碰。

## 线下只跑一条组件命令

在仓库根目录执行，改了哪一层就选哪一条，不要四条连跑：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component frontend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component backend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component ai-center
```

| 本次改了什么 | `-Component` | 仓库 | 会重建的容器 |
|---|---|---|---|
| Java（gateway / user / product 共用镜像） | `java` | `prod-java` | `gateway`、`java-user`、`java-product` |
| Vue 或 `frontend/nginx.conf` | `frontend` | `prod-frontend` | `frontend` |
| Python API / Celery | `backend` | `prod-backend` | `backend`、`celery-download` |
| AI Center | `ai-center` | `prod-ai-center` | `ai-center` |

脚本内部已经带：预检、**构建前清掉更旧的回退版**、把现在的 `current` 收成唯一 `previous`、该组件缓存构建一次、`--no-deps --no-build` 重建受影响容器、健康检查、Java 编译缓存只留最新一条、回收超过 3 小时未用的普通 BuildKit 层。不要手工再拆一遍这些步骤。

## 构建前必须清旧构件

每个业务仓库（`prod-java` / `prod-frontend` / `prod-backend` / `prod-ai-center`）在一次日常更新里遵守：

1. **构建前**：删掉该仓库里比「上一版」更老的镜像。旧的 `previous` 本体和多余标签（如 `latest`）都去掉。
2. **构建前**：把当时的 `current` 标成新的 `previous`。这是**唯一**允许留下的回退件。
3. **构建中**：打进新的 `current`，替换正在用的成品。
4. **验证成功后**：该仓库只准留下 `current` + `previous` 两个标签。其它旧标签、无引用的旧本体全部删掉。

对应关系：

```text
构建前：current(N)  [以及可能残留的更旧 previous / latest]
轮换后：previous = N（唯一回退），再构建 current(N+1)
成功后：current = N+1，previous = N
再下一次：丢掉 N，previous 变成 N+1，current 变成 N+2
```

首次该仓库还没有 `current` 时，成功后可以只有 `current`，没有 `previous`。从第二次日常更新开始，常态就是一份在跑、一份回退。

不要为了腾空间把 `previous` 也删掉。也不要堆第三份、第四份成品镜像。Maven/pip/npm 的 cache mount 不是成品镜像，按 [Docker存储优化.md](Docker存储优化.md) 保留，禁止 `docker system prune --volumes`。

## 验证失败时

不要继续手工 `build`。用仍在的 `previous` 按 [部署流程.md](部署流程.md) 回滚节处理，修好后再重新跑**同一条** `-Component` 命令。

## 线上

日常同样只更新改过的组件：本机 `deploy_prod.ps1` 出 `current` 后，只 tag/push 那一个仓库，改对方机器 `.env` 里对应 `*_IMAGE`，再 `docker compose up -d`。不要四个镜像每次全推。细节仍看 [部署流程.md](部署流程.md) 线上节。
