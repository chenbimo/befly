# auth Hook - 身份认证

> 解析/校验 JWT Token，并将用户信息写入 `ctx.user`。

## 作用

- 从请求头中解析鉴权信息（常见为 `Authorization` 或 `token`）
- 校验 token 合法性与过期
- 将 token payload 写入 `ctx.user`，供后续 `permission` / 业务 handler 使用

## 何时生效

- API 请求进入 hook pipeline 时执行
- 如果某个 API 路由显式声明 `auth: false`，则该接口跳过登录态要求（但 hook 仍可能解析 token，以便后续使用）

## 配置

JWT 的核心配置来自 `beflyConfig.auth`：

```json
{
    "auth": {
        "secret": "your-jwt-secret-change-in-production",
        "expiresIn": "7d",
        "algorithm": "HS256"
    }
}
```

## 行为要点

- token 无效/过期时：通常不会在这里直接判权限，而是由后续 `permission` 按接口是否需要登录来决定是否拦截
- hook 写入：`ctx.user`（后续统一依赖这个字段）

## 常见问题

- Q: 为什么我 `auth:false` 的接口也能拿到 `ctx.user`？
    - A: 接口不要求登录 ≠ 不解析 token；只要你带了 token，框架仍可解析出来给你用。
