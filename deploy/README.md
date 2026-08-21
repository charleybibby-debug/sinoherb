# SinoHerb 阿里云部署

1. 在 Ubuntu 24.04 ECS 安全组开放 TCP 22 和 80，确认 5432、3000 未开放。
2. 上传项目，复制 .env.example 为 .env，填写随机数据库密码、至少 32 位 SESSION_SECRET、百炼 API Key，并用 `openssl rand -hex 32` 生成 CONFIG_ENCRYPTION_KEY。该密钥用于后台加密保存可替换的模型 API Key，务必长期保留。
3. 执行 bash deploy/install-ubuntu-24.sh，重新登录让 Docker 用户组生效。
4. 执行 docker compose up -d --build。API 启动时会自动执行媒体表、模型配置表和注册用户表幂等迁移，不需要删除现有 PostgreSQL 卷。
5. 检查 docker compose ps 和 curl http://127.0.0.1/api/health。
6. 首次管理员执行 docker compose run --rm api node server/scripts/create-admin.js admin '请替换为至少12位密码' 创建，不要把明文密码写进仓库或 shell 历史。
7. 备份位于 deploy/backups，保留最近 14 天。图片保存在 Docker 的 `sinoherb-media` 持久化卷，正式运营后建议同步到阿里云 OSS。

用户注册后可从前台“账户”入口登录；管理员在 `/admin/` 的“注册用户”页面查看用户列表。升级已有部署时需要重新构建 API 镜像，让新的认证路由和迁移进入容器：`docker compose up -d --build api nginx`。

域名准备好后，将 Nginx 的 server_name _ 改为域名，开放 443，使用证书服务配置 HTTPS，并为 Cookie 启用 Secure。

恢复示例：pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" deploy/backups/sinoherb-YYYYMMDDTHHMMSSZ.dump
