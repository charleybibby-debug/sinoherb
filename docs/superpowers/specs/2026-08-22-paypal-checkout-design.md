# SinoHerb PayPal 结账设计规格

## 1. 目标

在现有 SinoHerb 结账页接入 PayPal 在线支付，同时保留“提交人工联系订单”流程。

首版目标：

- 使用 PayPal JS SDK 标准按钮和服务端 Orders API。
- 支持 PayPal Sandbox，并可仅通过环境变量切换至 Live。
- 仅以 USD 收款。
- 支持 PayPal 账户支付；符合条件时由 PayPal 提供银行卡访客支付。
- 服务端计算并校验金额，浏览器不决定实际收款金额。
- 使用 Capture 与 Webhook 双通道确认支付状态。
- 退款由运营人员在 PayPal 后台执行，本地通过 Webhook 同步状态。
- 提供 PayPal Developer 应用、Sandbox 测试和生产配置说明。

首版不包含 CAD、多币种换算、Pay Later 定制、后台退款按钮、部分退款、争议处理和订阅支付。

本规格用在线支付能力更新原云端后端设计中“首期不包含在线支付”的限制，其他订单和部署原则继续适用。

## 2. 已确认决策

- 集成方式：PayPal JS SDK + SinoHerb 服务端 Orders API。
- 环境：Sandbox 完整测试，并支持 Live 配置切换。
- 币种：USD。
- 支付方式：PayPal 在线支付与人工联系订单同时保留。
- PayPal 入口：使用标准按钮，由 PayPal 根据资格决定是否提供银行卡访客支付。
- 退款：运营人员在 PayPal 后台操作。
- 页面布局：上下并列付款区，PayPal 为推荐主路径，人工联系为次级路径。
- 成功结果：支付成功后进入独立订单成功页。
- 当前没有 PayPal Developer 凭证，交付必须包含申请和配置指南。

## 3. 用户体验

结账页保留现有左右结构：左侧配送信息，右侧购物车与 USD 小计。配送表单下方增加“完成订单”区域。

付款区从上到下为：

1. PayPal 在线支付卡片，标记为推荐方式，显示 USD 金额、PayPal 标准按钮和安全支付说明。
2. “或”分隔线。
3. 人工联系订单卡片，说明暂不在线付款，工作人员稍后确认付款与配送。

配送信息未通过校验前，PayPal 按钮不可用并提示用户先完善信息。PayPal SDK 使用 `onInit` 与表单状态控制按钮启用；`onClick` 再执行一次校验。

用户取消 PayPal 时留在结账页，购物车和配送信息保持不变。支付处理中禁用两种提交入口，避免重复创建订单。

支付成功后前往独立成功页，展示：

- SinoHerb 订单号。
- “已付款”状态。
- USD 支付金额。
- PayPal 交易参考号的脱敏版本。
- 后续配送与人工联系说明。

成功页通过随机确认 token 获取有限订单信息，不根据查询参数直接暴露订单详情。

## 4. 订单与支付状态

现有 `orders.status` 继续表示订单业务进度，并新增 `pending_payment`：

- `pending_payment`：本地订单已创建，等待 PayPal Capture。
- `pending_contact`：付款已完成或用户选择人工联系，等待运营跟进。
- `contacted`、`confirmed`、`completed`、`cancelled`：沿用现有含义。

允许的关键状态变化：

- PayPal：`pending_payment -> pending_contact -> contacted -> confirmed -> completed`。
- 支付取消或超时：`pending_payment -> cancelled`。
- 人工联系：直接创建为 `pending_contact`。

新增独立支付状态 `payment_status`：

- `pending`：PayPal Order 已创建，尚未成功 Capture。
- `paid`：Capture 已完成。
- `failed`：创建或 Capture 明确失败。
- `unpaid`：人工联系订单，尚未在线付款。
- `refunded`：PayPal 后台退款后由 Webhook 同步。

订单业务状态与支付状态不互相替代。退款不会自动把已发货订单改回早期业务状态，管理后台同时展示两者。

## 5. 数据模型

新增 migration，为 `orders` 增加：

- `payment_method TEXT NOT NULL DEFAULT 'manual'`，枚举为 `manual` 或 `paypal`。
- `payment_status TEXT NOT NULL DEFAULT 'unpaid'`。
- `currency_code TEXT NOT NULL DEFAULT 'USD'`。
- `paypal_order_id TEXT UNIQUE`。
- `paypal_capture_id TEXT UNIQUE`。
- `paid_at TIMESTAMPTZ`。
- `refunded_at TIMESTAMPTZ`。
- `stock_released_at TIMESTAMPTZ`，用于保证取消订单只释放一次库存。
- `confirmation_token_hash TEXT`，只保存成功页 token 哈希。

订单金额继续使用整数分。PayPal 请求使用由 `subtotal_cents` 转换出的两位 USD 字符串。

新增 `paypal_webhook_events`：

- `event_id TEXT PRIMARY KEY`，用于幂等去重。
- `event_type TEXT NOT NULL`。
- `resource_id TEXT`。
- `processing_status TEXT NOT NULL`。
- `error_code TEXT`。
- `created_at` 与 `processed_at`。

默认不长期保存完整 Webhook 原始载荷，避免不必要的客户与支付数据留存。需要排错时只记录 request ID、事件 ID、类型、资源 ID 和内部错误码。

## 6. PayPal 适配层

新增独立 PayPal client，负责：

- 获取并缓存 OAuth access token。
- 创建 PayPal Order。
- Capture PayPal Order。
- 查询 Order 或 Capture，用于 Webhook 补偿与对账。
- 调用 PayPal Webhook 签名验证接口。
- 将 PayPal HTTP 错误转换成稳定的内部错误码。

环境变量：

- `PAYPAL_ENV=sandbox|live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_TIMEOUT_MS`，默认 15000。

PayPal API 地址由 `PAYPAL_ENV` 派生，不允许浏览器传入。服务端日志不得记录 Client Secret、access token、完整 payer 数据或完整 Webhook body。

## 7. API

### `GET /api/v1/payments/paypal/config`

返回前端加载 JS SDK 所需的非敏感配置：

- `enabled`
- `clientId`
- `currency: "USD"`
- `environment`

未配置凭证时返回 `enabled: false`，结账页仍允许提交人工联系订单。

### `POST /api/v1/payments/paypal/orders`

请求只包含配送与客户信息，不接收金额或商品价格。

服务端：

1. 验证姓名、电话、地址、城市、国家和邮编。
2. 从 HttpOnly 购物车 Cookie 读取购物车。
3. 重新读取 active 产品并计算商品快照与 USD 小计。
4. 创建本地 `pending_payment` 订单和确认 token。
5. 使用本地订单号作为 PayPal `invoice_id`，创建 PayPal Order。
6. 保存 PayPal Order ID，并返回 `paypalOrderId`、本地订单号和一次性 `checkoutToken`。数据库只保存该 token 的哈希。

创建本地待支付订单时沿用现有事务扣减逻辑，将商品视为已预留。请求使用稳定的 `PayPal-Request-Id`，重复调用不得创建多笔有效 PayPal Order。PayPal 创建失败时，本地订单标记为 `failed/cancelled`，在同一补偿流程中恢复商品库存，购物车不清空。

### `POST /api/v1/payments/paypal/orders/:paypalOrderId/capture`

请求体必须携带 Create 阶段返回的 `checkoutToken`。服务端按 PayPal Order ID 找到本地订单，并用恒定时间比较验证 token 哈希；验证失败时拒绝 Capture。

Capture 成功后必须校验：

- PayPal 状态为 `COMPLETED`。
- Capture 币种为 USD。
- Capture 金额与本地 `subtotal_cents` 完全一致。
- PayPal `invoice_id` 与本地订单号一致。

校验通过后以数据库事务更新 Capture ID、`payment_status=paid`、`paid_at` 和 `status=pending_contact`，再清空购物车。已成功 Capture 的重复请求直接返回现有成功结果。

### `POST /api/v1/webhooks/paypal`

路由不需要用户登录，但必须使用 PayPal transmission headers、Webhook ID 和事件内容完成签名验证。验证失败返回 400，不更新订单。

首版处理：

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `CHECKOUT.ORDER.APPROVED`

`event_id` 唯一约束防止重复处理。无法关联订单的合法事件记录为忽略状态并返回 200，防止 PayPal 无效重试。待支付订单取消或超过 24 小时仍未付款时，库存只释放一次并写入 `stock_released_at`。

### `GET /api/v1/orders/:orderNumber/confirmation`

要求 Create 阶段返回的 `checkoutToken`，只返回成功页需要的订单号、业务状态、支付状态、USD 金额、脱敏交易参考号和创建时间。token 不写入日志或分析事件。

## 8. 人工联系订单兼容

现有 `POST /api/v1/orders` 保留，但补齐国家、城市和邮编字段校验，并明确写入：

- `status=pending_contact`
- `payment_method=manual`
- `payment_status=unpaid`
- `currency_code=USD`

人工订单创建成功后沿用当前清空购物车行为。前端文案不得暗示已付款。

## 9. 管理后台

订单列表增加支付方式和支付状态：

- PayPal / 人工联系。
- 待支付 / 已付款 / 未付款 / 失败 / 已退款。

订单详情显示脱敏 PayPal Order ID、Capture ID、付款时间和退款时间。首版不提供 Capture、退款或重试按钮，资金操作继续在 PayPal 后台完成。

`pending_payment` 订单默认单独标识，避免运营将未付款订单误认为需要发货。

## 10. 错误处理

前端错误分为：

- PayPal SDK 加载失败：提示暂时无法在线支付，并保留人工联系入口与重试按钮。
- 用户取消：显示非错误提示，保留表单和购物车。
- 创建 PayPal Order 失败：不清购物车，允许重试或改用人工联系。
- Capture 超时：提示正在确认支付，不立即宣告失败；查询本地确认接口或等待 Webhook 对账。
- Capture 明确失败：展示可重试信息，不创建第二笔已付款订单。
- 金额或币种不一致：标记支付异常，禁止进入已付款状态并记录内部告警。

支付接口返回稳定错误码、用户可理解的中文信息和 request ID。PayPal 原始错误详情不直接展示给用户。

## 11. 安全与合规

- Client Secret、access token 和 Webhook ID 只存在服务端环境变量。
- 浏览器只加载 PayPal 官方 JS SDK，不托管或处理银行卡字段。
- 生产环境必须使用 HTTPS；Live 模式下应用启动时校验 HTTPS 公网基址和完整凭证。
- 使用服务器购物车与数据库商品价格计算金额。
- Create、Capture 和 Webhook 都做幂等处理。
- Webhook 必须验证签名，不相信事件 body 自述来源。
- 不在 URL、日志、分析事件或前端错误中暴露支付 token。
- 支付写接口设置独立限流和请求体限制。

## 12. 配置与上线

交付文档包含：

1. 创建 PayPal Developer 账户。
2. 创建 Sandbox Business 与 Personal 测试账户。
3. 创建 Sandbox App 并取得 Client ID / Secret。
4. 配置 Webhook URL 与所需事件，记录 Webhook ID。
5. 在 `.env` 填写 Sandbox 配置并重启服务。
6. 完成批准、取消、失败、重复 Capture 和 Webhook 重放测试。
7. 创建 Live App 并配置生产 Webhook。
8. 在 HTTPS 生产环境切换 `PAYPAL_ENV=live` 和 Live 凭证。
9. 执行一笔最小金额真实交易，再从 PayPal 后台退款并验证本地状态同步。

`.env.example` 只列变量名与说明，不包含真实凭证。

## 13. 测试策略

单元测试：

- USD 整数分格式化。
- PayPal access token 缓存与过期。
- Create 与 Capture 请求映射。
- PayPal 错误映射。
- 支付与业务状态转换。

API 集成测试：

- 客户端伪造金额不影响 PayPal Order 金额。
- 空购物车、下架商品和无效配送信息被拒绝。
- Create 重试不会生成重复有效订单。
- Capture 成功后原子更新本地订单并清空购物车。
- Capture 金额、币种或 invoice ID 不一致时不标记已付款。
- 重复 Capture 返回相同成功结果。
- Webhook 签名无效不更新订单。
- Webhook 重放只处理一次。
- 人工联系订单保持兼容。

前端与 Sandbox 验证：

- PayPal SDK 正常、加载失败和禁用状态。
- 配送表单校验。
- PayPal 批准、取消与失败流程。
- 访客卡入口仅在 PayPal 判定可用时展示，不做强制断言。
- 成功页只显示有限订单信息。
- 桌面与移动端付款区布局。

## 14. 验收标准

- 未配置 PayPal 凭证时，人工联系订单仍可正常提交。
- Sandbox 配置完成后，用户可以从购物车以 USD 创建并 Capture 一笔 PayPal 付款。
- 支付金额只能来自服务端商品与购物车数据。
- 成功支付只产生一条已付款本地订单记录，并清空购物车。
- 用户取消或支付失败不会丢失购物车。
- Webhook 可以补偿浏览器未返回的 Capture 成功，并同步退款状态。
- 管理后台能区分未付款、已付款和已退款订单。
- 切换到 Live 不需要修改业务代码或重新构建前端。
