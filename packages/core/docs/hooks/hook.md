# Hook 钩子开发指南

> 本文档详细介绍 Befly 框架的 Hook 钩子系统，包括钩子结构、执行顺序、内置钩子及自定义钩子开发。

## 目录

- [Hook 钩子开发指南](#hook-钩子开发指南)
    - [目录](#目录)
    - [概述](#概述)
        - [核心特性](#核心特性)
        - [与插件的区别](#与插件的区别)
    - [Hook 结构](#hook-结构)
        - [基础结构](#基础结构)
        - [完整类型定义](#完整类型定义)
    - [执行顺序](#执行顺序)
        - [order 值规范](#order-值规范)
        - [执行流程图](#执行流程图)
    - [内置钩子](#内置钩子)
        - [cors - 跨域处理](#cors---跨域处理)
        - [auth - 身份认证](#auth---身份认证)
        - [parser - 参数解析](#parser---参数解析)
        - [requestLogger - 请求日志](#requestlogger---请求日志)
        - [validator - 参数验证](#validator---参数验证)
        - [permission - 权限检查](#permission---权限检查)
    - [自定义钩子开发](#自定义钩子开发)
        - [基础钩子](#基础钩子)
        - [请求拦截钩子](#请求拦截钩子)
        - [限流钩子](#限流钩子)
        - [审计日志钩子](#审计日志钩子)
    - [中断请求](#中断请求)
    - [禁用钩子](#禁用钩子)
    - [最佳实践](#最佳实践)
        - [1. 合理设置 order](#1-合理设置-order)
        - [2. 提前检查 ctx.api](#2-提前检查-ctxapi)
        - [3. 错误处理](#3-错误处理)
        - [4. 避免重复处理](#4-避免重复处理)
        - [5. 性能考虑](#5-性能考虑)
    - [常见问题](#常见问题)
        - [Q1: 钩子执行顺序如何确定？](#q1-钩子执行顺序如何确定)
        - [Q2: 钩子可以访问插件吗？](#q2-钩子可以访问插件吗)
        - [Q3: 如何在钩子间传递数据？](#q3-如何在钩子间传递数据)
        - [Q4: 钩子抛出异常会怎样？](#q4-钩子抛出异常会怎样)
        - [Q5: 可以动态修改钩子吗？](#q5-可以动态修改钩子吗)

---

## 概述

Befly Hook 系统是请求处理的中间件机制，采用串联模式依次执行。每个 Hook 可以访问请求上下文、修改数据、或提前中断请求。

### 核心特性

- **串联执行**：按 order 顺序依次执行，无 next 调用
- **可中断**：设置 `ctx.response` 可提前中断后续处理
- **上下文共享**：所有 Hook 共享同一个 RequestContext
- **可禁用**：通过配置禁用指定钩子

### 与插件的区别

| 特性     | Hook 钩子      | Plugin 插件          |
| -------- | -------------- | -------------------- |
| 执行时机 | 每次请求时执行 | 应用启动时初始化一次 |
| 作用范围 | 请求级别       | 应用级别             |
| 访问对象 | befly + ctx    | befly                |
| 主要用途 | 请求处理中间件 | 功能模块封装         |
| 排序方式 | order 数值     | after 依赖关系       |

---

## Hook 结构

### 基础结构

```typescript
import type { Hook } from "befly/types/hook";

const hook: Hook = {
    // 执行顺序（数字越小越先执行）
    order: 10,

    // 处理函数
    handler: async (befly, ctx) => {
        // 处理逻辑
        // 可以访问 befly 全局对象和 ctx 请求上下文
    }
};

export default hook;
```

### 完整类型定义

```typescript
/**
 * 钩子处理函数类型
 */
type HookHandler = (befly: BeflyContext, ctx: RequestContext) => Promise<void> | void;

/**
 * 钩子配置类型
 */
interface Hook {
    /** 钩子名称（运行时自动生成，无需手动设置） */
    name?: string;

    /** 依赖的钩子列表（在这些钩子之后执行） */
    after?: string[];

    /** 执行顺序（数字越小越先执行） */
    order?: number;

    /** 钩子处理函数 */
    handler: HookHandler;

    /** 钩子配置（可选） */
    config?: Record<string, any>;

    /** 钩子描述（可选） */
    description?: string;
}
```

---

## 执行顺序

### order 值规范

| order | 钩子名称      | 职责说明         |
| ----- | ------------- | ---------------- |
| 2     | cors          | CORS 跨域处理    |
| 3     | auth          | JWT 身份认证     |
| 4     | parser        | 请求参数解析     |
| 5     | requestLogger | 请求日志记录     |
| 6     | validator     | 参数验证         |
| 6     | permission    | 权限检查         |
| 10-99 | 自定义钩子    | 业务逻辑钩子     |
| 100+  | 后置钩子      | 响应处理、清理等 |

**建议**：

- 1-9：框架核心钩子
- 10-99：业务逻辑钩子
- 100+：后置处理钩子

### 执行流程图

```
请求进入
    ↓
┌─────────────────────────────────────────────────┐
│ cors (order: 2)                                 │
│ - 设置 CORS 响应头                               │
│ - 处理 OPTIONS 预检请求 → 可能中断               │
├─────────────────────────────────────────────────┤
│ auth (order: 3)                                 │
│ - 解析 Authorization Header                     │
│ - 验证 JWT Token                                │
│ - 设置 ctx.user                                 │
├─────────────────────────────────────────────────┤
│ parser (order: 4)                               │
│ - GET: 解析 URL 查询参数                         │
│ - POST: 解析 JSON/XML 请求体                     │
│ - 根据 fields 过滤字段                           │
│ - 设置 ctx.body → 可能中断（格式错误）           │
├─────────────────────────────────────────────────┤
│ requestLogger (order: 5)                        │
│ - 记录请求日志                                   │
├─────────────────────────────────────────────────┤
│ validator (order: 6)                            │
│ - 验证必填字段                                   │
│ - 验证类型、长度、正则 → 可能中断                 │
├─────────────────────────────────────────────────┤
│ permission (order: 6)                           │
│ - 检查 auth 配置                                 │
│ - 验证登录状态                                   │
│ - 检查角色权限 → 可能中断                        │
├─────────────────────────────────────────────────┤
│ [自定义钩子 order: 10-99]                        │
│ - 限流、审计、数据预处理等                       │
├─────────────────────────────────────────────────┤
│ API Handler                                     │
│ - 执行业务逻辑                                   │
│ - 返回响应结果                                   │
├─────────────────────────────────────────────────┤
│ FinalResponse                                   │
│ - 格式化响应                                     │
│ - 记录请求日志                                   │
└─────────────────────────────────────────────────┘
    ↓
响应返回
```

---

## 内置钩子

内置钩子除本页总览外，也提供分文档说明（更聚焦配置与行为）：

- [cors Hook](./cors.md)
- [auth Hook](./auth.md)
- [parser Hook](./parser.md)
- [rateLimit Hook](./rateLimit.md)

### cors - 跨域处理

处理 CORS 跨域请求，设置响应头。

```typescript
// hooks/cors.ts
const hook: Hook = {
    order: 2,
    handler: async (befly, ctx) => {
        const req = ctx.req;

        // 合并默认配置和用户配置
        const defaultConfig: CorsConfig = {
            origin: "*",
            methods: "GET, POST, PUT, DELETE, OPTIONS",
            allowedHeaders: "Content-Type, Authorization, authorization, token",
            exposedHeaders: "Content-Range, X-Content-Range, Authorization, authorization, token",
            maxAge: 86400,
            credentials: "true"
        };

        const corsConfig = { ...defaultConfig, ...(beflyConfig.cors || {}) };

        // 设置 CORS 响应头
        ctx.corsHeaders = setCorsOptions(req, corsConfig);

        // 处理 OPTIONS 预检请求
        if (req.method === "OPTIONS") {
            ctx.response = new Response(null, {
                status: 204,
                headers: ctx.corsHeaders
            });
            return; // 中断后续处理
        }
    }
};
```

**配置**：

```json
// befly.development.json
{
    "cors": {
        "origin": "https://example.com",
        "methods": "GET, POST",
        "allowedHeaders": "Content-Type, Authorization",
        "maxAge": 3600,
        "credentials": "true"
    }
}
```

---

### auth - 身份认证

解析 JWT Token，设置用户信息。

```typescript
// hooks/auth.ts
const hook: Hook = {
    order: 3,
    handler: async (befly, ctx) => {
        const authHeader = ctx.req.headers.get("authorization");

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);

            try {
                const payload = await befly.jwt.verify(token);
                ctx.user = payload;
            } catch (error: any) {
                ctx.user = {};
            }
        } else {
            ctx.user = {};
        }
    }
};
```

**特点**：

- 不中断请求，仅设置 `ctx.user`
- Token 无效时设置空对象 `{}`
- 权限检查由 permission 钩子负责

---

### parser - 参数解析

解析请求参数，根据 API 字段定义过滤。

```typescript
// hooks/parser.ts
const hook: Hook = {
    order: 4,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // GET 请求：解析查询参数
        if (ctx.req.method === "GET") {
            const url = new URL(ctx.req.url);
            const params = Object.fromEntries(url.searchParams);

            if (ctx.api.rawBody) {
                ctx.body = params;
            } else if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                ctx.body = pickFields(params, Object.keys(ctx.api.fields));
            } else {
                ctx.body = params;
            }
        }
        // POST 请求：解析 JSON/XML
        else if (ctx.req.method === "POST") {
            const contentType = ctx.req.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const body = await ctx.req.json();
                // 过滤字段...
                ctx.body = pickFields(body, Object.keys(ctx.api.fields));
            } else if (contentType.includes("application/xml")) {
                // XML 解析...
            } else {
                ctx.response = ErrorResponse(ctx, "无效的请求参数格式");
                return;
            }
        }
    }
};
```

**支持格式**：

- `application/json`
- `application/xml` / `text/xml`

---

### requestLogger - 请求日志

在参数解析后记录请求日志。

```typescript
// hooks/requestLogger.ts
const hook: Hook = {
    order: 5,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        const logData = {
            requestId: ctx.requestId,
            route: ctx.route,
            ip: ctx.ip,
            userId: ctx.user?.id || "",
            nickname: ctx.user?.nickname || "",
            roleCode: ctx.user?.roleCode || ""
        };

        // 截断大请求体
        if (ctx.body && Object.keys(ctx.body).length > 0) {
            logData.body = truncateBody(ctx.body);
        }

        Logger.info(logData, "请求日志");
    }
};
```

**特点**：

- 自动截断超长字段（500 字符）
- 不记录非 API 请求

---

### validator - 参数验证

验证请求参数类型、必填、长度等。

```typescript
// hooks/validator.ts
const hook: Hook = {
    order: 6,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;
        if (!ctx.api.fields) return;

        // 验证参数
        const result = Validator.validate(ctx.body, ctx.api.fields, ctx.api.required || []);

        if (result.code !== 0) {
            ctx.response = ErrorResponse(ctx, result.firstError || "参数验证失败", 1, null, result.fieldErrors);
            return;
        }
    }
};
```

**验证内容**：

- 必填字段检查
- 类型验证（string/number/text 等）
- 长度/范围验证（min/max）
- 正则验证（regex）

---

### permission - 权限检查

检查用户权限，验证 API 访问授权。

```typescript
// hooks/permission.ts
import { CacheKeys } from "befly/lib/cacheKeys";

const hook: Hook = {
    order: 6,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 1. 接口无需权限
        if (ctx.api.auth === false) {
            return;
        }

        // 2. 用户未登录
        if (!ctx.user || !ctx.user.id) {
            ctx.response = ErrorResponse(ctx, "未登录");
            return;
        }

        // 3. 开发者权限（最高权限）
        if (ctx.user.roleCode === "dev") {
            return;
        }

        // 4. 角色权限检查
        let hasPermission = false;
        if (ctx.user.roleCode && befly.redis) {
            // 统一格式：METHOD/path（与写入缓存保持一致）
            const apiPath = normalizeApiPath(ctx.req.method, new URL(ctx.req.url).pathname);

            // 极简方案：每个角色一个 Set，直接判断成员是否存在
            const roleApisKey = CacheKeys.roleApis(ctx.user.roleCode);
            hasPermission = await befly.redis.sismember(roleApisKey, apiPath);
        }

        if (!hasPermission) {
            const apiLabel = ctx.api?.name ? ctx.api.name : apiPath;
            ctx.response = ErrorResponse(ctx, `无权访问 ${apiLabel} 接口`);
            return;
        }
    }
};
```

**权限层级**：

1. `auth: false` - 公开接口，无需检查
2. 未登录 - 返回"未登录"
3. `roleCode: 'dev'` - 开发者，最高权限
4. Redis 权限集合 - 检查角色是否有 API 权限

---

## 自定义钩子开发

### 基础钩子

```typescript
// hooks/myHook.ts（项目钩子名：app_myHook）
import type { Hook } from "befly/types/hook";

const hook: Hook = {
    order: 10,
    handler: async (befly, ctx) => {
        befly.logger.info({ route: ctx.route }, "自定义钩子执行");
    }
};

export default hook;
```

---

### 请求拦截钩子

拦截特定请求：

```typescript
// hooks/blacklist.ts
import type { Hook } from "befly/types/hook";
import { ErrorResponse } from "befly/utils/response";

const hook: Hook = {
    order: 1, // 最先执行
    handler: async (befly, ctx) => {
        // IP 黑名单检查
        const blacklist = ["192.168.1.100", "10.0.0.1"];

        if (blacklist.includes(ctx.ip)) {
            ctx.response = ErrorResponse(ctx, "您的 IP 已被禁止访问", 403);
            return;
        }
    }
};

export default hook;
```

---

### 限流钩子

基于 Redis 的请求限流：

> 说明：Befly Core 已内置 `rateLimit` 钩子（默认启用）。
>
> 默认行为：按 IP 对所有 API 进行限流（默认阈值：$1000/60$，即 60 秒最多 1000 次）。
>
> - 关闭：`rateLimit.enable = 0`
> - 覆盖：配置 `rules`（更细粒度）或调整 `defaultLimit/defaultWindow`
> - 跳过：配置 `skipRoutes`（命中后直接跳过限流，优先级最高）
>
> 规则选择：当多条 `rules` 同时命中时，会优先选择更“具体”的规则（精确 > 前缀 > 通配）；
> 同等具体度按 `rules` 的先后顺序。
>
> key 行为：当 `key = user` 且请求上下文中没有 `ctx.user.id` 时，会回退为按 IP 计数，避免所有匿名请求共享同一个计数桶。

配置示例（`configs/befly.common.json`）：

```json
{
    "rateLimit": {
        "enable": 1,
        "defaultLimit": 1000,
        "defaultWindow": 60,
        "key": "ip",
        "skipRoutes": ["/api/health", "/api/metrics"],
        "rules": [
            {
                "route": "/api/auth/*",
                "limit": 20,
                "window": 60,
                "key": "ip"
            },
            {
                "route": "/api/order/create",
                "limit": 5,
                "window": 60,
                "key": "user"
            }
        ]
    }
}
```

```typescript
// hooks/rateLimit.ts
import type { Hook } from "befly/types/hook";
import { ErrorResponse } from "befly/utils/response";

const hook: Hook = {
    order: 7,
    handler: async (befly, ctx) => {
        if (!ctx.api || !befly.redis) return;

        // 限流配置：10 次/60 秒
        const limit = 10;
        const window = 60;

        // 限流 key：IP + 路由
        const key = `ratelimit:${ctx.ip}:${ctx.route}`;

        // 原子计数 + 首次设置过期
        const count = await befly.redis.incrWithExpire(key, window);

        // 超过限制
        if (count > limit) {
            ctx.response = ErrorResponse(ctx, "请求过于频繁，请稍后再试", 1);
            return;
        }
    }
};

export default hook;
```

---

### 审计日志钩子

记录操作审计日志：

```typescript
// hooks/audit.ts
import type { Hook } from "befly/types/hook";

const hook: Hook = {
    order: 100, // 在 handler 执行后
    handler: async (befly, ctx) => {
        // 只记录写操作
        if (!ctx.api || ctx.req.method === "GET") return;
        if (!ctx.user?.id) return;

        // 记录审计日志
        try {
            await befly.db.insData({
                table: "audit_log",
                data: {
                    userId: ctx.user.id,
                    username: ctx.user.username || "",
                    route: ctx.route,
                    method: ctx.req.method,
                    ip: ctx.ip,
                    requestBody: JSON.stringify(ctx.body).substring(0, 1000),
                    operateTime: Date.now()
                }
            });
        } catch (error) {
            befly.logger.error({ err: error }, "审计日志记录失败");
        }
    }
};

export default hook;
```

---

## 中断请求

设置 `ctx.response` 可以中断后续 Hook 和 API Handler 的执行：

```typescript
import { ErrorResponse } from "befly/utils/response";

const hook: Hook = {
    order: 5,
    handler: async (befly, ctx) => {
        // 条件判断
        if (someCondition) {
            // 设置 response 中断请求
            ctx.response = ErrorResponse(ctx, "请求被拦截", 1);
            return; // 必须 return
        }

        // 继续执行后续钩子...
    }
};
```

**ErrorResponse 函数**：

```typescript
ErrorResponse(ctx, msg, code?, data?, detail?)
// ctx: RequestContext - 请求上下文
// msg: string - 错误消息
// code: number - 错误码（默认 1）
// data: any - 附加数据（默认 null）
// detail: any - 详细信息（默认 null）
```

---

## 禁用钩子

在配置文件中设置 `disableHooks` 数组：

```json
// befly.development.json
{
    "disableHooks": ["requestLogger", "permission"]
}
```

被禁用的钩子不会被加载和执行。

---

## 最佳实践

### 1. 合理设置 order

```typescript
// ✅ 推荐：使用适当的 order 值
const hook: Hook = {
    order: 15, // 在核心钩子之后
    handler: async (befly, ctx) => {
        /* ... */
    }
};

// ❌ 避免：使用过小的 order 值
const hook: Hook = {
    order: 1, // 可能影响核心钩子
    handler: async (befly, ctx) => {
        /* ... */
    }
};
```

### 2. 提前检查 ctx.api

```typescript
// ✅ 推荐：检查 ctx.api 是否存在
const hook: Hook = {
    handler: async (befly, ctx) => {
        if (!ctx.api) return; // 非 API 请求直接跳过
        // ...
    }
};
```

### 3. 错误处理

```typescript
// ✅ 推荐：捕获异常避免影响请求
const hook: Hook = {
    handler: async (befly, ctx) => {
        try {
            await someOperation();
        } catch (error) {
            befly.logger.error({ err: error }, "钩子执行失败");
            // 根据业务决定是否中断请求
        }
    }
};
```

### 4. 避免重复处理

```typescript
// ✅ 推荐：检查是否已处理
const hook: Hook = {
    handler: async (befly, ctx) => {
        if (ctx.response) return; // 已有响应，跳过
        // ...
    }
};
```

### 5. 性能考虑

````typescript
// ✅ 推荐：异步操作使用 Promise
const hook: Hook = {
    handler: async (befly, ctx) => {
        // 可以并行的操作
        const [result1, result2] = await Promise.all([operation1(), operation2()]);
    }
};

### 6. 直接使用字段，避免多余变量

仅用于“转发参数 / 改名 / 只用一次”的中间变量不要定义；优先直接使用来源对象字段（例如 `ctx.body.xxx`、`payload.xxx`）。

```typescript
// ❌ 避免：只为转发参数而改名/多一层
const hook: Hook = {
    handler: async (befly, ctx) => {
        const payload = await befly.jwt.verify(token); // token 解析略
        const userId = payload.id;
        setCtxUser(userId, payload.roleCode, payload.nickname, payload.roleType);
    }
};

// ✅ 推荐：直接转发字段
const hook2: Hook = {
    handler: async (befly, ctx) => {
        const payload = await befly.jwt.verify(token); // token 解析略
        setCtxUser(payload.id, payload.roleCode, payload.nickname, payload.roleType);
    }
};

// ✅ 例外：需要类型收窄/非空校验/复用（>=2 次）时再定义变量
const hook3: Hook = {
    handler: async (befly, ctx) => {
        const payload = await befly.jwt.verify(token); // token 解析略
        const userId = payload.id;
        if (typeof userId !== "number") return;

        setCtxUser(userId, payload.roleCode, payload.nickname, payload.roleType);
    }
};
````

````

---

## 常见问题

### Q1: 钩子执行顺序如何确定？

按 `order` 值从小到大排序执行，相同 `order` 值按文件名字母顺序。

### Q2: 钩子可以访问插件吗？

可以，通过 `befly` 参数访问所有插件：

```typescript
const hook: Hook = {
    handler: async (befly, ctx) => {
        await befly.db.getOne({
            /* ... */
        });
        await befly.redis.get("key");
        befly.logger.info("日志");
    }
};
````

### Q3: 如何在钩子间传递数据？

通过 `ctx` 上下文传递：

```typescript
// 钩子 A（order: 10）
ctx.customData = { key: "value" };

// 钩子 B（order: 20）
const data = ctx.customData;
```

### Q4: 钩子抛出异常会怎样？

未捕获的异常会被全局错误处理捕获，返回 500 错误响应。建议在钩子内部处理异常。

### Q5: 可以动态修改钩子吗？

不支持运行时动态修改，所有钩子在应用启动时加载。
