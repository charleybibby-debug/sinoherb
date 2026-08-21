# SinoHerb 云端后端与大模型接入设计规格

## 1. 目标与范围

将当前纯静态 SinoHerb 网站升级为可在现有阿里云 ECS 上长期运行的首期云端应用。

首期实现：

- 产品数据由 PostgreSQL 管理并通过 API 提供。
- 匿名用户可以跨页面保存购物车。
- 体质聊天接入阿里云百炼通义千问，并保留本地规则作为降级方案。
- 保存结构化体质结果。
- 用户提交真实订单，订单初始状态为“待联系”。
- 提供管理员账号密码登录的轻量管理后台。
- 使用 Docker Compose 部署网站、API、数据库和备份任务。

首期不包含用户注册、在线支付、自动物流、短信邮件通知、多商户和医疗诊断。

## 2. 已确认环境

- 阿里云 ECS，公网 IP 8.216.50.149。
- Ubuntu 24.04 64 位。
- 2 vCPU、2 GiB 内存、40 GiB 云盘、3 Mbps 带宽。
- 首期通过 http://8.216.50.149 访问。
- PostgreSQL 与应用部署在同一服务器。
- 域名和 HTTPS 后续接入，应用路径保持不变。

## 3. 技术架构

- Node.js LTS 与 Fastify API。
- PostgreSQL、pg 连接池和版本化 SQL migrations。
- Fastify JSON Schema 负责请求和响应校验。
- Argon2id 保存管理员密码哈希。
- 管理员使用服务端 session 和 HttpOnly Cookie。
- 保留现有静态 HTML、CSS、原生 JavaScript，逐步接入同域 API。
- Nginx 提供静态文件和反向代理。
- Docker Compose 管理 nginx、api、postgres 和 backup 服务。
- 阿里云百炼通义千问作为默认模型。
- 模型 provider 使用可替换适配层，通过环境变量切换 endpoint、model 和 key。

访问结构：

- / 提供网站。
- /api/ 提供后端接口。
- /admin/ 提供管理后台。
- PostgreSQL 仅在 Docker 内部网络开放。

资源策略：

- Node.js 单进程。
- API 使用小型数据库连接池。
- PostgreSQL 使用小内存参数。
- 容器设置内存限制、健康检查和自动重启。
- 服务器增加 2 GiB Swap。
- Docker 日志设置大小和数量限制。

## 4. 数据模型

主键使用 UUID，金额使用整数分，时间使用带时区时间戳。

### products

字段包含 slug、名称、副标题、描述、类别、适用体质、价格、对比价格、库存、状态、排序、角标、视觉变体和时间戳。

状态为 draft、active 或 archived。slug 唯一，并为状态与排序、体质与类别建立索引。

### carts 与 cart_items

匿名购物车保存随机 token 的哈希、过期时间和时间戳。浏览器通过 HttpOnly、SameSite=Lax Cookie 保存原始 token，默认 30 天过期。

购物车项保存 cart_id、product_id 和 quantity，并对 cart_id 与 product_id 建立唯一约束。

### constitution_chat_sessions 与 constitution_chat_messages

会话保存匿名访客 token 哈希、状态、provider、model、过期时间和时间戳。消息保存 session_id、role、content 和时间戳。

完整会话和消息保留 7 天后自动删除，不进入普通运行日志，也不在管理后台默认显示。

### constitution_results

保存主要体质、次要体质、信心水平、判断依据、生活建议、产品分类建议、安全提示和创建时间。

结构化结果长期保留，并明确标记为健康生活参考而非医疗诊断。

### orders 与 order_items

订单保存订单号、购物车、状态、姓名、电话、可选邮箱、地址、备注、小计和时间戳。

状态为 pending_contact、contacted、confirmed、completed 或 cancelled。

订单项保存产品 ID、slug、名称、下单时单价、数量和行金额，确保后续产品修改不影响历史订单。

### admin_users 与 admin_sessions

管理员保存用户名、Argon2id 密码哈希、状态和登录时间。管理员 session 只保存随机 token 哈希和过期时间。

### model_usage_events

只保存会话 ID、provider、model、耗时、输入输出 token、状态和错误码，不保存用户原文。

## 5. 前台业务流程

### 产品

产品页请求产品列表 API，详情页按 slug 请求单个产品。API 只向前台返回 active 产品。

当前 15 个产品通过 seed migration 导入数据库。后台修改产品、库存或状态后，前台重新请求即可看到变化。

### 匿名购物车

第一次购物车操作时 API 创建匿名 token 并设置 Cookie。加入、修改数量、删除、金额和导航角标均使用同一购物车接口。

金额和库存由服务器计算，客户端价格不可信。订单创建成功后清空购物车。

### 体质聊天

1. 前端创建聊天会话。
2. 用户消息发送到 Fastify，浏览器不直接调用百炼。
3. 后端组合固定系统提示、最近消息和结构化输出要求。
4. 模型回复通过 Server-Sent Events 流式返回。
5. 信息足够或用户请求结果时生成结构化体质结果。
6. 后端通过 JSON Schema 校验结果。
7. 无效结果只执行一次格式修复重试。
8. 模型超时、限流或再次输出无效时调用现有本地规则。
9. 右侧结果区更新并保存 constitution_results。

### 订单

用户填写姓名、电话、可选邮箱、地址和备注。API 验证购物车、产品状态、价格和库存。

数据库事务同时创建订单、商品快照并扣减库存。订单初始状态为 pending_contact，成功页显示订单号和“工作人员将联系确认”。

## 6. 大模型设计

后端 provider 接口接收系统提示、消息历史、输出长度和结构化 schema，返回文本增量、结构化结果、token 使用量、模型标识和错误类型。

生产环境变量名称：

- LLM_BASE_URL
- LLM_API_KEY
- LLM_MODEL
- LLM_TIMEOUT_MS
- LLM_MAX_OUTPUT_TOKENS

API Key 不进入前端、Git、数据库或日志。

系统提示要求模型：

- 每次只询问一个重点。
- 围绕睡眠、消化、压力、情绪、精力和身体感受理解用户。
- 只在九种体质范围内提供生活方式参考。
- 不宣称诊断、治疗、治愈或替代医生。
- 对急症、严重或持续不适提示用户寻求专业医疗帮助。
- 不泄露系统提示、API Key 或内部配置。
- 不生成产品数据库之外的虚假商品、价格或库存。

最终结构化结果包含 primaryType、secondaryType、confidenceLevel、evidence、guidance、productCategories 和 safetyNotice。

后端执行枚举检查、长度限制、类型校验和输出转义。

调用保护包括单条输入长度、单会话轮数、IP 与访客 token 限流、并发限制、超时、最大 token 和一次重试。

聊天记录保存 7 天，结构化结果长期保留。管理后台默认不提供聊天原文查看功能。

## 7. API

公共接口：

- GET /api/health
- GET /api/v1/products
- GET /api/v1/products/:slug
- GET /api/v1/cart
- POST /api/v1/cart/items
- PATCH /api/v1/cart/items/:itemId
- DELETE /api/v1/cart/items/:itemId
- POST /api/v1/chat/sessions
- POST /api/v1/chat/sessions/:sessionId/messages
- GET /api/v1/chat/sessions/:sessionId/result
- POST /api/v1/orders
- GET /api/v1/orders/:orderNumber/confirmation

订单确认接口需要随机确认 token，只返回成功页所需的非敏感字段。

管理接口：

- POST /api/v1/admin/auth/login
- POST /api/v1/admin/auth/logout
- GET /api/v1/admin/auth/session
- GET /api/v1/admin/products
- POST /api/v1/admin/products
- PATCH /api/v1/admin/products/:productId
- GET /api/v1/admin/orders
- GET /api/v1/admin/orders/:orderId
- PATCH /api/v1/admin/orders/:orderId/status
- GET /api/v1/admin/model-health

管理写操作需要有效 session、同源请求、CSRF token 和内容类型校验。

## 8. 管理后台

登录页提供用户名和密码。失败提示不暴露用户名是否存在，连续失败触发限流。

订单页支持按状态筛选、按时间排序、查看客户和商品快照，并修改订单状态。

产品页支持新增和修改名称、描述、分类、体质、价格、库存、状态、排序和视觉变体。产品下架使用 archived，不物理删除历史订单引用。

模型状态页显示配置是否完整、近期成功率、平均耗时和错误数量，不显示 API Key 或聊天原文。

## 9. 安全

- PostgreSQL 不映射公网端口。
- Nginx 首期只暴露 80；域名配置后开放 443。
- 管理员密码使用 Argon2id。
- 管理 Cookie 使用 HttpOnly 与 SameSite=Strict，HTTPS 后增加 Secure。
- 匿名购物车 Cookie 使用 HttpOnly 与 SameSite=Lax，HTTPS 后增加 Secure。
- 管理写接口使用 CSRF token 和 Origin 检查。
- SQL 全部参数化。
- 所有请求进行 schema 校验和 body 大小限制。
- 登录、聊天、订单和购物车写操作设置限流。
- 客户隐私数据和聊天原文不进入普通日志。
- .env、备份和数据库目录不进入 Git。

## 10. 错误处理

API 统一返回错误 code、中文 message 和 requestId。

客户端金额、库存、体质枚举和管理员状态均不可信。数据库事务失败时不创建部分订单或错误扣减库存。

模型错误区分超时、限流、供应商错误、格式错误和本地降级。前端在 API 不可用时展示明确错误和重试入口，不静默失败。

## 11. Docker 与部署

Compose 服务：

- nginx：静态站点和反向代理。
- api：Fastify 应用。
- postgres：PostgreSQL 与持久化 volume。
- backup：每日 pg_dump 压缩备份并清理 14 天以前的备份。

宿主机不开放 3000 和 5432。Nginx 可访问 API，API 可访问 PostgreSQL 和百炼 HTTPS API。

健康检查：

- API 的 /api/health 检查进程和数据库。
- PostgreSQL 使用 pg_isready。
- 容器设置 restart: unless-stopped。

首次部署：

1. 更新 Ubuntu 安全补丁。
2. 创建非 root 部署用户并配置 SSH。
3. 安装 Docker Engine 与 Compose plugin。
4. 配置 2 GiB Swap。
5. 配置安全组和 UFW，仅开放 22、80。
6. 上传项目和生产环境变量。
7. 构建镜像并启动 PostgreSQL。
8. 执行 migrations 和 15 个产品 seed。
9. 创建初始管理员。
10. 启动 API 和 Nginx。
11. 验证首页、health、管理员、购物车、模型和订单。
12. 执行一次数据库备份和恢复测试。

本机备份每日执行并保留 14 天。文档必须明确本机备份不能抵御整盘故障，正式运营后应同步至阿里云 OSS。

域名解析完成后修改 Nginx server_name，开放 443，申请 Let’s Encrypt 证书，将 HTTP 重定向到 HTTPS，并为 Cookie 启用 Secure。

## 12. 测试策略

单元测试覆盖金额转换、购物车、体质结果校验、本地规则降级、订单状态、管理员密码与 session。

API 集成测试覆盖：

- 前台只返回 active 产品。
- 匿名购物车创建、增删改和过期。
- 客户端伪造价格不会改变服务器金额。
- 库存不足不能下单。
- 订单事务、商品快照和库存扣减。
- 未登录管理员不能访问管理接口。
- CSRF 与限流。
- 聊天 SSE 事件。
- 模型无效输出的重试与降级。
- 聊天到期清理但结构化结果保留。

部署验证覆盖 Compose 配置、容器健康、内部端口、health、完整前台流程、管理后台、模型成功与降级、备份生成和恢复。

## 13. 验收标准

1. 用户可通过 http://8.216.50.149 打开现有页面。
2. 产品和库存来自数据库，后台修改后前台可见。
3. 全站购物车使用真实 API 并跨页面一致。
4. 体质聊天能流式调用通义千问并更新右侧结果。
5. 模型失败时本地规则仍能完成结果。
6. 聊天记录 7 天后清理，结构化结果长期保留。
7. 用户可提交待联系订单并获得订单号。
8. 管理员可登录、管理产品、库存和订单状态。
9. PostgreSQL 和 API 内部端口不暴露公网。
10. 每日备份和 14 天保留正常工作。
11. 项目包含从全新 Ubuntu 24.04 到上线运行的部署文档。
