# Redis 操作（ctx.redis）

本页描述对外可用的 RedisHelper 方法（`befly/types/redis`）与常用用法。

## 前置：配置与 prefix

Redis 连接来自 `config.redis`（见 `config.md`）。

-   `redis.prefix` 会作为 key 前缀
-   **不要在 prefix 中写 `:`**（框架会自动拼接）

实现约定（来自 `RedisHelper`）：

-   真实 key：`<prefix>:` + `key`
-   当 `redis.prefix` 为空时不加前缀

> `checkConfig` 会强制校验：`redis.prefix` 不允许包含 `:`。

## 错误处理约定（非常重要）

`RedisHelper` 的大多数方法 **默认不抛异常**：失败时会记录日志并返回兜底值（`null/false/0/[]`）。

例外（会抛异常）：

-   构造函数：如果 Redis 未连接（未完成 `Connect.connectRedis()`）会直接抛错
-   `ping()`：连接探测失败会抛错（用于 fail-fast）
-   `genTimeID()`：未做 try/catch 包裹，底层 Redis 异常会直接抛出（用于保证“生成 ID”这条关键链路不要悄悄失败）

因此：

-   业务读取缓存时要把 `null/false/0/[]` 当成“缓存 miss/失败兜底”，而不是一定存在
-   在需要强保证 Redis 可用性的路径（例如启动检查）用 `ping()`

## 慢操作日志

当单次 Redis 操作耗时 > 500ms，会输出 warn 日志（`subsystem=redis`，`event=slow`），包含 cmd/key/duration。

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

## 失败返回值速查表

下表描述的是“发生异常（catch）时的兜底返回值”。正常情况下 Redis 自身也可能返回特殊值（例如 `ttl=-1/-2`），见各方法说明。

| 方法                           | 失败时返回                                                  |
| ------------------------------ | ----------------------------------------------------------- |
| `setString` / `setObject`      | `null`                                                      |
| `getString` / `getObject`      | `null`                                                      |
| `delObject`                    | 不抛（void）                                                |
| `exists`                       | `false`                                                     |
| `incr` / `incrWithExpire`      | `0`                                                         |
| `expire`                       | `0`                                                         |
| `ttl`                          | `-1`（注意：`-1` 也可能表示“无过期时间”，需要结合业务判断） |
| `ttlBatch`                     | `[]`（批量内部失败时会返回 `keys.map(() => -1)`）           |
| `sadd` / `saddBatch` / `scard` | `0`                                                         |
| `sismember`                    | `false`                                                     |
| `smembers`                     | `[]`                                                        |
| `sismemberBatch`               | `[]`（批量内部失败时会返回 `items.map(() => false)`）       |
| `del` / `delBatch`             | `0`                                                         |
| `setBatch`                     | `0`                                                         |
| `getBatch`                     | `[]`（批量内部失败时会返回 `keys.map(() => null)`）         |
| `existsBatch`                  | `[]`（批量内部失败时会返回 `keys.map(() => false)`）        |
| `expireBatch`                  | `0`                                                         |
| `ping`                         | **抛异常**                                                  |
| `genTimeID`                    | **可能抛异常**                                              |

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

如果你希望“失败时仍然能看见错误原因”，应查看日志（`Redis xxx 错误`）。
