# Befly API 接口文档

> 本文档详细介绍 Befly 框架的 API 接口开发规范，包括路由定义、参数验证、权限控制、请求处理流程等。

## 目录

- [Befly API 接口文档](#befly-api-接口文档)
    - [目录](#目录)
    - [概述](#概述)
        - [核心特性](#核心特性)
    - [目录结构](#目录结构-1)
        - [项目 API](#项目-api)
        - [Addon API](#addon-api)
        - [文件命名规范](#文件命名规范)
    - [API 定义](#api-定义)
        - [基础结构](#基础结构)
        - [完整类型定义](#完整类型定义)
    - [请求上下文 (RequestContext)](#请求上下文-requestcontext)
        - [结构定义](#结构定义)
        - [常用属性](#常用属性)
    - [响应函数](#响应函数)
        - [Yes - 成功响应](#yes---成功响应)
        - [No - 失败响应](#no---失败响应)
        - [ErrorResponse - Hook 中断响应](#errorresponse---hook-中断响应)
        - [FinalResponse - 最终响应](#finalresponse---最终响应)
    - [字段定义与验证](#字段定义与验证)
        - [预定义字段](#预定义字段)
        - [字段定义格式](#字段定义格式)
        - [字段类型](#字段类型)
        - [验证规则](#验证规则)
    - [实际案例](#实际案例)
        - [案例一：公开接口（无需认证）](#案例一公开接口无需认证)
        - [案例二：列表查询（需要认证）](#案例二列表查询需要认证)
        - [案例三：新增数据](#案例三新增数据)
        - [案例四：更新数据](#案例四更新数据)
        - [案例五：删除数据](#案例五删除数据)
        - [案例六：获取详情](#案例六获取详情)
        - [案例七：支持 GET 和 POST](#案例七支持-get-和-post)
        - [案例八：保留原始请求体（webhook）](#案例八保留原始请求体webhook)
        - [案例九：预处理函数](#案例九预处理函数)
    - [请求处理流程](#请求处理流程)
        - [Hook 执行顺序（洋葱模型）](#hook-执行顺序洋葱模型)
        - [中断请求](#中断请求)
    - [路由加载机制](#路由加载机制)
        - [加载顺序](#加载顺序)
        - [路由映射规则](#路由映射规则)
        - [多方法注册](#多方法注册)
    - [BeflyContext 对象](#beflycontext-对象)
    - [最佳实践](#最佳实践)
        - [1. 字段引用优先级](#1-字段引用优先级)
        - [2. 直接使用 ctx.body](#2-直接使用-ctxbody)
        - [3. 明确字段赋值](#3-明确字段赋值)
        - [4. 错误处理](#4-错误处理)
        - [5. 时间字段使用 Date.now()](#5-时间字段使用-datenow)
    - [常见问题](#常见问题)
    - [高级用法](#高级用法)
        - [事务处理](#事务处理)
        - [批量操作](#批量操作)
        - [复杂查询](#复杂查询)
        - [缓存策略](#缓存策略)
        - [分布式锁](#分布式锁)
        - [数据导出](#数据导出)
        - [文件流处理](#文件流处理)

---

## 概述

Befly 框架的 API 系统是一套基于约定优于配置的接口开发体系。通过简洁的 JSON 配置定义接口，自动完成路由注册、参数解析、字段验证、权限控制等功能。

### 核心特性

- **约定式路由**：文件路径自动映射为 API 路径
- **声明式配置**：通过简洁的配置定义接口行为
- **自动字段验证**：基于字段定义自动验证请求参数
- **权限控制**：支持认证和角色权限检查
- **洋葱模型**：Hook 中间件按顺序处理请求

---

## 目录结构

### 项目 API

```
tpl/apis/
├── user/
│   ├── login.ts      → POST /api/user/login
│   ├── register.ts   → POST /api/user/register
│   └── info.ts       → POST /api/user/info
└── article/
    ├── list.ts       → POST /api/article/list
    └── detail.ts     → POST /api/article/detail
```

### Addon API

```
addonAdmin/apis/
├── auth/
│   ├── login.ts      → POST /api/addon/addonAdmin/auth/login
│   └── logout.ts     → POST /api/addon/addonAdmin/auth/logout
└── admin/
    ├── list.ts       → POST /api/addon/addonAdmin/admin/list
    └── ins.ts        → POST /api/addon/addonAdmin/admin/ins
```

### 文件命名规范

| 动作 | 后缀     | 说明   | 示例            |
| ---- | -------- | ------ | --------------- |
| 添加 | `Ins`    | Insert | `userIns.ts`    |
| 更新 | `Upd`    | Update | `userUpd.ts`    |
| 删除 | `Del`    | Delete | `userDel.ts`    |
| 列表 | `List`   | List   | `userList.ts`   |
| 全部 | `All`    | All    | `userAll.ts`    |
| 详情 | `Detail` | Detail | `userDetail.ts` |

---

## API 定义

### 基础结构

```typescript
import type { ApiRoute } from "befly/types/api";

export default {
    // 必填字段
    name: "接口名称", // 接口描述，用于日志和文档
    handler: async (befly, ctx) => {
        // 处理逻辑
        return befly.tool.Yes("成功", { data });
    },

    // 可选字段
    method: "POST", // HTTP 方法，默认 POST
    auth: true, // 是否需要认证，默认 true
    fields: {}, // 字段定义（验证规则）
    required: [], // 必填字段列表
    rawBody: false, // 是否保留原始请求体
    cache: undefined, // 缓存时间（秒）
    rateLimit: undefined // 限流配置
} as ApiRoute;
```

### 完整类型定义

```typescript
interface ApiRoute<T = any, R = any> {
    /** 接口名称（必填） */
    name: string;

    /** 处理器函数（必填） */
    handler: ApiHandler<T, R>;

    /** HTTP 方法（可选，默认 POST，支持逗号分隔多个方法） */
    method?: "GET" | "POST" | "GET,POST" | "POST,GET";

    /** 认证类型（可选，默认 true）
     * - true: 需要登录
     * - false: 公开访问（无需登录）
     */
    auth?: boolean;

    /** 字段定义（验证规则）（可选，默认 {}） */
    fields?: TableDefinition;

    /** 必填字段（可选，默认 []） */
    required?: string[];

    /** 是否保留原始请求体（可选，默认 false）
     * - true: 不过滤字段，保留完整请求体（适用于微信回调、webhook 等场景）
     * - false: 根据 fields 定义过滤字段
     */
    rawBody?: boolean;

    /** 缓存配置（可选，单位：秒） */
    cache?: number;

    /** 限流配置（可选，格式：次数/秒，如 "10/60" 表示 60秒内10次） */
    rateLimit?: string;

    /** 路由路径（运行时生成，无需手动设置） */
    route?: string;
}
```

---

## 请求上下文 (RequestContext)

### 结构定义

```typescript
interface RequestContext {
    /** 请求方法 (GET/POST) */
    method: string;

    /** 请求体参数（已解析和过滤） */
    body: Record<string, any>;

    /** 用户信息（从 JWT 解析） */
    user: Record<string, any>;

    /** 原始请求对象 */
    req: Request;

    /** 请求开始时间（毫秒） */
    now: number;

    /** 客户端 IP 地址 */
    ip: string;

    /** 请求头 */
    headers: Headers;

    /** API 路由路径（如 POST/api/user/login） */
    route: string;

    /** 请求唯一 ID */
    requestId: string;

    /** CORS 响应头 */
    corsHeaders: Record<string, string>;

    /** 当前请求的 API 路由对象 */
    api?: ApiRoute;

    /** 响应对象（设置后将直接返回） */
    response?: Response;

    /** 原始处理结果 */
    result?: any;
}
```

### 常用属性

| 属性        | 类型      | 说明                   |
| ----------- | --------- | ---------------------- |
| `ctx.body`  | `object`  | 已解析的请求参数       |
| `ctx.user`  | `object`  | 当前登录用户信息       |
| `ctx.ip`    | `string`  | 客户端 IP              |
| `ctx.now`   | `number`  | 请求开始时间戳（毫秒） |
| `ctx.route` | `string`  | 完整路由路径           |
| `ctx.req`   | `Request` | 原始 Request 对象      |

---

## 响应函数

### Yes - 成功响应

```typescript
befly.tool.Yes(msg: string, data?: any, other?: Record<string, any>)
```

返回格式：

```json
{
    "code": 0,
    "msg": "成功消息",
    "data": { ... }
}
```

### No - 失败响应

```typescript
befly.tool.No(msg: string, data?: any, other?: Record<string, any>)
```

返回格式：

```json
{
    "code": 1,
    "msg": "失败消息",
    "data": null
}
```

### Raw - 原始响应

用于第三方回调等需要自定义响应格式的场景，直接返回 `Response` 对象。自动识别数据类型并设置正确的 Content-Type。

```typescript
befly.tool.Raw(ctx: RequestContext, data: Record<string, any> | string, options?: ResponseOptions)
```

**参数说明：**

| 参数    | 类型                          | 必填 | 默认值 | 说明                     |
| ------- | ----------------------------- | ---- | ------ | ------------------------ |
| ctx     | RequestContext                | 是   | -      | 请求上下文               |
| data    | Record<string, any> \| string | 是   | -      | 响应数据（对象或字符串） |
| options | ResponseOptions               | 否   | {}     | 响应选项                 |

**ResponseOptions 选项：**

| 属性        | 类型                   | 默认值   | 说明                                     |
| ----------- | ---------------------- | -------- | ---------------------------------------- |
| status      | number                 | 200      | HTTP 状态码                              |
| contentType | string                 | 自动判断 | Content-Type，默认根据 data 类型自动判断 |
| headers     | Record<string, string> | {}       | 额外的响应头                             |

**Content-Type 自动判断规则：**

| data 类型             | 自动 Content-Type |
| --------------------- | ----------------- |
| 对象                  | application/json  |
| 字符串（以 `<` 开头） | application/xml   |
| 字符串（其他）        | text/plain        |

**使用示例：**

```typescript
// JSON 响应（自动）
return befly.tool.Raw(ctx, { code: "SUCCESS", message: "成功" });

// 纯文本响应（自动）- 支付宝回调
return befly.tool.Raw(ctx, "success");

// XML 响应（自动判断）
return befly.tool.Raw(ctx, "<xml><return_code>SUCCESS</return_code></xml>");

// XML 响应（手动指定）
return befly.tool.Raw(ctx, xmlString, { contentType: "application/xml" });

// 自定义状态码
return befly.tool.Raw(ctx, { error: "Not Found" }, { status: 404 });

// 自定义响应头
return befly.tool.Raw(
    ctx,
    { code: "SUCCESS" },
    {
        headers: { "X-Custom-Header": "value" }
    }
);
```

**完整回调示例：**

```typescript
// 微信支付回调
export default {
    name: "微信支付回调",
    auth: false,
    rawBody: true,
    handler: async (befly, ctx) => {
        if (!befly.weixin) {
            return befly.tool.Raw(ctx, { code: "SYSTEM_ERROR", message: "weixin 插件未配置" });
        }

        // 处理成功
        return befly.tool.Raw(ctx, { code: "SUCCESS", message: "" });
    }
};

// 支付宝回调
export default {
    name: "支付宝回调",
    auth: false,
    rawBody: true,
    handler: async (befly, ctx) => {
        // 支付宝要求返回纯文本 "success"
        return befly.tool.Raw(ctx, "success");
    }
};

// 微信公众号 XML 回调
export default {
    name: "微信公众号回调",
    auth: false,
    rawBody: true,
    handler: async (befly, ctx) => {
        // 返回 XML 格式响应
        const xml = `<xml>
            <ToUserName><![CDATA[${fromUser}]]></ToUserName>
            <FromUserName><![CDATA[${toUser}]]></FromUserName>
            <CreateTime>${Date.now()}</CreateTime>
            <MsgType><![CDATA[text]]></MsgType>
            <Content><![CDATA[收到]]></Content>
        </xml>`;
        return befly.tool.Raw(ctx, xml);
    }
};
```

**注意**：`Raw` 返回的是 `Response` 对象，会直接作为 HTTP 响应返回，不经过 `FinalResponse` 处理。

### ErrorResponse - Hook 中断响应

在 Hook 中使用，用于提前拦截请求：

```typescript
import { ErrorResponse } from "befly/utils/response";

// 在 Hook 中使用
ctx.response = ErrorResponse(ctx, "未授权", 1, null);
```

### FinalResponse - 最终响应

在 API 路由末尾自动调用，无需手动使用。自动处理 `ctx.result` 并记录请求日志。

---

## 字段定义与验证

### 预定义字段

框架提供了一套预定义字段系统，通过 `@` 符号引用常用字段，避免重复定义。

#### 可用预定义字段

```typescript
const PRESET_FIELDS = {
    "@id": {
        name: "ID",
        type: "number",
        min: 1,
        max: null
    },
    "@page": {
        name: "页码",
        type: "number",
        min: 1,
        max: 9999
    },
    "@limit": {
        name: "每页数量",
        type: "number",
        min: 1,
        max: 100
    },
    "@keyword": {
        name: "关键词",
        type: "string",
        min: 1,
        max: 50
    },
    "@state": {
        name: "状态",
        type: "number",
        min: 0,
        max: 2
    }
};
```

#### 预定义字段说明

| 字段       | 类型     | 范围      | 说明                                 |
| ---------- | -------- | --------- | ------------------------------------ |
| `@id`      | `number` | >= 1      | 通用 ID 字段，用于详情/删除等        |
| `@page`    | `number` | 1-9999    | 分页页码，默认从 1 开始              |
| `@limit`   | `number` | 1-100     | 每页数量，最大 100 条                |
| `@keyword` | `string` | 1-50 字符 | 搜索关键词                           |
| `@state`   | `number` | 0-2       | 状态字段（0=软删除，1=正常，2=禁用） |

#### 使用方式

在 `fields` 中使用 `@` 符号引用预定义字段：

```typescript
// 方式一：直接字符串引用
fields: {
    id: '@id',
    page: '@page',
    limit: '@limit',
    keyword: '@keyword',
    state: '@state'
}

// 方式二：与自定义字段混用
fields: {
    page: '@page',
    limit: '@limit',
    categoryId: { name: '分类ID', type: 'number', min: 0 }
}
```

#### 加载机制

1. **按需引用**：只有在 `fields` 中显式声明的预定义字段才会生效
2. **自动替换**：在 API 加载时，`@` 引用会被自动替换为完整的字段定义
3. **验证生效**：引用的预定义字段会自动应用验证规则

#### 使用预定义字段示例

**列表查询接口**

```typescript
// apis/article/list.ts
export default {
    name: "文章列表",
    auth: true,
    fields: {
        page: "@page",
        limit: "@limit",
        keyword: "@keyword",
        state: "@state",
        categoryId: { name: "分类ID", type: "number", min: 0 }
    },
    handler: async (befly, ctx) => {
        const { page, limit, keyword, categoryId } = ctx.body;

        const where: Record<string, any> = { state: 1 };
        if (categoryId) where.categoryId = categoryId;
        if (keyword) where.title = { $like: `%${keyword}%` };

        const result = await befly.db.getList({
            table: "article",
            columns: ["id", "title", "summary", "createdAt"],
            where: where,
            page: page || 1,
            limit: limit || 10,
            orderBy: { id: "desc" }
        });

        return befly.tool.Yes("获取成功", result);
    }
} as ApiRoute;
```

**详情/删除接口**

```typescript
// apis/article/detail.ts
export default {
    name: "文章详情",
    auth: false,
    fields: {
        id: "@id"
    },
    required: ["id"],
    handler: async (befly, ctx) => {
        const article = await befly.db.getDetail({
            table: "article",
            where: { id: ctx.body.id, state: 1 }
        });

        if (!article?.id) {
            return befly.tool.No("文章不存在");
        }

        return befly.tool.Yes("获取成功", article);
    }
} as ApiRoute;
```

```typescript
// apis/article/delete.ts
export default {
    name: "删除文章",
    auth: true,
    fields: {
        id: "@id"
    },
    required: ["id"],
    handler: async (befly, ctx) => {
        await befly.db.delData({
            table: "article",
            where: { id: ctx.body.id }
        });

        return befly.tool.Yes("删除成功");
    }
} as ApiRoute;
```

#### 覆盖预定义字段

如需修改预定义字段的验证规则，在 `fields` 中重新定义即可：

```typescript
export default {
    name: "大数据列表",
    fields: {
        page: "@page",
        // 覆盖默认的 @limit，允许更大的分页
        limit: {
            name: "每页数量",
            type: "number",
            min: 1,
            max: 500 // 修改最大值为 500
        }
    },
    handler: async (befly, ctx) => {
        // ctx.body.limit 最大可以是 500
        return befly.tool.Yes("获取成功");
    }
} as ApiRoute;
```

#### 预定义字段最佳实践

**推荐使用场景**

| API 类型 | 推荐字段                            | 说明               |
| -------- | ----------------------------------- | ------------------ |
| 列表查询 | `page`, `limit`, `keyword`, `state` | 完整的查询字段组合 |
| 获取详情 | `id`                                | 只需 ID 参数       |
| 删除操作 | `id`                                | 只需 ID 参数       |
| 更新操作 | `id` + 表字段                       | ID + 业务字段      |
| 添加操作 | 表字段（无需预定义字段）            | 只需业务字段       |

**使用建议**

```typescript
// ✅ 推荐：列表查询使用完整预定义字段
fields: {
    page: '@page',
    limit: '@limit',
    keyword: '@keyword',
    state: '@state'
}

// ✅ 推荐：详情/删除只使用 id
fields: {
    id: '@id'
}

// ✅ 推荐：更新接口混用预定义和表字段
fields: {
    id: '@id',
    ...articleTable
}

// ❌ 避免：添加接口不需要预定义字段
fields: {
    page: '@page', // 添加操作不需要分页
    ...articleTable
}
```

### 字段定义格式

```typescript
fields: {
    // 方式一：引用表字段
    email: adminTable.email,

    // 方式二：自定义字段
    account: {
        name: '账号',
        type: 'string',
        min: 3,
        max: 100
    },

    // 方式三：字符串格式
    // "字段标签|类型|最小|最大|默认|必填|正则"
    username: '用户名|string|3|20'
}
```

### 字段类型

| 类型           | 说明       | 数据库映射        |
| -------------- | ---------- | ----------------- |
| `string`       | 字符串     | VARCHAR           |
| `number`       | 数字       | BIGINT            |
| `text`         | 长文本     | MEDIUMTEXT / TEXT |
| `array_string` | 字符串数组 | VARCHAR (JSON)    |
| `array_text`   | 文本数组   | MEDIUMTEXT (JSON) |

### 验证规则

```typescript
interface FieldDefinition {
    name: string; // 字段名称（用于错误提示）
    type: string; // 字段类型
    min?: number; // 最小值/最小长度
    max?: number; // 最大值/最大长度
    default?: any; // 默认值
    required?: boolean; // 是否必填
    regex?: string; // 正则表达式
}
```

---

## rawBody 原始请求体

### 概述

`rawBody` 参数用于控制 `parser` 钩子的行为。当设置 `rawBody: true` 时，框架会**完全跳过请求体解析**，`ctx.body` 为空对象 `{}`，handler 可以通过 `ctx.req` 获取原始请求自行处理。

这对于需要**手动验签、解密**的场景非常重要，如微信支付回调需要原始请求体来验证 RSA 签名。

### 工作原理

#### 默认行为（rawBody: false）

```typescript
// API 定义
export default {
    name: '更新用户',
    fields: {
        id: '@id',
        username: { name: '用户名', type: 'string', max: 50 }
    },
    handler: async (befly, ctx) => {
        // ctx.body 只包含 fields 中定义的字段
    }
};

// 请求参数
{ id: 1, username: 'test', email: 'test@qq.com', role: 'admin' }

// ctx.body 实际值（过滤后）
{ id: 1, username: 'test' }
// email 和 role 被过滤掉了
```

#### rawBody 模式（rawBody: true）

```typescript
// API 定义
export default {
    name: "微信支付回调",
    method: "POST",
    auth: false,
    rawBody: true, // 跳过解析，保留原始请求
    handler: async (befly, ctx) => {
        // ctx.body 为空对象 {}
        // 通过 ctx.req 获取原始请求自行处理

        // 获取原始请求体（用于验签）
        const rawBody = await ctx.req.text();

        // 解析数据
        const data = JSON.parse(rawBody);

        // 处理业务逻辑...
    }
};
```

### 处理流程

| rawBody        | parser 钩子行为                 | ctx.body     | 使用场景           |
| -------------- | ------------------------------- | ------------ | ------------------ |
| `false` (默认) | 解析 JSON/XML，根据 fields 过滤 | 解析后的对象 | 普通 CRUD          |
| `true`         | **完全跳过**，不解析请求体      | `{}` 空对象  | 回调验签、手动解密 |

### 适用场景

| 场景         | rawBody | 说明                           |
| ------------ | ------- | ------------------------------ |
| 微信支付回调 | `true`  | 需要原始请求体验证 RSA 签名    |
| 支付宝回调   | `true`  | 需要原始请求体验证签名         |
| Webhook      | `true`  | 需要原始请求体验证 HMAC 签名   |
| 加密数据接口 | `true`  | 需要手动解密请求体             |
| 文件上传     | `true`  | 需要原始请求体处理二进制数据   |
| 普通 CRUD    | `false` | 标准增删改查（默认）           |
| 批量操作     | `false` | 使用空 fields 即可保留所有字段 |

### 示例代码

#### 微信支付 V3 回调（需要验签和解密）

```typescript
// apis/webhook/wechatPayV3.ts
export default {
    name: "微信支付V3回调",
    method: "POST",
    auth: false,
    rawBody: true, // 跳过解析，保留原始请求
    handler: async (befly, ctx) => {
        // 1. 获取原始请求体（用于验签）
        const rawBody = await ctx.req.text();

        // 2. 获取微信签名头
        const signature = ctx.req.headers.get("Wechatpay-Signature");
        const timestamp = ctx.req.headers.get("Wechatpay-Timestamp");
        const nonce = ctx.req.headers.get("Wechatpay-Nonce");
        const serial = ctx.req.headers.get("Wechatpay-Serial");

        // 3. 验证签名
        const verifyMessage = `${timestamp}\n${nonce}\n${rawBody}\n`;
        if (!verifyRsaSign(verifyMessage, signature, serial)) {
            return { code: "FAIL", message: "签名验证失败" };
        }

        // 4. 解析并解密数据
        const notification = JSON.parse(rawBody);
        const { ciphertext, nonce: decryptNonce, associated_data } = notification.resource;
        const decrypted = decryptAesGcm(ciphertext, decryptNonce, associated_data);
        const payResult = JSON.parse(decrypted);

        // 5. 处理支付结果
        if (payResult.trade_state === "SUCCESS") {
            await befly.db.updData({
                table: "order",
                where: { orderNo: payResult.out_trade_no },
                data: {
                    payStatus: 1,
                    payTime: Date.now(),
                    transactionId: payResult.transaction_id
                }
            });
        }

        return { code: "SUCCESS", message: "" };
    }
};
```

#### GitHub Webhook（HMAC 签名验证）

```typescript
// apis/webhook/github.ts
import { createHmac } from "crypto";

export default {
    name: "GitHub Webhook",
    method: "POST",
    auth: false,
    rawBody: true,
    handler: async (befly, ctx) => {
        // 获取原始请求体
        const rawBody = await ctx.req.text();

        // 获取 GitHub 签名
        const signature = ctx.req.headers.get("X-Hub-Signature-256");
        if (!signature) {
            return befly.tool.No("缺少签名");
        }

        // 验证 HMAC 签名
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        const hmac = createHmac("sha256", secret);
        const expectedSignature = "sha256=" + hmac.update(rawBody).digest("hex");

        if (signature !== expectedSignature) {
            return befly.tool.No("签名验证失败");
        }

        // 解析数据
        const payload = JSON.parse(rawBody);
        const event = ctx.req.headers.get("X-GitHub-Event");

        // 处理不同事件
        if (event === "push") {
            befly.logger.info({ ref: payload.ref }, "GitHub Push 事件");
        }

        return befly.tool.Yes("处理成功");
    }
};
```

#### 加密数据接口

```typescript
// apis/secure/receive.ts
export default {
    name: "接收加密数据",
    auth: false,
    rawBody: true,
    handler: async (befly, ctx) => {
        // 获取加密的请求体
        const encryptedBody = await ctx.req.text();

        // 解密数据
        const decrypted = befly.cipher.decrypt(encryptedBody);
        const data = JSON.parse(decrypted);

        // 处理解密后的数据
        // ...

        return befly.tool.Yes("处理成功");
    }
};
```

### 批量操作的替代方案

对于批量导入等场景，**不需要使用 rawBody**，使用空 `fields` 即可保留所有字段：

```typescript
// apis/user/batchImport.ts
export default {
    name: "批量导入用户",
    // 不定义 fields，或 fields: {}，会保留所有请求参数
    handler: async (befly, ctx) => {
        const { users } = ctx.body; // 正常解析

        if (!Array.isArray(users) || users.length === 0) {
            return befly.tool.No("用户列表不能为空");
        }

        // 批量插入...
        return befly.tool.Yes("导入成功");
    }
};
```

### 注意事项

1. **请求体只能读取一次**：`ctx.req.text()` 或 `ctx.req.json()` 只能调用一次，第二次调用会返回空
2. **ctx.body 为空**：`rawBody: true` 时 `ctx.body = {}`，所有数据需要从 `ctx.req` 获取
3. **validator 钩子**：如果定义了 `required` 字段，validator 仍会检查 `ctx.body`（此时为空），建议 rawBody 接口不定义 required
4. **安全性**：手动处理请求时务必做好验签和数据验证
5. **Content-Type 无限制**：rawBody 模式不检查 Content-Type，支持任意格式

---

## 实际案例

### 案例一：公开接口（无需认证）

```typescript
// apis/auth/login.ts
import adminTable from "../../tables/admin.json";

export default {
    name: "管理员登录",
    auth: false, // 公开接口
    fields: {
        account: {
            name: "账号",
            type: "string",
            min: 3,
            max: 100
        },
        password: adminTable.password
    },
    required: ["account", "password"],
    handler: async (befly, ctx) => {
        // 查询用户
        const admin = await befly.db.getOne({
            table: "addon_admin_admin",
            where: {
                $or: [{ username: ctx.body.account }, { email: ctx.body.account }]
            }
        });

        if (!admin?.id) {
            return befly.tool.No("账号或密码错误");
        }

        // 验证密码
        const isValid = await befly.cipher.verifyPassword(ctx.body.password, admin.password);

        if (!isValid) {
            return befly.tool.No("账号或密码错误");
        }

        // 生成 Token
        const token = await befly.jwt.sign({
            id: admin.id,
            roleCode: admin.roleCode
        });

        return befly.tool.Yes("登录成功", {
            token: token,
            userInfo: admin
        });
    }
};
```

### 案例二：列表查询（需要认证）

```typescript
// apis/admin/list.ts
export default {
    name: "获取管理员列表",
    // auth: true,  // 默认需要认证
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "addon_admin_admin",
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 10,
            where: {
                roleCode: { $ne: "dev" }
            },
            orderBy: ["createdAt#DESC"]
        });

        return befly.tool.Yes("获取成功", result);
    }
};
```

### 案例三：新增数据

```typescript
// apis/admin/ins.ts
import adminTable from "../../tables/admin.json";

export default {
    name: "添加管理员",
    fields: adminTable,
    required: ["username", "password", "roleCode"],
    handler: async (befly, ctx) => {
        // 检查用户名是否已存在
        const existing = await befly.db.getOne({
            table: "addon_admin_admin",
            where: { username: ctx.body.username }
        });

        if (existing) {
            return befly.tool.No("用户名已被使用");
        }

        // 查询角色信息
        const role = await befly.db.getOne({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return befly.tool.No("角色不存在");
        }

        // 加密密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.password);

        // 创建管理员
        const adminId = await befly.db.insData({
            table: "addon_admin_admin",
            data: {
                username: ctx.body.username,
                password: hashedPassword,
                nickname: ctx.body.nickname,
                roleCode: role.code
            }
        });

        return befly.tool.Yes("添加成功", {
            id: adminId
        });
    }
};
```

### 案例四：更新数据

```typescript
// apis/admin/upd.ts
import adminTable from "../../tables/admin.json";

export default {
    name: "更新管理员",
    fields: adminTable,
    required: ["id"],
    handler: async (befly, ctx) => {
        const { id, ...updateData } = ctx.body;

        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: "addon_admin_admin",
            where: { id: id }
        });

        if (!admin?.id) {
            return befly.tool.No("管理员不存在");
        }

        // 更新管理员信息
        await befly.db.updData({
            table: "addon_admin_admin",
            data: updateData,
            where: { id: id }
        });

        return befly.tool.Yes("更新成功");
    }
};
```

### 案例五：删除数据

```typescript
// apis/admin/del.ts
export default {
    name: "删除管理员",
    fields: {},
    required: ["id"],
    handler: async (befly, ctx) => {
        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: "addon_admin_admin",
            where: { id: ctx.body.id }
        });

        if (!admin) {
            return befly.tool.No("管理员不存在");
        }

        // 业务检查：不能删除开发者账号
        if (admin.roleCode === "dev") {
            return befly.tool.No("不能删除开发者账号");
        }

        // 删除管理员
        await befly.db.delData({
            table: "addon_admin_admin",
            where: { id: ctx.body.id }
        });

        return befly.tool.Yes("删除成功");
    }
};
```

### 案例六：获取详情

```typescript
// apis/admin/detail.ts
export default {
    name: "获取用户信息",
    handler: async (befly, ctx) => {
        const userId = ctx.user?.id;

        if (!userId) {
            return befly.tool.No("未授权");
        }

        // 查询用户信息
        const admin = await befly.db.getOne({
            table: "addon_admin_admin",
            where: { id: userId }
        });

        if (!admin) {
            return befly.tool.No("用户不存在");
        }

        // 查询角色信息
        let roleInfo = null;
        if (admin.roleCode) {
            roleInfo = await befly.db.getOne({
                table: "addon_admin_role",
                where: { code: admin.roleCode }
            });
        }

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        return befly.tool.Yes("获取成功", {
            ...userWithoutPassword,
            role: roleInfo
        });
    }
};
```

### 案例七：支持 GET 和 POST

```typescript
// apis/article/search.ts
export default {
    name: "搜索文章",
    method: "GET,POST", // 同时支持 GET 和 POST
    auth: false,
    fields: {
        keyword: {
            name: "关键词",
            type: "string",
            min: 1,
            max: 100
        }
    },
    required: ["keyword"],
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "article",
            where: {
                title: { $like: `%${ctx.body.keyword}%` }
            }
        });

        return befly.tool.Yes("搜索成功", result);
    }
};
```

### 案例八：保留原始请求体（webhook）

```typescript
// apis/webhook/wechat.ts
export default {
    name: "微信回调",
    method: "POST",
    auth: false,
    rawBody: true, // 不过滤字段，保留完整请求体
    handler: async (befly, ctx) => {
        // ctx.body 包含完整的微信回调数据
        const { ToUserName, FromUserName, MsgType, Content } = ctx.body;

        // 处理微信消息
        befly.logger.info({ msg: Content }, "收到微信消息");

        return befly.tool.Yes("处理成功");
    }
};
```

---

## 请求处理流程

### Hook 执行顺序（洋葱模型）

```
请求进入
    ↓
┌─────────────────────────────────────────────┐
│ 1. cors (order: 2)                          │
│    - 设置 CORS 响应头                         │
│    - 处理 OPTIONS 预检请求                    │
├─────────────────────────────────────────────┤
│ 2. auth (order: 3)                          │
│    - 解析 Authorization Header               │
│    - 验证 JWT Token                          │
│    - 设置 ctx.user                          │
├─────────────────────────────────────────────┤
│ 3. parser (order: 4)                        │
│    - 解析 GET 查询参数                        │
│    - 解析 POST JSON/XML 请求体                │
│    - 根据 fields 过滤字段                     │
│    - 设置 ctx.body                          │
├─────────────────────────────────────────────┤
│ 4. validator (order: 6)                     │
│    - 验证 ctx.body 参数                      │
│    - 检查必填字段                             │
│    - 验证类型、长度、正则                      │
├─────────────────────────────────────────────┤
│ 5. permission (order: 6)                    │
│    - 检查 auth 配置                          │
│    - 验证用户登录状态                         │
│    - 检查角色权限                             │
├─────────────────────────────────────────────┤
│ 6. handler                                  │
│    - 执行 API 处理函数                        │
│    - 返回结果                                │
├─────────────────────────────────────────────┤
│ 7. FinalResponse                            │
│    - 格式化响应                              │
│    - 记录请求日志                             │
└─────────────────────────────────────────────┘
    ↓
响应返回
```

### 中断请求

在任何 Hook 中设置 `ctx.response` 可以中断请求处理：

```typescript
// 在 Hook 中中断
if (!ctx.user?.id) {
    ctx.response = ErrorResponse(ctx, "未登录");
    return; // 后续 Hook 和 handler 不会执行
}
```

---

## 路由加载机制

### 加载顺序

1. **项目 API**：`tpl/apis/**/*.ts` → `/api/...`
2. **Addon API**：`addonXxx/apis/**/*.ts` → `/api/addon/addonXxx/...`

### 路由映射规则

| 文件路径                        | 生成路由                                |
| ------------------------------- | --------------------------------------- |
| `tpl/apis/user/login.ts`        | `POST /api/user/login`                  |
| `tpl/apis/article/list.ts`      | `POST /api/article/list`                |
| `addonAdmin/apis/auth/login.ts` | `POST /api/addon/addonAdmin/auth/login` |
| `addonAdmin/apis/admin/list.ts` | `POST /api/addon/addonAdmin/admin/list` |

### 多方法注册

当 `method: 'GET,POST'` 时，会同时注册两个路由：

- `GET /api/user/search`
- `POST /api/user/search`

---

## BeflyContext 对象

handler 函数的第一个参数 `befly` 提供框架核心功能：

```typescript
interface BeflyContext {
    // 数据库操作
    db: DbHelper;

    // Redis 操作
    redis: RedisHelper;

    // 缓存操作
    cache: CacheHelper;

    // JWT 操作
    jwt: Jwt;

    // 加密操作
    cipher: Cipher;

    // 日志
    logger: Logger;

    // 工具函数
    tool: {
        Yes: (msg: string, data?: any, other?: object) => object;
        No: (msg: string, data?: any, other?: object) => object;
    };

    // 配置
    config: BeflyConfig;
}
```

### 常用工具方法

#### befly.db.cleanFields - 清理数据字段

清理对象中的 `null` 和 `undefined` 值，适用于处理可选参数：

```typescript
// 方法签名
befly.db.cleanFields<T>(
    data: T,                           // 要清理的数据对象
    excludeValues?: any[],             // 要排除的值，默认 [null, undefined]
    keepValues?: Record<string, any>   // 强制保留的键值对
): Partial<T>
```

**基本用法：**

```typescript
// 默认排除 null 和 undefined
const cleanData = befly.db.cleanFields({
    name: "John",
    age: null,
    email: undefined,
    phone: ""
});
// 结果: { name: 'John', phone: '' }
```

**自定义排除值：**

```typescript
// 同时排除 null、undefined 和空字符串
const cleanData = befly.db.cleanFields({ name: "John", phone: "", age: null }, [null, undefined, ""]);
// 结果: { name: 'John' }
```

**保留特定字段的特定值：**

```typescript
// 即使值在排除列表中，也保留 status 字段的 null 值
const cleanData = befly.db.cleanFields({ name: "John", status: null, count: 0 }, [null, undefined], { status: null });
// 结果: { name: 'John', status: null, count: 0 }
```

> **注意**：`insData`、`updData` 和 `where` 条件会自动调用 `cleanFields`，通常无需手动调用。

---

## 最佳实践

### 1. 字段引用优先级

```typescript
fields: {
    // 1. 首选：使用预定义字段（@id, @page, @limit, @keyword, @state）
    page: '@page',
    limit: '@limit',
    keyword: '@keyword',

    // 2. 次选：引用表字段
    email: adminTable.email,
    password: adminTable.password,

    // 3. 最后：自定义字段
    customField: {
        name: '自定义字段',
        type: 'string',
        min: 1,
        max: 100
    }
}
```

### 2. 直接使用 ctx.body

```typescript
// ✅ 推荐：直接使用
const result = await befly.db.insData({
    table: "user",
    data: {
        username: ctx.body.username,
        email: ctx.body.email
    }
});

// ❌ 避免：不必要的解构
const { username, email } = ctx.body;
```

### 3. 明确字段赋值

```typescript
// ✅ 推荐：明确每个字段
await befly.db.insData({
    table: "user",
    data: {
        username: ctx.body.username,
        email: ctx.body.email,
        password: hashedPassword
    }
});

// ❌ 避免：扩展运算符
await befly.db.insData({
    table: "user",
    data: { ...ctx.body } // 危险！可能写入未预期的字段
});
```

### 4. 错误处理

```typescript
handler: async (befly, ctx) => {
    try {
        // 业务逻辑
        const result = await someOperation();
        return befly.tool.Yes("成功", result);
    } catch (error: any) {
        // 记录错误日志
        befly.logger.error({ err: error }, "操作失败");
        // 返回友好错误信息
        return befly.tool.No("操作失败，请稍后重试");
    }
};
```

### 5. 时间字段使用 Date.now()

```typescript
// ✅ 推荐：使用 Date.now()
await befly.db.updData({
    table: "user",
    data: {
        lastLoginTime: Date.now(), // number 类型
        lastLoginIp: ctx.ip
    },
    where: { id: ctx.user.id }
});

// ❌ 避免：使用 new Date()
lastLoginTime: new Date(); // 类型不一致
```

---

## 常见问题

### Q1: 如何设置公开接口？

```typescript
export default {
    name: "公开接口",
    auth: false, // 设置为 false
    handler: async (befly, ctx) => {
        // ...
    }
};
```

### Q2: 如何获取当前用户？

```typescript
handler: async (befly, ctx) => {
    const userId = ctx.user?.id;
    const roleCode = ctx.user?.roleCode;

    if (!userId) {
        return befly.tool.No("未登录");
    }
};
```

### Q3: 如何处理文件上传？

文件上传需要使用 `rawBody: true` 保留原始请求体，然后手动解析。

### Q4: 如何添加自定义 Hook？

在 `tpl/hooks/` 目录创建 Hook 文件：

```typescript
// tpl/hooks/requestLog.ts
import type { Hook } from "befly/types/hook";

const hook: Hook = {
    order: 100, // 执行顺序
    handler: async (befly, ctx) => {
        befly.logger.info({ route: ctx.route }, "请求开始");
    }
};
export default hook;
```

### Q5: 为什么参数验证失败？

1. 检查字段是否在 `fields` 中定义
2. 检查必填字段是否在 `required` 中
3. 检查参数类型是否匹配
4. 检查参数值是否在 min/max 范围内

---

## 高级用法

### 事务处理

在需要保证数据一致性的场景中使用事务：

```typescript
// apis/order/create.ts
export default {
    name: "创建订单",
    fields: {
        productId: {
            name: "商品ID",
            type: "number",
            min: 1
        },
        quantity: {
            name: "数量",
            type: "number",
            min: 1,
            max: 999
        }
    },
    required: ["productId", "quantity"],
    handler: async (befly, ctx) => {
        // 使用事务确保库存扣减和订单创建的原子性
        const result = await befly.db.transaction(async (trx) => {
            // 1. 查询商品信息（带锁）
            const product = await trx.getOne({
                table: "product",
                where: { id: ctx.body.productId },
                forUpdate: true // 行锁
            });

            if (!product) {
                throw new Error("商品不存在");
            }

            if (product.stock < ctx.body.quantity) {
                throw new Error("库存不足");
            }

            // 2. 扣减库存
            await trx.updData({
                table: "product",
                data: {
                    stock: product.stock - ctx.body.quantity
                },
                where: { id: ctx.body.productId }
            });

            // 3. 创建订单
            const orderId = await trx.insData({
                table: "order",
                data: {
                    userId: ctx.user.id,
                    productId: ctx.body.productId,
                    quantity: ctx.body.quantity,
                    totalPrice: product.price * ctx.body.quantity,
                    status: "pending"
                }
            });

            // 4. 创建订单明细
            await trx.insData({
                table: "order_item",
                data: {
                    orderId: orderId,
                    productId: ctx.body.productId,
                    productName: product.name,
                    price: product.price,
                    quantity: ctx.body.quantity
                }
            });

            return { orderId: orderId };
        });

        return befly.tool.Yes("订单创建成功", result);
    }
};
```

### 批量操作

#### 批量插入

```typescript
// apis/user/batchImport.ts
export default {
    name: "批量导入用户",
    rawBody: true, // 保留原始请求体
    handler: async (befly, ctx) => {
        const users = ctx.body.users;

        if (!Array.isArray(users) || users.length === 0) {
            return befly.tool.No("用户列表不能为空");
        }

        if (users.length > 100) {
            return befly.tool.No("单次导入不能超过100条");
        }

        // 批量插入
        const result = await befly.db.batchInsert({
            table: "user",
            data: users.map((user: any) => ({
                username: user.username,
                email: user.email,
                nickname: user.nickname || user.username,
                state: 1
            }))
        });

        return befly.tool.Yes("导入成功", {
            total: users.length,
            inserted: result.affectedRows
        });
    }
};
```

#### 批量更新

```typescript
// apis/article/batchUpdate.ts
export default {
    name: "批量更新文章状态",
    rawBody: true,
    handler: async (befly, ctx) => {
        const { ids, state } = ctx.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return befly.tool.No("文章ID列表不能为空");
        }

        // 批量更新
        const result = await befly.db.updData({
            table: "article",
            data: { state: state },
            where: {
                id: { $in: ids }
            }
        });

        return befly.tool.Yes("更新成功", {
            updated: result.affectedRows
        });
    }
};
```

#### 批量删除

```typescript
// apis/log/batchDelete.ts
export default {
    name: "批量删除日志",
    rawBody: true,
    handler: async (befly, ctx) => {
        const { ids } = ctx.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return befly.tool.No("日志ID列表不能为空");
        }

        // 批量软删除
        const result = await befly.db.delData({
            table: "operate_log",
            where: {
                id: { $in: ids }
            }
        });

        return befly.tool.Yes("删除成功", {
            deleted: result.affectedRows
        });
    }
};
```

### 复杂查询

#### 多表关联查询

```typescript
// apis/order/detail.ts
export default {
    name: '订单详情',
    required: ['id'],
    handler: async (befly, ctx) => {
        // 查询订单基本信息
        const order = await befly.db.getOne({
            table: 'order',
            where: { id: ctx.body.id }
        });

        if (!order) {
            return befly.tool.No('订单不存在');
        }

        // 查询订单明细
        const itemsResult = await befly.db.getAll({
            table: 'order_item',
            where: { orderId: order.id }
        });

        // 查询用户信息
        const user = await befly.db.getOne({
            table: 'user',
            where: { id: order.userId }
        });

        return befly.tool.Yes('查询成功', {
            order: order,
            items: itemsResult.lists,  // 订单明细列表
            user: user
        });
            where: { id: order.userId },
            columns: ['id', 'username', 'nickname', 'phone']
        });

        return befly.tool.Yes('获取成功', {
            ...order,
            items: items,
            user: user
        });
    }
};
```

#### 使用 JOIN 查询

```typescript
// apis/article/listWithAuthor.ts
export default {
    name: "文章列表（含作者）",
    handler: async (befly, ctx) => {
        const result = await befly.db.getList({
            table: "article",
            joins: [
                {
                    type: "LEFT",
                    table: "user",
                    alias: "author",
                    on: { "article.authorId": "author.id" }
                }
            ],
            columns: ["article.id", "article.title", "article.createdAt", "author.nickname AS authorName"],
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 10,
            orderBy: ["article.createdAt#DESC"]
        });

        return befly.tool.Yes("获取成功", result);
    }
};
```

### 缓存策略

```typescript
// apis/config/getSiteConfig.ts
export default {
    name: "获取站点配置",
    auth: false,
    cache: 300, // 缓存 5 分钟
    handler: async (befly, ctx) => {
        // 先从缓存获取
        const cacheKey = "site:config";
        let config = await befly.redis.get(cacheKey);

        if (!config) {
            // 缓存不存在，从数据库查询
            const result = await befly.db.getAll({
                table: "sys_config",
                where: { state: 1 }
            });

            config = result.lists; // 获取配置列表

            // 写入缓存
            await befly.redis.set(cacheKey, JSON.stringify(config), "EX", 300);
        } else {
            config = JSON.parse(config);
        }

        return befly.tool.Yes("获取成功", config);
    }
};
```

### 分布式锁

```typescript
// apis/task/execute.ts
export default {
    name: "执行定时任务",
    handler: async (befly, ctx) => {
        const lockKey = `lock:task:${ctx.body.taskId}`;

        // 尝试获取锁（30秒超时）
        const locked = await befly.redis.set(lockKey, ctx.requestId, "EX", 30, "NX");

        if (!locked) {
            return befly.tool.No("任务正在执行中，请稍后");
        }

        try {
            // 执行任务逻辑
            await executeTask(ctx.body.taskId);

            return befly.tool.Yes("任务执行成功");
        } finally {
            // 释放锁
            await befly.redis.del(lockKey);
        }
    }
};
```

### 数据导出

```typescript
// apis/report/exportUsers.ts
export default {
    name: "导出用户数据",
    handler: async (befly, ctx) => {
        // 查询所有用户（不分页，注意上限 10000 条）
        const result = await befly.db.getAll({
            table: "user",
            columns: ["id", "username", "nickname", "email", "phone", "createdAt"],
            where: { state: 1 },
            orderBy: ["createdAt#DESC"]
        });

        // 转换为 CSV 格式
        const headers = ["ID", "用户名", "昵称", "邮箱", "手机", "注册时间"];
        const rows = result.lists.map((u: any) => [u.id, u.username, u.nickname, u.email, u.phone, new Date(u.createdAt).toLocaleString()]);

        const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

        // 返回 CSV 文件（注意：如果 total > 10000，只会导出前 10000 条）
        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="users.csv"'
            }
        });
    }
};
```

### 文件流处理

```typescript
// apis/file/download.ts
export default {
    name: "文件下载",
    required: ["fileId"],
    handler: async (befly, ctx) => {
        // 查询文件信息
        const file = await befly.db.getOne({
            table: "file",
            where: { id: ctx.body.fileId }
        });

        if (!file) {
            return befly.tool.No("文件不存在");
        }

        // 读取文件并返回流
        const fileStream = Bun.file(file.path);

        return new Response(fileStream, {
            headers: {
                "Content-Type": file.mimeType,
                "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
                "Content-Length": String(file.size)
            }
        });
    }
};
```
