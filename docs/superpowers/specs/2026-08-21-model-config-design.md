# 模型配置后台入口设计

## 目标

让管理员可以在后台随时替换大模型的服务地址、模型名和 API Key。数据库配置优先于 `.env`，保存后立即作用于后续体质对话请求。

## 数据与安全

- 新增 `model_configs` 单例表，保存 provider、base URL、model、加密后的 API Key 和更新时间。
- API Key 使用 `CONFIG_ENCRYPTION_KEY` 配置的 AES-256-GCM 密钥加密，数据库不保存明文。
- 管理员查询只返回 `hasApiKey` 与掩码，不返回可恢复的密文或明文。
- `.env` 中的 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` 作为数据库配置不存在时的启动兜底。

## 运行时行为

- 应用启动时确保 `model_configs` 表存在，并加载数据库中的有效配置。
- LLM provider 每次请求读取运行时配置；管理员保存后无需重启容器即可生效。
- 未配置 API Key 时继续使用本地体质规则，不影响前台基础功能。

## 后台交互

- “模型状态”页增加服务地址、模型名、API Key 输入框和保存按钮。
- API Key 输入框默认留空；留空表示保留当前 Key，输入新值才替换。
- 保存后显示成功/失败反馈，并刷新当前连接状态和更新时间。

## API

- `GET /api/v1/admin/model-health` 返回 provider、base URL、model、Key 掩码、是否已配置和更新时间。
- `PATCH /api/v1/admin/model-config` 接收 baseUrl、model、apiKey，校验 URL 为 HTTP(S)，并保留未提供的字段。

## 边界

- 仅管理员可读写模型配置。
- 不在日志、错误响应或前端 DOM 中输出 API Key。
- 生产环境缺少 `CONFIG_ENCRYPTION_KEY` 时拒绝保存数据库配置，并提示配置服务器密钥。
