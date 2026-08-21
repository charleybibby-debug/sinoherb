# 注册用户体系设计

## 目标

支持用户使用手机号或邮箱加密码注册、登录和退出；后台提供只读用户列表，便于运营查看账号状态与注册时间。

## 数据

- `customer_users` 保存邮箱、手机号、昵称、Argon2id 密码哈希、状态、最近登录时间和时间戳。
- `customer_sessions` 保存 HttpOnly 会话 Token 哈希和过期时间，不保存明文 Token。
- `orders.user_id` 可选关联注册用户，游客下单仍然可用。

## API

- `POST /api/v1/auth/register`：邮箱或手机号至少填写一个，密码至少 12 位。
- `POST /api/v1/auth/login`：使用邮箱或手机号作为 identifier 登录。
- `GET /api/v1/auth/session`：返回当前用户的非敏感资料。
- `POST /api/v1/auth/logout`：清理用户会话 Cookie。
- `GET /api/v1/admin/users`：管理员读取用户列表，不返回密码哈希或会话信息。

## 前台体验

- 所有主导航增加“账户”入口，进入独立账户页。
- 账户页在登录和注册之间切换；登录后显示账号资料与退出按钮。
- 订单结算不强制注册，已登录用户提交订单时自动关联账号。

## 安全边界

- 密码只经过 Argon2id 哈希，永不进入响应、日志或前端 DOM。
- 用户会话使用 HttpOnly、SameSite Cookie；生产环境启用 Secure。
- 邮箱统一小写，手机号保留数字与首个 `+`，重复账号返回明确错误。
