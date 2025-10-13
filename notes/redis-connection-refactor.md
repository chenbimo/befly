# Redis 连接方式重构总结

## 重构日期

2025-10-11

## 重构目标

去掉 `REDIS_URL` 环境变量，改用 `REDIS_*` 独立环境变量手动构建 Redis 连接 URL，使用 Bun 原生的 `RedisClient` 类。

## 参考文档

-   Bun Redis 官方文档：https://github.com/oven-sh/bun/blob/main/docs/api/redis.md
-   Bun v1.3.0 Redis 客户端 API

## 修改原因

### 旧方案的问题

1. **不够灵活**：`REDIS_URL` 需要完整的连接字符串，修改单个参数需要重新构建整个 URL
2. **环境变量冗余**：同时定义了 `REDIS_URL` 和 `REDIS_*` 独立变量，造成配置混乱
3. **未使用 Bun 原生客户端**：使用的是 `bun.redis` 全局对象，无法配置连接选项

### 新方案的优势

1. **更灵活**：每个连接参数独立配置，易于管理和修改
2. **配置清晰**：只使用 `REDIS_*` 环境变量，消除冗余
3. **功能更强**：使用 `RedisClient` 类，支持连接超时、自动重连、管道化等高级特性
4. **符合 Bun 最佳实践**：使用官方推荐的 `RedisClient` 类

## 修改内容

### 1. 环境变量配置 (`core/config/env.ts`)

#### 修改前

```typescript
// ========== Redis 配置 ==========
/** Redis 连接 URL */
REDIS_URL: string;
/** 是否启用 Redis：0 | 1 */
REDIS_ENABLE: number;
/** Redis 主机 */
REDIS_HOST: string;
// ... 其他配置

// 初始化
REDIS_URL: getEnv('REDIS_URL', ''),
REDIS_ENABLE: getEnvNumber('REDIS_ENABLE', 1),
```

#### 修改后

```typescript
// ========== Redis 配置 ==========
/** 是否启用 Redis：0 | 1 */
REDIS_ENABLE: number;
/** Redis 主机 */
REDIS_HOST: string;
/** Redis 端口 */
REDIS_PORT: number;
/** Redis 用户名 */
REDIS_USERNAME: string;
/** Redis 密码 */
REDIS_PASSWORD: string;
/** Redis 数据库索引 */
REDIS_DB: number;
/** Redis 键前缀 */
REDIS_KEY_PREFIX: string;

// 初始化
REDIS_ENABLE: getEnvNumber('REDIS_ENABLE', 1),
REDIS_HOST: getEnv('REDIS_HOST', 'localhost'),
REDIS_PORT: getEnvNumber('REDIS_PORT', 6379),
REDIS_USERNAME: getEnv('REDIS_USERNAME', ''),
REDIS_PASSWORD: getEnv('REDIS_PASSWORD', ''),
REDIS_DB: getEnvNumber('REDIS_DB', 0),
REDIS_KEY_PREFIX: getEnv('REDIS_KEY_PREFIX', 'befly'),
```

### 2. Redis 助手工具 (`core/utils/redisHelper.ts`)

#### 修改前

```typescript
import { redis as bunRedis } from 'bun';

let redisClient: RedisClient = bunRedis;

export const setRedisClient = (client: RedisClient | null): void => {
    redisClient = client || bunRedis;
};

export const getRedisClient = (): RedisClient => redisClient;
```

#### 修改后

```typescript
import { RedisClient } from 'bun';

/**
 * 构建 Redis 连接 URL
 */
function buildRedisUrl(): string {
    const { REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_DB } = Env;

    // 构建认证部分
    let auth = '';
    if (REDIS_USERNAME && REDIS_PASSWORD) {
        auth = `${REDIS_USERNAME}:${REDIS_PASSWORD}@`;
    } else if (REDIS_PASSWORD) {
        auth = `:${REDIS_PASSWORD}@`;
    }

    // 构建完整 URL
    const url = `redis://${auth}${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`;
    return url;
}

let redisClient: RedisClient | null = null;

/**
 * 初始化 Redis 客户端
 */
export const initRedisClient = (): RedisClient => {
    if (!redisClient) {
        const url = buildRedisUrl();
        redisClient = new RedisClient(url, {
            connectionTimeout: 10000,
            idleTimeout: 30000,
            autoReconnect: true,
            maxRetries: 10,
            enableOfflineQueue: true,
            enableAutoPipelining: true
        });
    }
    return redisClient;
};

export const getRedisClient = (): RedisClient => {
    if (!redisClient) {
        return initRedisClient();
    }
    return redisClient;
};

export const closeRedisClient = (): void => {
    if (redisClient) {
        redisClient.close();
        redisClient = null;
    }
};
```

### 3. Redis 插件 (`core/plugins/redis.ts`)

#### 修改前

```typescript
import { redis } from 'bun';
import { RedisHelper, getRedisClient } from '../utils/redisHelper.js';

const client = getRedisClient();
const pingResult = await client.ping();

Logger.info('Redis 插件初始化成功');
```

#### 修改后

```typescript
import { RedisHelper, initRedisClient, getRedisClient } from '../utils/redisHelper.js';

// 初始化 Redis 客户端
const client = initRedisClient();

// 测试连接
const pingResult = await client.ping();

Logger.info('Redis 插件初始化成功', {
    host: Env.REDIS_HOST,
    port: Env.REDIS_PORT,
    db: Env.REDIS_DB
});
```

### 4. 类型定义 (`core/types/redis.d.ts`)

#### 修改前

```typescript
import { redis as bunRedis } from 'bun';

export type RedisClient = typeof bunRedis;
```

#### 修改后

```typescript
import { RedisClient as BunRedisClient } from 'bun';

export type RedisClient = BunRedisClient;
```

### 5. 环境变量文件 (`tpl/.env.development`)

#### 修改前

```bash
# redis 配置
REDIS_URL="redis://127.0.0.1:6379/0"
REDIS_ENABLE=1
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_USERNAME=""
REDIS_PASSWORD=""
REDIS_DB=3
```

#### 修改后

```bash
# redis 配置
REDIS_ENABLE=1
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_USERNAME=""
REDIS_PASSWORD=""
REDIS_DB=3
```

### 6. 导出更新 (`core/utils/index.ts`)

#### 修改前

```typescript
export { RedisHelper, setRedisClient, getRedisClient } from './redisHelper.js';
```

#### 修改后

```typescript
export { RedisHelper, initRedisClient, getRedisClient, closeRedisClient } from './redisHelper.js';
```

## 新增功能

### 1. Redis 连接选项配置

```typescript
new RedisClient(url, {
    // 连接超时（毫秒）
    connectionTimeout: 10000,
    // 空闲超时（毫秒），0 表示无超时
    idleTimeout: 30000,
    // 断开连接时自动重连
    autoReconnect: true,
    // 最大重连次数
    maxRetries: 10,
    // 断开连接时缓存命令
    enableOfflineQueue: true,
    // 自动管道化命令
    enableAutoPipelining: true
});
```

### 2. URL 构建逻辑

支持以下配置组合：

-   无认证：`redis://localhost:6379/0`
-   仅密码：`redis://:password@localhost:6379/0`
-   用户名+密码：`redis://username:password@localhost:6379/0`

### 3. 连接生命周期管理

-   `initRedisClient()` - 初始化客户端（懒加载）
-   `getRedisClient()` - 获取客户端实例
-   `closeRedisClient()` - 关闭连接并清理

## 环境变量说明

| 变量名             | 类型   | 默认值    | 说明                            |
| ------------------ | ------ | --------- | ------------------------------- |
| `REDIS_ENABLE`     | number | 1         | 是否启用 Redis (0=禁用, 1=启用) |
| `REDIS_HOST`       | string | localhost | Redis 服务器地址                |
| `REDIS_PORT`       | number | 6379      | Redis 服务器端口                |
| `REDIS_USERNAME`   | string | ''        | Redis 用户名（可选）            |
| `REDIS_PASSWORD`   | string | ''        | Redis 密码（可选）              |
| `REDIS_DB`         | number | 0         | Redis 数据库索引 (0-15)         |
| `REDIS_KEY_PREFIX` | string | befly     | Redis 键前缀                    |

## 测试结果

✅ **所有测试通过**

```
 81 pass
 1 skip
 0 fail
 150 expect() calls
Ran 82 tests across 7 files. [1.63s]
```

## 迁移指南

### 对于现有项目

1. **删除 `REDIS_URL` 环境变量**

    ```bash
    # 删除这一行
    REDIS_URL="redis://127.0.0.1:6379/0"
    ```

2. **确保 `REDIS_*` 环境变量正确配置**

    ```bash
    REDIS_ENABLE=1
    REDIS_HOST="127.0.0.1"
    REDIS_PORT=6379
    REDIS_USERNAME=""
    REDIS_PASSWORD=""
    REDIS_DB=0
    ```

3. **重启应用**
    - 框架会自动使用新的连接方式
    - 无需修改业务代码

### 连接 URL 映射示例

#### 示例 1：本地无密码

```bash
# 旧方式
REDIS_URL="redis://localhost:6379/0"

# 新方式
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_DB=0
```

#### 示例 2：带密码

```bash
# 旧方式
REDIS_URL="redis://:mypassword@localhost:6379/3"

# 新方式
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="mypassword"
REDIS_DB=3
```

#### 示例 3：带用户名和密码

```bash
# 旧方式
REDIS_URL="redis://myuser:mypassword@redis.example.com:6379/1"

# 新方式
REDIS_HOST="redis.example.com"
REDIS_PORT=6379
REDIS_USERNAME="myuser"
REDIS_PASSWORD="mypassword"
REDIS_DB=1
```

## 优势总结

1. ✅ **配置更灵活**：每个参数独立，易于修改
2. ✅ **消除冗余**：只使用 `REDIS_*` 变量，不再需要 `REDIS_URL`
3. ✅ **功能更强**：支持连接超时、自动重连、管道化等高级特性
4. ✅ **符合最佳实践**：使用 Bun 原生 `RedisClient` 类
5. ✅ **向后兼容**：业务代码无需修改，只需更新环境变量
6. ✅ **测试稳定**：所有测试通过，无功能退化

## 注意事项

1. **必须删除 `REDIS_URL`**：不再支持此环境变量
2. **确保配置完整**：特别是 `REDIS_HOST` 和 `REDIS_PORT`
3. **密码可选**：如果 Redis 无密码，留空即可
4. **数据库索引**：默认为 0，可设置为 0-15 之间的任意值

## 参考资料

-   [Bun Redis 文档](https://bun.sh/docs/api/redis)
-   [Bun GitHub - Redis API](https://github.com/oven-sh/bun/blob/main/docs/api/redis.md)
-   Context7 Bun Redis 文档查询结果

---

**重构完成！** 🎉
