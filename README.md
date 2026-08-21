# SinoHerb

SinoHerb 是一个面向海外用户的中医体质生活方式产品网站。

## 本地开发

复制 .env.example 为 .env，执行 npm install、npm test 和 npm run dev。

## 阿里云部署

参阅 deploy/README.md。首期访问地址为 http://8.216.50.149，数据库和 API 只在 Docker 内部网络访问。

## 重要环境变量

- DATABASE_URL：PostgreSQL 连接串。
- SESSION_SECRET：至少 32 位随机字符串。
- LLM_API_KEY：阿里云百炼 API Key，仅放服务器 .env。
- LLM_MODEL：默认 qwen-plus。
- CONFIG_ENCRYPTION_KEY：后台保存模型 API Key 时使用的 64 位十六进制加密密钥，仅放服务器 .env。
- CHAT_RETENTION_DAYS：聊天记录保留 7 天。
- CUSTOMER_SESSION_RETENTION_DAYS：注册用户登录会话保留天数，默认 30 天。
- BACKUP_RETENTION_DAYS：数据库备份保留 14 天。
- MEDIA_UPLOAD_DIR：后台图片上传目录，默认 `/app/uploads`。
- MEDIA_MAX_BYTES：单张图片大小上限，默认 5 MB。
- MEDIA_BACKUP_LIMIT：每个图片位保留的历史版本数量，默认 10 个。

后台地址为 `/admin/`。管理员可以在“产品与库存”中按状态筛选并执行上架/下架，在“注册用户”中查看邮箱/手机号、注册时间和最近登录，也可以在“全站图片”中按页面替换图片、更新替代文本或恢复上一版。图片上传卷由 Docker 持久化，API 与 Nginx 共享该卷。

前台账户入口为 `/account.html`。用户可以使用手机号或邮箱加密码注册、登录和退出；注册用户表与会话表会在 API 启动时自动幂等创建，密码只保存 Argon2 哈希。
