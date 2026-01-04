# Redis 使用指南

## 概述

Befly 框架使用 Redis 作为缓存层，提供高性能的数据缓存、会话管理和分布式 ID 生成等功能。Redis 插件基于 Bun 内置的 `RedisClient` 实现，封装了常用操作并自动利用 Bun 的 pipeline 特性优化批量操作。

## 快速开始

### 配置

在 `befly.*.json` 配置文件中配置 Redis：

```json
{
    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "password": "",
        "db": 0,
        "prefix": "befly"
    }
}
```

### 访问 Redis

通过 `befly.redis` 访问 Redis 助手实例：

```typescript
// 在 API handler 中
export default {
    name: "示例接口",
    handler: async (befly, ctx) => {
        // 设置缓存
        await befly.redis.setObject("user:1", { name: "张三", age: 25 });

        // 获取缓存
        const user = await befly.redis.getObject("user:1");

        return befly.tool.Yes("成功", user);
    }
};
```

---

## 核心方法

### 字符串操作

#### setString - 设置字符串

```typescript
// 基本设置
await befly.redis.setString("key", "value");

// 带过期时间（秒）
await befly.redis.setString("key", "value", 3600); // 1小时后过期
```

#### getString - 获取字符串

```typescript
const value = await befly.redis.getString("key");
// 返回: 'value' 或 null（不存在时）
```

### 对象操作

#### setObject - 设置对象

自动序列化为 JSON 存储。

```typescript
// 基本设置
await befly.redis.setObject("user:1", {
    id: 1,
    name: "张三",
    roles: ["admin", "user"]
});

// 带过期时间（秒）
await befly.redis.setObject("session:abc123", { userId: 1 }, 7200); // 2小时
```

#### getObject - 获取对象

自动反序列化 JSON。

```typescript
const user = await befly.redis.getObject<UserInfo>("user:1");
// 返回: { id: 1, name: '张三', roles: ['admin', 'user'] } 或 null
```

#### delObject - 删除对象

```typescript
await befly.redis.delObject("user:1");
```

### 键操作

#### exists - 检查键是否存在

```typescript
const exists = await befly.redis.exists("user:1");
// 返回: true 或 false
```

#### del - 删除键

```typescript
const count = await befly.redis.del("user:1");
// 返回: 删除的键数量（0 或 1）
```

#### expire - 设置过期时间

```typescript
await befly.redis.expire("user:1", 3600); // 1小时后过期
```

#### ttl - 获取剩余过期时间

```typescript
const seconds = await befly.redis.ttl("user:1");
// 返回: 剩余秒数，-1 表示永不过期，-2 表示键不存在
```

### Set 集合操作

适用于存储不重复的元素集合，如权限列表、标签等。

#### sadd - 添加成员

```typescript
// 添加单个成员
await befly.redis.sadd("tags:article:1", ["技术"]);

// 添加多个成员
await befly.redis.sadd("user:1:roles", ["admin", "editor", "viewer"]);
```

#### sismember - 检查成员是否存在

```typescript
const isMember = await befly.redis.sismember("user:1:roles", "admin");
// 返回: true 或 false
```

#### smembers - 获取所有成员

```typescript
const roles = await befly.redis.smembers("user:1:roles");
// 返回: ['admin', 'editor', 'viewer']
```

#### scard - 获取成员数量

```typescript
const count = await befly.redis.scard("user:1:roles");
// 返回: 3
```

---

## 批量操作

批量操作利用 Bun Redis 的自动 pipeline 特性，显著提升性能。

### setBatch - 批量设置对象

```typescript
const count = await befly.redis.setBatch([
    { key: "user:1", value: { name: "张三" }, ttl: 3600 },
    { key: "user:2", value: { name: "李四" }, ttl: 3600 },
    { key: "user:3", value: { name: "王五" } } // 无 TTL，永不过期
]);
// 返回: 成功设置的数量
```

### getBatch - 批量获取对象

```typescript
const users = await befly.redis.getBatch<UserInfo>(["user:1", "user:2", "user:3"]);
// 返回: [{ name: '张三' }, { name: '李四' }, null]（不存在的返回 null）
```

### delBatch - 批量删除键

```typescript
const count = await befly.redis.delBatch(["user:1", "user:2", "user:3"]);
// 返回: 成功删除的数量
```

### existsBatch - 批量检查存在

```typescript
const results = await befly.redis.existsBatch(["user:1", "user:2", "user:3"]);
// 返回: [true, true, false]
```

### ttlBatch - 批量获取过期时间

```typescript
const ttls = await befly.redis.ttlBatch(["user:1", "user:2", "user:3"]);
// 返回: [3600, 7200, -1]
```

### expireBatch - 批量设置过期时间

```typescript
const count = await befly.redis.expireBatch([
    { key: "user:1", seconds: 3600 },
    { key: "user:2", seconds: 7200 }
]);
// 返回: 成功设置的数量
```

### saddBatch - 批量添加 Set 成员

```typescript
const CACHE_KEYS = {
    roleApis(roleCode: string) {
        return `role:apis:${roleCode}`;
    }
};

const count = await befly.redis.saddBatch([
    { key: CACHE_KEYS.roleApis("admin"), members: ["/api/app/user"] },
    { key: CACHE_KEYS.roleApis("editor"), members: ["/api/app/article"] }
]);
// 返回: 成功添加的总成员数量
```

### sismemberBatch - 批量检查 Set 成员

```typescript
const CACHE_KEYS = {
    roleApis(roleCode: string) {
        return `role:apis:${roleCode}`;
    }
};

const results = await befly.redis.sismemberBatch([
    { key: CACHE_KEYS.roleApis("admin"), member: "/api/app/user" },
    { key: CACHE_KEYS.roleApis("admin"), member: "/api/app/user/delete" }
]);
// 返回: [true, false]
```

---

## 唯一 ID 生成

### genTimeID - 生成基于时间的唯一 ID

生成 16 位纯数字 ID，格式：`毫秒时间戳(13位) + 后缀(3位)`。

利用 Redis `INCR` 原子操作保证分布式环境下的唯一性。

```typescript
const id = await befly.redis.genTimeID();
// 返回: 1733395200000123（示例）
```

**使用场景：**

```typescript
// 在 DbHelper.insData 中自动调用
const id = await befly.db.insData({
    table: "article",
    data: {
        title: "文章标题",
        content: "文章内容"
    }
});
// id 由 genTimeID 自动生成
```

**特点：**

- 16 位纯数字，可直接存储为 BIGINT
- 毫秒级时间戳 + 3 位后缀（100-999）
- 每毫秒支持 900 个并发 ID
- 分布式环境安全（基于 Redis INCR）

---

## 缓存键管理

### CacheKeys - 统一键名管理

避免硬编码，统一管理所有缓存键。

```typescript
const CACHE_KEYS = {
    apisAll() {
        return "apis:all";
    },
    menusAll() {
        return "menus:all";
    },
    roleInfo(roleCode: string) {
        return `role:info:${roleCode}`;
    },
    roleApis(roleCode: string) {
        return `role:apis:${roleCode}`;
    },
    tableColumns(tableName: string) {
        return `table:columns:${tableName}`;
    }
};

// 获取键名
const apisAllKey = CACHE_KEYS.apisAll(); // 'apis:all'
const menusAllKey = CACHE_KEYS.menusAll(); // 'menus:all'
const adminRoleInfoKey = CACHE_KEYS.roleInfo("admin"); // 'role:info:admin'
const adminRoleApisKey = CACHE_KEYS.roleApis("admin"); // 'role:apis:admin'
const userTableColumnsKey = CACHE_KEYS.tableColumns("user"); // 'table:columns:user'
```

### 键名前缀

Redis 插件支持配置全局前缀，避免键名冲突：

```json
{
    "redis": {
        "prefix": "myapp"
    }
}
```

所有键会自动添加前缀，最终写入 Redis 的 key 形如：`myapp:<key>`。

- 例如：你调用 `befly.redis.getString("user:1")`，实际访问的是 `myapp:user:1`
- 例如：你调用 `befly.redis.sismember("role:apis:admin", "/api/app/user")`，实际访问的是 `myapp:role:apis:admin`

> 注意：`redis.prefix` **不允许包含** `:`，因为 RedisHelper 会自动拼接分隔符 `:`。

---

## 实际应用场景

### 场景1：表结构缓存

DbHelper 自动缓存表字段信息，避免重复查询数据库。

```typescript
// 计数 + 过期：常用于限流/风控
// 更推荐：直接使用 Befly Core 内置的 rateLimit hook（通过 configs 配置即可）

const limit = 100; // 60 秒内最多 100 次
const windowSeconds = 60;

const key = `ratelimit:${ctx.ip}:${ctx.route}`;
const count = await befly.redis.incrWithExpire(key, windowSeconds);

if (count > limit) {
    return befly.tool.No("请求过于频繁");
}
```

### 场景2：接口权限缓存

使用 Set 集合存储角色的接口权限，实现 O(1) 时间复杂度的权限检查。

```typescript
// 极简方案：每个角色一个 Set
const roleApisKey = "role:apis:admin";
const hasPermission = await befly.redis.sismember(roleApisKey, "/api/app/user/add");
// 返回: true
```

### 场景3：会话管理

```typescript
// 登录时创建会话
const sessionId = crypto.randomUUID();
await befly.redis.setObject(
    `session:${sessionId}`,
    {
        userId: user.id,
        username: user.username,
        roleCode: user.roleCode,
        loginTime: Date.now()
    },
    7200
); // 2小时过期

// 验证会话
const session = await befly.redis.getObject(`session:${sessionId}`);
if (!session) {
    return befly.tool.No("会话已过期");
}

// 登出时删除会话
await befly.redis.delObject(`session:${sessionId}`);
```

### 场景4：Token 黑名单

```typescript
// 用户登出时，将 token 加入黑名单
const token = ctx.req.headers.get("Authorization")?.replace("Bearer ", "");
if (token) {
    const key = `token:blacklist:${token}`;
    await befly.redis.setString(key, "1", 7 * 24 * 60 * 60); // 7天
}

// 验证时检查黑名单
const isBlacklisted = await befly.redis.exists(`token:blacklist:${token}`);
if (isBlacklisted) {
    return befly.tool.No("Token 已失效");
}
```

### 场景5：接口限流

```typescript
// 简单的滑动窗口限流
const key = `ratelimit:${ctx.ip}:${ctx.route}`;
const current = await befly.redis.getString(key);
const count = current ? parseInt(current) : 0;

if (count >= 100) {
    // 每分钟最多 100 次
    return befly.tool.No("请求过于频繁");
}

if (count === 0) {
    await befly.redis.setString(key, "1", 60); // 60秒窗口
} else {
    await befly.redis.setString(key, String(count + 1), await befly.redis.ttl(key));
}
```

### 场景6：分布式锁

```typescript
// 获取锁
const lockKey = `lock:order:${orderId}`;
const acquired = await befly.redis.setString(lockKey, "1", 30); // 30秒自动释放

if (!acquired) {
    return befly.tool.No("操作正在进行中，请稍后");
}

try {
    // 执行业务逻辑
    await processOrder(orderId);
} finally {
    // 释放锁
    await befly.redis.del(lockKey);
}
```

### 场景7：数据缓存

```typescript
// 获取热门文章（带缓存）
const cacheKey = "articles:hot:10";
let articles = await befly.redis.getObject(cacheKey);

if (!articles) {
    // 缓存未命中，查询数据库
    const result = await befly.db.getAll({
        table: "article",
        fields: ["id", "title", "viewCount"],
        orderBy: ["viewCount#DESC"]
    });

    articles = result.lists; // 获取数据列表（最多 10000 条）

    // 写入缓存，5分钟过期
    await befly.redis.setObject(cacheKey, articles, 300);
}

return befly.tool.Yes("成功", articles);
```

---

## CacheHelper 缓存助手

框架内置的缓存助手，管理接口、菜单和角色权限的缓存。

### 服务启动时自动缓存

```typescript
// 框架启动时自动调用
await befly.cache.cacheAll();

// 等同于依次执行：
await befly.cache.cacheApis(); // 缓存接口列表
await befly.cache.cacheMenus(); // 缓存菜单列表
await befly.cache.cacheRolePermissions(); // 缓存角色权限
```

### 获取缓存数据

```typescript
// 获取所有接口
const apis = await befly.cache.getApis();

// 获取所有菜单
const menus = await befly.cache.getMenus();

// 获取角色权限
const permissions = await befly.cache.getRolePermissions("admin");
// 返回: ['/api/app/user/list', '/api/app/user/add', ...]
```

### 权限检查

```typescript
// 检查角色是否有指定接口权限
const hasPermission = await befly.cache.checkRolePermission("admin", "/api/app/user/add");
// 返回: true 或 false
```

### 更新缓存

角色权限变更后，需要刷新缓存：

```typescript
// 删除指定角色的权限缓存
await befly.cache.deleteRolePermissions("admin");

// 重新缓存所有角色权限（全量重建）
await befly.cache.rebuildRoleApiPermissions();

// 或：只刷新某个角色（覆盖更新）
await befly.cache.refreshRoleApiPermissions("admin", ["/api/app/user/list", "/api/app/user/add"]);
```

---

## 性能优化

### 1. 利用 Bun 自动 Pipeline

Bun Redis 客户端自动将多个并发请求合并为 pipeline，无需手动处理。

```typescript
// 这些请求会自动合并为一个 pipeline
const [user1, user2, user3] = await Promise.all([befly.redis.getObject("user:1"), befly.redis.getObject("user:2"), befly.redis.getObject("user:3")]);
```

### 2. 使用批量方法

对于明确的批量操作，使用专用的批量方法：

```typescript
// ✅ 推荐：使用批量方法
const users = await befly.redis.getBatch(["user:1", "user:2", "user:3"]);

// ❌ 不推荐：循环调用
const users = [];
for (const id of [1, 2, 3]) {
    users.push(await befly.redis.getObject(`user:${id}`));
}
```

### 3. 合理设置 TTL

```typescript
// 高频访问、变化少的数据 - 较长 TTL
await befly.redis.setObject("config:system", config, 86400); // 24小时

// 实时性要求高的数据 - 较短 TTL
await befly.redis.setObject("stats:online", count, 60); // 1分钟

// 永久缓存（慎用）
await befly.redis.setObject("constants:provinces", provinces); // 无 TTL
```

### 4. 避免大 Key

```typescript
// ❌ 避免：存储大量数据在单个 key
await befly.redis.setObject("all:users", hugeUserList); // 可能有 10MB+

// ✅ 推荐：分散存储
for (const user of users) {
    await befly.redis.setObject(`user:${user.id}`, user);
}
```

---

## 连接测试

```typescript
// 测试 Redis 连接
const pong = await befly.redis.ping();
// 返回: 'PONG'
```

---

## 错误处理

所有 Redis 方法都内置了错误处理，不会抛出异常：

```typescript
// 操作失败时返回默认值，不会中断程序
const value = await befly.redis.getObject("key"); // 返回 null
const exists = await befly.redis.exists("key"); // 返回 false
const count = await befly.redis.del("key"); // 返回 0

// 错误会记录到日志
// Logger.error('Redis getObject 错误', error);
```

如需捕获错误，可以检查返回值：

```typescript
const result = await befly.redis.setObject("key", data);
if (result === null) {
    Logger.warn("缓存写入失败");
    // 降级处理...
}
```

---

## 方法速查表

| 方法             | 说明              | 返回值             |
| ---------------- | ----------------- | ------------------ |
| `setString`      | 设置字符串        | `'OK'` / `null`    |
| `getString`      | 获取字符串        | `string` / `null`  |
| `setObject`      | 设置对象（JSON）  | `'OK'` / `null`    |
| `getObject`      | 获取对象（JSON）  | `T` / `null`       |
| `delObject`      | 删除对象          | `void`             |
| `exists`         | 检查键是否存在    | `boolean`          |
| `del`            | 删除键            | `number`           |
| `expire`         | 设置过期时间      | `number`           |
| `ttl`            | 获取剩余过期时间  | `number`           |
| `sadd`           | 添加 Set 成员     | `number`           |
| `sismember`      | 检查 Set 成员     | `boolean`          |
| `smembers`       | 获取所有 Set 成员 | `string[]`         |
| `scard`          | 获取 Set 成员数量 | `number`           |
| `genTimeID`      | 生成唯一 ID       | `number`           |
| `ping`           | 测试连接          | `'PONG'`           |
| `setBatch`       | 批量设置对象      | `number`           |
| `getBatch`       | 批量获取对象      | `Array<T \| null>` |
| `delBatch`       | 批量删除键        | `number`           |
| `existsBatch`    | 批量检查存在      | `boolean[]`        |
| `ttlBatch`       | 批量获取 TTL      | `number[]`         |
| `expireBatch`    | 批量设置过期时间  | `number`           |
| `saddBatch`      | 批量添加 Set 成员 | `number`           |
| `sismemberBatch` | 批量检查 Set 成员 | `boolean[]`        |
