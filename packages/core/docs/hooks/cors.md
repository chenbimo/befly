# cors Hook - 跨域处理

> 统一设置 CORS 响应头，并处理 `OPTIONS` 预检请求。

## 作用

- 根据配置生成并写入 `ctx.corsHeaders`
- 对 `OPTIONS` 预检请求直接返回 204，避免进入后续 hook / handler

## 配置

```json
{
    "cors": {
        "origin": "*",
        "methods": "GET, POST, PUT, DELETE, OPTIONS",
        "allowedHeaders": "Content-Type, Authorization, authorization, token",
        "exposedHeaders": "Content-Range, X-Content-Range, Authorization, authorization, token",
        "maxAge": 86400,
        "credentials": "true"
    }
}
```

## 行为要点

- `OPTIONS`：不计入业务逻辑，不进入后续处理链
- 正常请求：仅设置 CORS 相关头，不改变业务响应体
