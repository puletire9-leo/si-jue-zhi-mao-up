Docker 线上部署
1. 上线步骤
推送代码并等待镜像构建
git push 到 main
打开 https://github.com/JYTSW/sijue/actions 查看最新 CI，等待你这次提交对应的构建完成，即镜像已构建并推送

在线上服务器拉取镜像并重启服务
docker pull crpi-646e65hvjad58bp2.cn-guangzhou.personal.cr.aliyuncs.com/sijue/web-front:main
docker pull crpi-646e65hvjad58bp2.cn-guangzhou.personal.cr.aliyuncs.com/sijue/web-backend:main
docker pull crpi-646e65hvjad58bp2.cn-guangzhou.personal.cr.aliyuncs.com/sijue/keyword-research-go:main
cd /root/woeau_web
docker compose --env-file compose.env -f docker-compose.yml up -d --force-recreate

2. 配置
配置位置：/root/woeau_web/compose.env（仅服务器本地；模板用仓库根目录 compose.env.example）
Midway / Go：业务项只改 compose.env（env_file 注入）；docker-compose.yml 的 environment 仅 NODE_ENV、TZ，Go 另加 DATABASE_PATH、固定 APP_PORT=8099
注意：compose.env 里 APP_PORT=8001 只给 Midway 宿主机端口映射；Go API 监听 8099 在 yml 写死，不要再用第二个 APP_PORT
说明：cool-admin-vue/build/cool/eps/config.ts 只做 EPS 代码生成时的字段类型映射，不放 API 密钥；密钥类一律走 compose → 容器环境变量 → Midway config

3. 宿主机资源（未进 Docker）
图片上传目录：挂载到 /web/amz-listing-optimiser/cool-admin-midway/public/uploads
MySQL、Redis：沿用宿主机上原有实例，通过 host.docker.internal 连接