# CORS 重复配置清理记录

## 重构时间

2025-10-11

## 问题发现

在代码审查中发现了**重复的 CORS 配置处理**：

### 重复情况

1. **`utils/index.ts`** - 定义了 `setCorsOptions(req)` 函数

    - 这是核心的 CORS 配置逻辑
    - 根据环境变量和请求生成 CORS 响应头

2. **`middleware/cors.ts`** - 定义了 `handleCors(req)` 函数
    - 但它只是简单地调用 `setCorsOptions(req)`
    - 没有任何额外的逻辑或处理
    - 造成了不必要的函数包装

```typescript
// middleware/cors.ts (重构前)
export function handleCors(req: Request): CorsResult {
    return setCorsOptions(req); // 🔴 只是一个简单的包装，没有必要
}
```

### 使用不一致

-   **`api.ts`**: 使用 `handleCors(req)` ❌
-   **`root.ts`**: 使用 `setCorsOptions(req)` ✅
-   **`static.ts`**: 使用 `setCorsOptions(req)` ✅

## 重构方案

**统一使用 `setCorsOptions`，移除不必要的 `handleCors` 函数**

### 为什么这样做？

1. ✅ `handleCors` 没有提供任何额外价值
2. ✅ 统一使用 `setCorsOptions`，代码更一致
3. ✅ 减少不必要的函数调用层级
4. ✅ 保留 `handleOptionsRequest`，因为它有实际的 OPTIONS 预检请求处理逻辑

## 重构内容

### 1. 修改 `core/router/api.ts`

**修改前：**

```typescript
import { No } from '../utils/index.js';
import { handleCors, handleOptionsRequest } from '../middleware/cors.js';

export function apiHandler(...) {
    return async (req: Request): Promise<Response> => {
        try {
            // 1. CORS处理
            const corsOptions = handleCors(req);  // ❌ 使用包装函数

            // ...
        } catch (error: any) {
            const corsOptions = handleCors(req);  // ❌ 使用包装函数
            // ...
        }
    };
}
```

**修改后：**

```typescript
import { No, setCorsOptions } from '../utils/index.js';
import { handleOptionsRequest } from '../middleware/cors.js';

export function apiHandler(...) {
    return async (req: Request): Promise<Response> => {
        try {
            // 1. CORS处理
            const corsOptions = setCorsOptions(req);  // ✅ 直接使用核心函数

            // ...
        } catch (error: any) {
            const corsOptions = setCorsOptions(req);  // ✅ 直接使用核心函数
            // ...
        }
    };
}
```

### 2. 简化 `core/middleware/cors.ts`

**修改前：**

```typescript
/**
 * CORS 中间件
 * 处理跨域请求
 */

import { setCorsOptions } from '../utils/index.js';

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 处理CORS
 */
export function handleCors(req: Request): CorsResult {
    return setCorsOptions(req); // ❌ 不必要的包装
}

/**
 * 处理OPTIONS预检请求
 */
export function handleOptionsRequest(corsOptions: CorsResult): Response {
    return new Response(null, {
        status: 204,
        headers: corsOptions.headers
    });
}
```

**修改后：**

```typescript
/**
 * CORS 中间件
 * 处理跨域请求
 */

export interface CorsResult {
    headers: Record<string, string>;
}

/**
 * 处理OPTIONS预检请求
 */
export function handleOptionsRequest(corsOptions: CorsResult): Response {
    return new Response(null, {
        status: 204,
        headers: corsOptions.headers
    });
}
```

## 重构前后对比

### 文件变化

| 文件                 | 修改内容                                                      | 行数变化 |
| -------------------- | ------------------------------------------------------------- | -------- |
| `router/api.ts`      | 导入改为 `setCorsOptions`，两处调用改为 `setCorsOptions(req)` | 无变化   |
| `middleware/cors.ts` | 删除 `handleCors` 函数和 `setCorsOptions` 导入                | -8 行    |

### CORS 使用统一

**重构后，所有地方统一使用：**

```typescript
import { setCorsOptions } from '../utils/index.js';

const corsOptions = setCorsOptions(req);
```

**现在的使用情况：**

-   ✅ `api.ts`: 使用 `setCorsOptions(req)`
-   ✅ `root.ts`: 使用 `setCorsOptions(req)`
-   ✅ `static.ts`: 使用 `setCorsOptions(req)`

### 代码流程

**重构前：**

```
api.ts → handleCors(req) → setCorsOptions(req) → 返回 CORS 配置
         ↑ middleware/cors.ts  ↑ utils/index.ts
         (不必要的包装层)
```

**重构后：**

```
api.ts → setCorsOptions(req) → 返回 CORS 配置
         ↑ utils/index.ts
         (直接调用核心函数)
```

## 测试结果

-   ✅ 所有 81 个测试通过
-   ✅ 功能完全正常
-   ✅ CORS 处理统一且简洁

## 保留的功能

`middleware/cors.ts` 文件保留了以下内容：

1. **`CorsResult` 接口** - 定义 CORS 返回结果的类型
2. **`handleOptionsRequest` 函数** - 处理 OPTIONS 预检请求
    - 这个函数有实际逻辑（返回 204 状态码）
    - 值得单独保留

## 优势总结

1. ✅ **更简洁**：减少不必要的函数包装
2. ✅ **更统一**：所有地方都使用 `setCorsOptions`
3. ✅ **更清晰**：代码结构更简单，易于理解
4. ✅ **更高效**：减少函数调用层级（虽然影响微乎其微）

## 设计原则

这次重构体现了几个重要原则：

1. **DRY (Don't Repeat Yourself)** - 不要重复自己

    - 移除了 `handleCors` 这个不必要的包装

2. **KISS (Keep It Simple, Stupid)** - 保持简单

    - 直接使用 `setCorsOptions` 更简单直接

3. **YAGNI (You Aren't Gonna Need It)** - 你不会需要它
    - `handleCors` 没有提供额外价值，删除它

## 相关文档

-   `core/utils/index.ts` - `setCorsOptions` 核心实现
-   `core/middleware/cors.ts` - CORS 中间件（简化后）
-   `core/router/api.ts` - API 路由处理器
-   `core/router/root.ts` - 根路径处理器
-   `core/router/static.ts` - 静态文件处理器
