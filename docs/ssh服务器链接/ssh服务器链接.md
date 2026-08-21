# SSH 服务器链接记录

> 2026-08-20 首次打通记录。当天后半段做了三件事：SSH 底账、选品镜像推阿里云、给对方写远程 compose。
> 2026-08-21 状态更新：远程服务器已运行首版 Docker，正式入口为 `https://selection.suezon.com/ai-selection`。
> 域名已解析到 `8.148.188.93`，外层 Nginx 和 SSL 证书均已配置完成。
> 中转站先本机自己用，不跟选品混。
> Docker 地图：[docker使用经验/README.md](../docker使用经验/README.md)
> 生产发布：[部署流程.md](../docker使用经验/部署流程.md)
> 远程部署包：仓库 `deploy-remote/`，线上目录 `/root/woeau_web/ai-selection-deploy`

## 一、当天状态

| 项 | 状态 |
|---|---|
| 本机 SSH 密钥 | 完成，`id_ed25519`，不要再 `ssh-keygen` |
| 服务器 `8.148.188.93` | 端口通，只认公钥 |
| 免密登录 | 已完成。2026-08-21 新建无 passphrase 的 `id_ed25519`，公钥已写入 root 的 `authorized_keys` |
| 阿里云镜像仓库登录 | 完成。账号是 `pengdongwg@163.com`，不是 `pendongwg` |
| 选品 4 个业务镜像 push | 完成，仓库 `suezon/selection` |
| 给对方的 compose / 挂载包 | 完成，`deploy-remote/` |
| 远程 Docker 首版 | 完成，线上已运行 `v1.0` 镜像 |
| 域名 / HTTPS | 完成，`selection.suezon.com`，SSL 证书已配置 |
| 本机选品生产 | 10 个容器在跑，入口 5173 |
| 本机中转站 | 自己试用，`http://127.0.0.1:8317` |

---

## 二、SSH 是什么

SSH 是加密远程登录。在这台 Windows 上 `ssh 用户名@服务器IP`，命令跑在服务器上。

| 东西 | 干什么 |
|---|---|
| SSH | 你怎么进服务器去维护 |
| `id_ed25519` 私钥 | 钥匙，只留本机 |
| 下面那行公钥 | 锁孔，贴到服务器 / GitHub |
| 选品 API / 中转站 `sk-` | 调业务或模型，和 SSH 无关 |

---

## 三、本机最终密钥（2026-08-21 重建）

路径：`C:\Users\Admin\.ssh\`

| 文件 | 作用 |
|---|---|
| `id_ed25519` | 私钥。不要复制、不要提交、不要外发 |
| `id_ed25519.pub` | 公钥 |
| `known_hosts` | 已加入 `8.148.188.93` 的 ED25519 指纹 |

最终公钥整行（不要换行、不要加引号）：

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINzvaNCIYD/aSNc8yuC/ZYaJfUQdRtxYaesjWH+X2Rhk admin@PS2023LQFKHINO
```

指纹：`SHA256:IwVFvKpZA7eWjirq1O9C3vuGYnuYfdu7RXx18uClODw`。该私钥未设置 passphrase，命令行和 MobaXterm 连接时均无需输入密钥密码。

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

---

## 四、服务器 `8.148.188.93`

| 项 | 值 |
|---|---|
| SSH 端口 | 22 |
| 认证 | 只接受公钥，密码登录已关 |
| 登录用户名 | `root` |
| 登录状态 | 已打通，2026-08-21 实测成功 |
| 服务器主机指纹 | `SHA256:Un1lGUNW7m44JhbaCNA3Gwzi9YjAag14x8gYsi/8ckg`（ED25519） |

```powershell
ssh -i C:\Users\Admin\.ssh\id_ed25519 root@8.148.188.93
```

也可直接执行：

```powershell
ssh root@8.148.188.93
```

首次或重新授权时，在阿里云网页终端以 root 执行：

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
printf '%s\n' 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINzvaNCIYD/aSNc8yuC/ZYaJfUQdRtxYaesjWH+X2Rhk admin@PS2023LQFKHINO' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
chown -R root:root /root/.ssh
```

### Windows SSH 工具（2026-08-21）

本机统一优先使用已安装的 MobaXterm Home Edition 26.4 连接和维护服务器：

```text
C:\Program Files (x86)\Mobatek\MobaXterm\MobaXterm.exe
```

连接参数：

| 项 | 值 |
|---|---|
| Remote host | `8.148.188.93` |
| Username | `root` |
| Port | `22` |
| Private key | `C:\Users\Admin\.ssh\id_ed25519` |
| Public key | `C:\Users\Admin\.ssh\id_ed25519.pub` |
| 公钥指纹 | `SHA256:IwVFvKpZA7eWjirq1O9C3vuGYnuYfdu7RXx18uClODw` |
| Passphrase | 未设置；连接时无需输入密钥密码 |

2026-08-21 已清理本机旧密钥并重新生成无 passphrase 的 `id_ed25519`，对应公钥已上传到服务器 root 的 `/root/.ssh/authorized_keys`。实测 `ssh root@8.148.188.93` 登录成功；后续命令行和 MobaXterm 都使用这组最终密钥。私钥文件不得复制、上传或提交 Git。

后续涉及服务器、线上 Docker、日志或远程部署操作时，先提醒使用该 MobaXterm SSH 连接。便携版 `E:\软件\MobaXterm_Portable_v26.4` 已于 2026-08-21 移入 Windows 回收站，避免与系统安装版混用。

---

## 五、阿里云容器镜像仓库（上海）

```text
仓库：registry.cn-shanghai.aliyuncs.com
命名空间 / 仓库：suezon / selection
用户名：pengdongwg@163.com
密码：suezon-123
```

**坑：** 第一次写成 `pendongwg@163.com`，少一个 `g`，一直 `unauthorized`。控制台显示 `pengd*****@163.com`。

```bash
docker login --username=pengdongwg@163.com registry.cn-shanghai.aliyuncs.com
```

选品不是一个镜像。2026-08-20 已 push 四个 tag：

| 本机镜像 | 仓库 tag | 对方用来起 |
|---|---|---|
| prod-frontend:current | `.../suezon/selection:frontend-v1.0` | prod-frontend（内置 Nginx） |
| prod-java:current | `.../suezon/selection:java-v1.0` | gateway + java-user + java-product |
| prod-backend:current | `.../suezon/selection:backend-v1.0` | backend + celery |
| prod-ai-center:current | `.../suezon/selection:ai-center-v1.0` | ai-center |

MySQL / Redis / Nacos 用官方镜像，不推仓库。

以后更新（线上）固定流程：

1. 本机按权威部署流程构建受影响组件，并把修改后的镜像以新 tag 推到阿里云镜像仓库。
2. 登录服务器，修改 `/root/woeau_web/ai-selection-deploy/.env` 中对应的 `FRONTEND_IMAGE` / `JAVA_IMAGE` / `BACKEND_IMAGE` / `AI_CENTER_IMAGE`。改的是镜像地址/tag，不是固定的 `prod-*` 容器名。
3. 在 `/root/woeau_web/ai-selection-deploy` 执行 `docker compose up -d`，Compose 会拉取新镜像并重建、重启受影响容器。

Web 容器保持 `prod-frontend`。域名和 SSL 已在服务器外层 Nginx 配好，普通业务镜像更新不需要重复配置证书。

---

## 六、给对方的远程部署包 `deploy-remote/`

整目录拷到服务器 `/root/woeau_web/ai-selection-deploy`。

```text
deploy-remote/
  docker-compose.yml          只拉镜像，不构建
  .env                        四个业务镜像 tag
  nginx.host.conf             外层 Nginx，反代 127.0.0.1:5173
  config/public/prod.env      库名、Redis、COS、CORS；RDS_* = 领星库
  config/public/user-prod.env USER_MYSQL_* = 登录库 ai_platform
  config/secrets/prod.env     JWT / 本地 MySQL / RDS_PASSWORD / COS / 领星 / 飞书（不进 git）
  config/secrets/user-prod.env USER_MYSQL_PASSWORD（不进 git）
  data/                       全部挂宿主机：mysql redis nacos logs models download-cache
```

对方启动：

```bash
cd /root/woeau_web/ai-selection-deploy
mkdir -p data/mysql data/redis data/nacos-logs data/nacos-data data/logs data/models data/download-cache
docker login --username=pengdongwg@163.com registry.cn-shanghai.aliyuncs.com
docker compose pull
docker compose up -d
```

MySQL：库 `sijuelishi`，用户 `sijue`，密码在 `config/secrets/prod.env`。  
3310 / 6383 / 8014 / 9003 只绑 `127.0.0.1`。  
外层 Nginx 用 `nginx.host.conf`，反代到前端容器 80（宿主 5173）。业务 API 不要直接打到 Java/Python。

有域名后改 `config/public/prod.env` 的 `CORS_ORIGINS`，然后 recreate backend / java / gateway，并 `docker restart prod-frontend`。

---

## 七、本机思觉智贸生产（2026-08-20 实测）

入口：`http://localhost:5173`  
账号：admin / `123456`  
项目名必须是 `si-jue-zhi-mao-up`，禁止 `-p sijuelishi-prod`，禁止 `down -v`。

| 容器 | 镜像 | 宿主端口 |
|---|---|---|
| prod-frontend | prod-frontend:current | 5173 |
| prod-gateway | prod-java:current | 9003 |
| prod-java-user | prod-java:current | 8014 |
| prod-java-product | prod-java:current | 127.0.0.1:8025 |
| prod-backend | prod-backend:current | 127.0.0.1:7093 |
| prod-celery-download | prod-backend:current | 无 |
| prod-ai-center | prod-ai-center:current | 无 |
| prod-mysql | mysql:8.0 | 3310 |
| prod-redis | redis:7-alpine | 6383 |
| prod-nacos | nacos v2.3.1 | 8852 / 9852 |

---

## 八、本机中转站（先自己试用）

和选品无关。不要打成 `suezon/selection`。

| 项 | 值 |
|---|---|
| 目录 | `E:\项目\自建中转站` |
| 启动 | `docker compose -p cliproxy -f docker-compose.local.yml up -d` |
| 地址 | `http://127.0.0.1:8317` |
| 健康检查 | `http://127.0.0.1:8317/healthz` |
| 管理后台 | `http://127.0.0.1:8317/management.html` |
| API Key | `sk-20827c4cb2c231d90dabd290b7263164` |
| 管理密码 | `mgmt-893385fd3d42286d40919afe58f46496` |
| 配置 | `config.yaml`（宿主绑 127.0.0.1；Docker 下 allow-remote 必须 true，否则管理后台 403） |
| 账号文件 | `auths/`（容器内 `~/.cli-proxy-api`） |

2026-08-20 实测：容器 Up，`/healthz` 返回 `ok`。`/v1/models` 仍是空列表，因为还没登录 Claude / Codex / Gemini / Kimi / Grok。

自己试用：

1. 打开管理后台，填管理密码。
2. 登录你有的订阅（Claude / Codex / Antigravity / Kimi / Grok）。国内访问不了官方站时，在 `config.yaml` 设 `proxy-url`。
3. Claude Code：

```powershell
$env:ANTHROPIC_BASE_URL="http://127.0.0.1:8317"
$env:ANTHROPIC_AUTH_TOKEN="sk-20827c4cb2c231d90dabd290b7263164"
```

Codex / Cursor：Base URL `http://127.0.0.1:8317/v1`，Key 用上面那把 `sk-`。

---

## 九、安全

- 公钥可以贴；私钥不能离开这台电脑
- 仓库账号是 `pengdongwg@163.com`，密码不要进公开 git
- 选品真密钥在 `config/secrets/prod.env` 和 `deploy-remote/config/secrets/`，不进 git
- 服务器安全组只放行 22 和 80/443
- 中转站先只绑 `127.0.0.1`，不要把 8317 打到公网
