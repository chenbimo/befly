# 插件开发指南

> 本文档详细介绍 Befly 框架的插件系统，包括插件结构、生命周期、内置插件及自定义插件开发。

## 目录

- [插件开发指南](#插件开发指南)
    - [目录](#目录)
    - [概述](#概述)
        - [核心特性](#核心特性)
        - [插件类型](#插件类型)
    - [插件结构](#插件结构)
        - [基础结构](#基础结构)
        - [完整类型定义](#完整类型定义)
    - [插件存放位置](#插件存放位置)
    - [插件命名规则](#插件命名规则)
    - [插件加载流程](#插件加载流程)
        - [加载顺序](#加载顺序)
        - [依赖排序](#依赖排序)
    - [内置插件](#内置插件)
        - [logger - 日志插件](#logger---日志插件)
        - [config - 配置插件](#config---配置插件)
        - [db - 数据库插件](#db---数据库插件)
        - [redis - Redis 插件](#redis---redis-插件)
        - [jwt - JWT 插件](#jwt---jwt-插件)
        - [cipher - 加密插件](#cipher---加密插件)
        - [cache - 缓存插件](#cache---缓存插件)
        - [tool - 工具插件](#tool---工具插件)
    - [自定义插件开发](#自定义插件开发)
        - [基础插件](#基础插件)
        - [带依赖的插件](#带依赖的插件)
        - [异步初始化插件](#异步初始化插件)
        - [带配置的插件](#带配置的插件)
        - [完整插件示例](#完整插件示例)
    - [插件访问方式](#插件访问方式)
    - [禁用插件](#禁用插件)
    - [Addon 插件](#addon-插件)
        - [Addon 插件示例](#addon-插件示例)
    - [最佳实践](#最佳实践)
    - [常见问题](#常见问题)

---

## 概述

Befly 插件系统是框架的核心扩展机制，允许开发者封装和复用功能模块。插件在应用启动时自动加载并初始化，其实例会挂载到 `befly` 全局对象上供 API 和其他插件使用。

### 核心特性

- **自动发现**：自动扫描指定目录加载插件
- **依赖管理**：支持声明插件依赖关系，按依赖顺序初始化
- **全局访问**：插件实例挂载到 `befly` 对象，API 中通过 `befly.插件名` 访问
- **生命周期**：支持异步初始化，可访问框架上下文
- **可禁用**：通过配置禁用指定插件

### 插件类型

| 类型       | 目录位置                        | 插件名格式                     |
| ---------- | ------------------------------- | ------------------------------ |
| 核心插件   | `packages/core/plugins/`        | `{fileName}`                   |
| Addon 插件 | `packages/addon{Name}/plugins/` | `addon_{addonName}_{fileName}` |
| 项目插件   | `项目根目录/plugins/`           | `app_{fileName}`               |

---

## 插件结构

### 基础结构

```typescript
import type { Plugin } from "befly/types/plugin";

const plugin: Plugin = {
    // 依赖的插件列表（可选）
    deps: ["logger", "db"],

    // 初始化函数（必填）
    handler: (befly) => {
        // 返回插件实例
        return {
            someMethod: () => {
                /* ... */
            }
        };
    }
};

export default plugin;
```

### 完整类型定义

```typescript
interface Plugin {
    /** 插件名称（运行时自动生成，无需手动设置） */
    name?: string;

    /** 依赖的插件列表（在这些插件之后执行） */
    deps: string[];

    /** 插件初始化函数 */
    handler: (context: BeflyContext) => any | Promise<any>;

    /** 插件描述（可选） */
    description?: string;

    /** 插件版本（可选） */
    version?: string;

    /** 插件作者（可选） */
    author?: string;
}
```

---

## 插件存放位置

| 类型       | 目录                            | 说明                      |
| ---------- | ------------------------------- | ------------------------- |
| 核心插件   | `packages/core/plugins/`        | 框架内置插件，随框架发布  |
| Addon 插件 | `packages/addon{Name}/plugins/` | 组件包插件，随 Addon 发布 |
| 项目插件   | `项目根目录/plugins/`           | 项目自定义插件            |

---

## 插件命名规则

插件名称由 **文件名** 自动生成（小驼峰转换），**禁止在插件对象中定义 `name` 属性**。

| 文件名         | 生成的插件名 | 访问方式         |
| -------------- | ------------ | ---------------- |
| `db.ts`        | `db`         | `befly.db`       |
| `redis.ts`     | `redis`      | `befly.redis`    |
| `myPlugin.ts`  | `myPlugin`   | `befly.myPlugin` |
| `my_plugin.ts` | `myPlugin`   | `befly.myPlugin` |

**Addon 插件命名规则**：

| Addon 名称   | 文件名      | 生成的插件名             |
| ------------ | ----------- | ------------------------ |
| `addonAdmin` | `email.ts`  | `addon_addonAdmin_email` |
| `addonPay`   | `wechat.ts` | `addon_addonPay_wechat`  |

**项目插件命名规则**：

| 文件名   | 生成的插件名 |
| -------- | ------------ |
| `sms.ts` | `app_sms`    |
| `oss.ts` | `app_oss`    |

---

## 插件加载流程

### 加载顺序

```
1. 核心插件（core/plugins/）
      ↓
2. Addon 插件（addon{Name}/plugins/）
      ↓
3. 项目插件（项目/plugins/）
      ↓
4. 过滤禁用的插件
      ↓
5. 按依赖关系排序
      ↓
6. 依次初始化并挂载到 befly
```

### 依赖排序

使用 `deps` 属性声明依赖关系：

```typescript
// redis.ts - 依赖 logger
const plugin: Plugin = {
    deps: ["logger"], // 在 logger 插件之后初始化
    handler: () => {
        /* ... */
    }
};
```

**依赖检查**：

- 如果依赖的插件不存在，启动时报错
- 如果存在循环依赖，启动时报错

---

## 内置插件

### logger - 日志插件

提供全局日志功能。

```typescript
// 插件源码
const loggerPlugin: Plugin = {
    deps: [],
    async handler(): Promise<typeof Logger> {
        if (beflyConfig.logger) {
            Logger.configure(beflyConfig.logger);
        }
        return Logger;
    }
};
```

**使用方式**：

```typescript
befly.logger.info("信息日志");
befly.logger.warn("警告日志");
befly.logger.error({ err: error }, "错误日志");
befly.logger.debug("调试日志");
```

---

### config - 配置插件

提供访问项目配置的能力。

```typescript
// 插件源码
const plugin: Plugin = {
    handler: () => {
        return beflyConfig;
    }
};
```

**使用方式**：

```typescript
const port = befly.config.appPort;
const dbConfig = befly.config.database;
const redisConfig = befly.config.redis;
```

---

### db - 数据库插件

提供数据库操作能力，依赖 `logger` 插件。

```typescript
// 插件源码
const dbPlugin: Plugin = {
    deps: ["logger", "redis"],
    async handler(befly: BeflyContext): Promise<DbHelper> {
        // 连接由启动期统一完成；插件仅消费已连接实例
        const sql = Connect.getSql();
        return new DbHelper({ redis: befly.redis, sql: sql, dialect: new MySqlDialect() });
    }
};
```

**使用方式**：

```typescript
// 查询
const user = await befly.db.getOne({ table: "user", where: { id: 1 } });

// 插入
const id = await befly.db.insData({ table: "user", data: { name: "张三" } });

// 更新
await befly.db.updData({ table: "user", data: { name: "李四" }, where: { id: 1 } });

// 删除
await befly.db.delData({ table: "user", where: { id: 1 } });
```

> 详细用法请参考 [database.md](./database.md)

---

### redis - Redis 插件

提供 Redis 缓存操作能力，依赖 `logger` 插件。

```typescript
// 插件源码
const redisPlugin: Plugin = {
    deps: ["logger"],
    async handler(): Promise<RedisHelper | Record<string, never>> {
        // 连接由启动期统一完成；插件仅校验连接存在
        Connect.getRedis();
        return new RedisHelper(redisConfig.prefix);
    }
};
```

**使用方式**：

```typescript
// 字符串操作
await befly.redis.setString("key", "value", 3600);
const value = await befly.redis.getString("key");

// 对象操作
await befly.redis.setObject("user:1", { name: "张三" });
const user = await befly.redis.getObject("user:1");

// 集合操作
await befly.redis.sadd("set:key", "member1", "member2");
const isMember = await befly.redis.sismember("set:key", "member1");
```

> 详细用法请参考 [redis.md](../infra/redis.md)

---

### jwt - JWT 插件

提供 JWT Token 签发和验证功能。

```typescript
// 插件源码
const jwtPlugin: Plugin = {
    handler: () => {
        return new Jwt(beflyConfig.auth);
    }
};
```

**使用方式**：

```typescript
// 签发 Token
const token = await befly.jwt.sign(
    {
        id: user.id,
        roleCode: user.roleCode
    },
    { expiresIn: "7d" }
);

// 验证 Token
const payload = await befly.jwt.verify(token);
```

---

### cipher - 加密插件

提供密码哈希、加密解密等功能。

```typescript
// 插件源码
const plugin: Plugin = {
    handler: () => {
        return Cipher;
    }
};
```

**使用方式**：

```typescript
// 密码哈希
const hashedPassword = await befly.cipher.hashPassword("123456");

// 密码验证
const isValid = await befly.cipher.verifyPassword("123456", hashedPassword);

// AES 加密
const encrypted = befly.cipher.encrypt("敏感数据");

// AES 解密
const decrypted = befly.cipher.decrypt(encrypted);
```

> 详细用法请参考 [cipher.md](./cipher.md)

---

### cache - 缓存插件

提供应用级缓存管理功能。

```typescript
// 插件源码
const cachePlugin: Plugin = {
    deps: ["logger", "redis", "db"],
    async handler(befly: BeflyContext): Promise<CacheHelper> {
        return new CacheHelper({ db: befly.db, redis: befly.redis });
    }
};
```

**使用方式**：

```typescript
// 刷新角色权限缓存
await befly.cache.refreshRoleApis("admin");

// 获取菜单缓存
const menus = await befly.cache.getMenus();

// 刷新所有缓存
await befly.cache.refreshAll();
```

---

### tool - 工具插件

提供 API 响应辅助函数。

```typescript
// 插件源码
const plugin: Plugin = {
    handler: () => {
        return {
            Yes: Yes,
            No: No
        };
    }
};
```

**使用方式**：

```typescript
// 成功响应
return befly.tool.Yes("操作成功", { id: 1 });
// 返回: { code: 0, msg: '操作成功', data: { id: 1 } }

// 失败响应
return befly.tool.No("操作失败");
// 返回: { code: 1, msg: '操作失败', data: null }
```

---

## 自定义插件开发

### 基础插件

```typescript
// plugins/hello.ts
import type { Plugin } from "befly/types/plugin";

const plugin: Plugin = {
    handler: () => {
        return {
            sayHello: (name: string) => `Hello, ${name}!`
        };
    }
};

export default plugin;
```

**使用**：

```typescript
// 项目插件名为 app_hello
const greeting = befly.app_hello.sayHello("World");
// 返回: "Hello, World!"
```

---

### 带依赖的插件

```typescript
// plugins/userService.ts
import type { Plugin } from "befly/types/plugin";
import type { BeflyContext } from "befly/types/befly";

const plugin: Plugin = {
    deps: ["db", "redis"], // 依赖数据库和 Redis
    handler: (befly: BeflyContext) => {
        return {
            async getUser(id: number) {
                // 先从缓存获取
                const cacheKey = `user:${id}`;
                let user = await befly.redis.getObject(cacheKey);

                if (!user) {
                    // 缓存不存在，从数据库查询
                    user = await befly.db.getOne({
                        table: "user",
                        where: { id: id }
                    });

                    // 写入缓存
                    if (user) {
                        await befly.redis.setObject(cacheKey, user, 3600);
                    }
                }

                return user;
            }
        };
    }
};

export default plugin;
```

---

### 异步初始化插件

```typescript
// plugins/elastic.ts
import type { Plugin } from "befly/types/plugin";
import { Client } from "@elastic/elasticsearch";

const plugin: Plugin = {
    deps: ["logger", "config"],
    async handler(befly) {
        const config = befly.config.elasticsearch || {};

        const client = new Client({
            node: config.node || "http://localhost:9200",
            auth: config.auth
        });

        // 测试连接
        try {
            await client.ping();
            befly.logger.info("Elasticsearch 连接成功");
        } catch (error) {
            befly.logger.error({ err: error }, "Elasticsearch 连接失败");
            throw error;
        }

        return {
            client: client,
            async search(index: string, query: object) {
                return client.search({ index: index, body: query });
            },
            async index(index: string, document: object) {
                return client.index({ index: index, body: document });
            }
        };
    }
};

export default plugin;
```

---

### 带配置的插件

```typescript
// plugins/sms.ts
import type { Plugin } from "befly/types/plugin";
import type { BeflyContext } from "befly/types/befly";

interface SmsConfig {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
}

class SmsHelper {
    private config: SmsConfig;
    private befly: BeflyContext;

    constructor(befly: BeflyContext, config: SmsConfig) {
        this.befly = befly;
        this.config = config;
    }

    async send(phone: string, params: Record<string, string>) {
        // 实现短信发送逻辑
        this.befly.logger.info({ phone: phone }, "发送短信");
        // ...
        return { success: true };
    }
}

const plugin: Plugin = {
    deps: ["logger", "config"],
    handler: (befly: BeflyContext) => {
        const smsConfig = befly.config.sms || {};
        return new SmsHelper(befly, smsConfig);
    }
};

export default plugin;
```

---

### 完整插件示例

以 Addon 邮件插件为例：

```typescript
// addonAdmin/plugins/email.ts
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Plugin } from "befly/types/plugin";
import type { BeflyContext } from "befly/types/befly";

/** 邮件配置 */
interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName?: string;
}

/** 发送邮件参数 */
interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

/** 发送结果 */
interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * 邮件助手类
 */
class EmailHelper {
    private config: EmailConfig;
    private transporter: Transporter | null = null;
    private befly: BeflyContext;

    constructor(befly: BeflyContext, config: EmailConfig) {
        this.befly = befly;
        this.config = config;

        if (this.config.user && this.config.pass) {
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: {
                    user: this.config.user,
                    pass: this.config.pass
                }
            });
        }
    }

    async send(options: SendEmailOptions): Promise<SendEmailResult> {
        if (!this.transporter) {
            return { success: false, error: "邮件服务未配置" };
        }

        try {
            const info = await this.transporter.sendMail({
                from: `"${this.config.fromName}" <${this.config.user}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            });

            return { success: true, messageId: info.messageId };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async verify(): Promise<boolean> {
        if (!this.transporter) return false;
        try {
            await this.transporter.verify();
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * 邮件插件
 */
const emailPlugin: Plugin = {
    deps: ["db", "logger", "config"],
    async handler(befly: BeflyContext): Promise<EmailHelper> {
        const emailConfig = befly.config?.addons?.admin?.email || {};
        return new EmailHelper(befly, emailConfig);
    }
};

export default emailPlugin;
```

**使用方式**：

```typescript
// Addon 插件名为 addon_addonAdmin_email
const result = await befly.addon_addonAdmin_email.send({
    to: "user@example.com",
    subject: "验证码",
    html: "<p>您的验证码是：123456</p>"
});

if (result.success) {
    return befly.tool.Yes("邮件发送成功");
} else {
    return befly.tool.No(result.error || "邮件发送失败");
}
```

---

## 插件访问方式

插件初始化后会挂载到 `befly` 全局对象：

```typescript
// 在 API handler 中
export default {
    name: "示例接口",
    handler: async (befly, ctx) => {
        // 访问内置插件
        const user = await befly.db.getOne({ table: "user", where: { id: 1 } });
        befly.logger.info({ user: user }, "查询用户");

        // 访问项目插件
        const result = await befly.app_sms.send("13800138000", { code: "123456" });

        // 访问 Addon 插件
        await befly.addon_addonAdmin_email.send({
            to: "admin@example.com",
            subject: "通知"
        });

        return befly.tool.Yes("成功");
    }
};
```

---

## 禁用插件

在配置文件中设置 `disablePlugins` 数组：

```json
// befly.development.json
{
    "disablePlugins": ["redis", "app_sms"]
}
```

被禁用的插件不会被加载和初始化。

---

## Addon 插件

Addon 插件是组件包中的扩展功能，用于为 Addon 提供特定的服务能力。

### Addon 插件示例

```typescript
// packages/addonPay/plugins/wechat.ts
import type { Plugin } from "befly/types/plugin";
import type { BeflyContext } from "befly/types/befly";

class WechatPayHelper {
    private befly: BeflyContext;
    private config: any;

    constructor(befly: BeflyContext) {
        this.befly = befly;
        this.config = befly.config?.addons?.pay?.wechat || {};
    }

    async createOrder(params: { orderId: string; amount: number; description: string }) {
        // 调用微信支付 API 创建订单
        // ...
        return { prepayId: "xxx", nonceStr: "xxx" };
    }

    async queryOrder(orderId: string) {
        // 查询订单状态
        // ...
        return { status: "SUCCESS" };
    }

    async refund(orderId: string, amount: number) {
        // 申请退款
        // ...
        return { refundId: "xxx" };
    }
}

const plugin: Plugin = {
    deps: ["logger", "config"],
    handler: (befly: BeflyContext) => {
        return new WechatPayHelper(befly);
    }
};

export default plugin;
```

**使用方式**：

```typescript
// 插件名：addon_addonPay_wechat
const order = await befly.addon_addonPay_wechat.createOrder({
    orderId: "202312010001",
    amount: 100,
    description: "商品购买"
});
```

---

## 最佳实践

### 1. 使用 TypeScript 类封装

```typescript
// ✅ 推荐：使用 class 封装
class MyHelper {
    private befly: BeflyContext;

    constructor(befly: BeflyContext) {
        this.befly = befly;
    }

    async doSomething() {
        /* ... */
    }
}

const plugin: Plugin = {
    handler: (befly) => new MyHelper(befly)
};
```

### 2. 正确声明依赖

```typescript
// ✅ 推荐：明确声明所有依赖
const plugin: Plugin = {
    deps: ["logger", "db", "redis"], // 声明所有使用的插件
    handler: (befly) => {
        /* ... */
    }
};

// ❌ 避免：使用未声明的依赖
const plugin: Plugin = {
    handler: (befly) => {
        befly.db.getOne({
            /* ... */
        }); // 可能 db 还未初始化！
    }
};
```

### 3. 错误处理

```typescript
// ✅ 推荐：初始化时处理错误
const plugin: Plugin = {
    async handler(befly) {
        try {
            const client = await connectToService();
            return client;
        } catch (error) {
            befly.logger.error({ err: error }, "服务连接失败");
            throw error; // 抛出错误会终止应用启动
        }
    }
};
```

### 4. 配置验证

```typescript
// ✅ 推荐：验证必要配置
const plugin: Plugin = {
    handler: (befly) => {
        const config = befly.config.myService;

        if (!config?.apiKey) {
            throw new Error("myService.apiKey 配置缺失");
        }

        return new MyService(config);
    }
};
```

### 5. 资源清理

```typescript
// ✅ 推荐：提供清理方法
class DatabasePool {
    private pool: any;

    async connect() {
        /* ... */
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}
```

---

## 常见问题

### Q1: 插件加载顺序如何确定？

插件按以下顺序加载：

1. 核心插件 → Addon 插件 → 项目插件
2. 同一类型内根据 `deps` 依赖关系排序
3. 无依赖的插件按文件名字母顺序

### Q2: 如何在插件中访问其他插件？

通过 `befly` 上下文访问：

```typescript
const plugin: Plugin = {
    deps: ["db"], // 声明依赖
    handler: (befly) => {
        return {
            async getUser(id: number) {
                return befly.db.getOne({ table: "user", where: { id: id } });
            }
        };
    }
};
```

### Q3: 插件初始化失败会怎样？

插件初始化失败（抛出错误）会导致应用启动终止，并输出错误日志。

### Q4: 可以动态加载插件吗？

目前不支持运行时动态加载插件，所有插件在应用启动时加载。

### Q5: 如何测试插件？

```typescript
// tests/myPlugin.test.ts
import { describe, test, expect } from "bun:test";

describe("MyPlugin", () => {
    test("应该正确初始化", async () => {
        const mockBefly = {
            config: { myService: { apiKey: "test" } },
            logger: { info: () => {}, error: () => {} }
        };

        const plugin = (await import("../plugins/myPlugin.ts")).default;
        const instance = await plugin.handler(mockBefly);

        expect(instance).toBeDefined();
        expect(typeof instance.doSomething).toBe("function");
    });
});
```
