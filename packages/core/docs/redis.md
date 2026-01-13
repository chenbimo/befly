# Redis 操作（ctx.redis）

本页描述对外可用的 RedisHelper 方法（`befly/types/redis`）与常用用法。

## 前置：配置与 prefix

Redis 连接来自 `config.redis`（见 `config.md`）。

-   `redis.prefix` 会作为 key 前缀
-   **不要在 prefix 中写 `:`**（框架会自动拼接）

## 常用方法速查

### string

-   `setString(key, value, ttl?)`
-   `getString(key)`

### object（自动 JSON 序列化）

-   `setObject(key, obj, ttl?)`
-   `getObject(key)`
-   `delObject(key)`

### 基础 key 操作

-   `exists(key)`
-   `del(key)` / `delBatch(keys)`
-   `expire(key, seconds)` / `expireBatch(...)`
-   `ttl(key)` / `ttlBatch(keys)`

### 计数

-   `incr(key)`
-   `incrWithExpire(key, seconds)`

### set

-   `sadd(key, members)`
-   `sismember(key, member)`
-   `scard(key)`
-   `smembers(key)`
-   批量：`saddBatch` / `sismemberBatch`

### 批量

-   `setBatch(items)` / `getBatch(keys)` / `existsBatch(keys)`

### 其他

-   `ping()`
-   `genTimeID()`（用于生成趋势递增 id，常用于 DB 同步/批量写入）

## 推荐用法

### 1) 缓存对象

```ts
// 写入 60 秒
await ctx.redis.setObject("user:profile:123", { id: 123, nickname: "Tom" }, 60);

// 读取
const profile = await ctx.redis.getObject<{ id: number; nickname: string }>("user:profile:123");
```

### 2) 计数 + 自动过期

```ts
// 例如：一分钟内计数
const next = await ctx.redis.incrWithExpire("rate:ip:1.2.3.4", 60);
```

## 注意事项

-   统一用 `ctx.redis`，不要绕过 prefix 自己拼 key
-   避免 `console.*`，日志用 `ctx.logger.*`
