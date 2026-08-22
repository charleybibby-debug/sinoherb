# PayPal Checkout 配置与验收

SinoHerb 使用 PayPal JS SDK 和服务端 Orders API v2。浏览器只接收 Client ID；Client Secret、OAuth access token 和 Webhook ID 只能保存在服务器环境变量中。

## 1. 准备 Sandbox 账户

1. 登录 PayPal Developer Dashboard。
2. 在 Sandbox Accounts 中准备一个 **Sandbox Business** 商家账户和一个 **Sandbox Personal** 买家账户。
3. 在 Apps & Credentials 的 Sandbox 环境创建应用。
4. 复制 Sandbox Client ID、Client Secret，并保存到服务器 `.env`；不要写入 Git、浏览器代码、截图或支持消息。

```dotenv
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
PAYPAL_TIMEOUT_MS=15000
```

`.env.example` 只保留空值示例，不保存真实凭证。更新环境变量后重新启动 API。

## 2. 配置 Sandbox Webhook

在 Sandbox 应用中新增 Webhook，地址必须是公网可访问的 HTTPS 端点：

```text
https://your-domain.example/api/v1/webhooks/paypal
```

订阅以下事件：

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

保存后，将 PayPal 显示的 Webhook ID 写入 `PAYPAL_WEBHOOK_ID`。Webhook URL 必须使用有效 HTTPS 证书，反向代理需要原样转发 PayPal 验签头和请求正文。

## 3. Sandbox 验收清单

使用 Sandbox Personal 账户完成以下测试：

1. 正常批准付款，确认页面显示订单号、USD 金额和脱敏交易参考号。
2. 在 PayPal 弹窗取消，确认配送信息和购物车仍保留。
3. 重复提交 Capture，确认同一订单不会重复扣库存或重复标记付款。
4. 重放同一个 Webhook 事件，确认第二次被识别为重复事件。
5. 模拟 Create/Capture 超时或失败，确认页面可重试并仍可选择人工联系。
6. 在 PayPal 后台退款，确认 `PAYMENT.CAPTURE.REFUNDED` 到达后，后台订单显示“已退款”。
7. 验证超过 24 小时的待支付或失败预留订单只释放一次库存。

退款首版不在 SinoHerb 后台发起。运营人员统一在 **PayPal 后台退款**，本地系统只通过 Webhook 同步退款状态。

## 4. 切换 Live

只有 Sandbox 全部通过后才创建 Live 应用和 Live Webhook。Live 与 Sandbox 的 Client ID、Client Secret、Webhook ID 互不通用。

生产服务器配置：

```dotenv
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=your-live-client-id
PAYPAL_CLIENT_SECRET=your-live-client-secret
PAYPAL_WEBHOOK_ID=your-live-webhook-id
PAYPAL_TIMEOUT_MS=15000
```

部署必须全站使用 HTTPS。上线后执行一笔**最小金额真实交易**，核对 PayPal 后台、SinoHerb 订单金额和库存，再从 PayPal Dashboard 完成一次真实退款并确认 Webhook 同步。

## 5. 故障排查

- PayPal 区域显示未启用：检查 Client ID 与 Client Secret 是否同时配置，并确认服务已重启。
- SDK 加载失败：检查浏览器网络、内容安全策略和 `www.paypal.com` 可访问性；人工联系订单仍应可用。
- Webhook 返回 400：核对环境、Webhook ID、订阅地址和验签头是否由代理完整转发。
- Capture 返回 409：不要手工修改本地金额；核对 PayPal invoice ID、USD 金额和订单号。
- 请求超时：检查服务器到 PayPal API 的网络和 `PAYPAL_TIMEOUT_MS`，不要在日志中输出授权头、access token 或付款人完整资料。
