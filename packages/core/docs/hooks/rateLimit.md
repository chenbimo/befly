# rateLimit Hook - 全局限流

> 按路由与身份维度进行限流（默认启用）。

## 默认行为

- **默认启用**：`rateLimit.enable = 1`
- 无规则时：使用兜底配置（默认阈值由框架默认配置提供）
- `OPTIONS` 请求：不计数也不拦截

## 配置

```json
{
    "rateLimit": {
        "enable": 1,
        "rules": [
            {
                "route": "/api/auth/*",
                "limit": 10,
                "window": 60,
                "key": "ip"
            }
        ],
        "skipRoutes": ["/api/health"]
    }
}
```

### route 匹配

- 支持精确、前缀、通配（更具体的规则优先）

### key 维度

- `ip`：按 IP 限流
- `user`：按用户限流；当缺失 `ctx.user.id` 时会回退为按 IP 计数
- `ip_user`：IP + 用户组合

### skipRoutes

命中后直接跳过限流：**不计数也不拦截**。

## 存储

- 优先使用 Redis（分布式一致）
- 无 Redis 时降级为进程内计数
