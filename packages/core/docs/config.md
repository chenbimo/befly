# 配置系统指南

> 本文档详细介绍 Befly 框架的配置系统，包括配置文件结构、加载优先级、配置项说明及最佳实践。

## 目录

- [配置系统指南](#配置系统指南)
    - [目录](#目录)
    - [概述](#概述)
        - [核心特性](#核心特性)
    - [配置文件结构](#配置文件结构)
        - [文件位置](#文件位置)
        - [加载优先级](#加载优先级)
        - [合并规则](#合并规则)
    - [配置项说明](#配置项说明)
        - [核心参数](#核心参数)
        - [日志配置 (logger)](#日志配置-logger)
        - [数据库配置 (db)](#数据库配置-db)
        - [Redis 配置 (redis)](#redis-配置-redis)
        - [认证配置 (auth)](#认证配置-auth)
        - [CORS 配置 (cors)](#cors-配置-cors)
        - [禁用配置](#禁用配置)
        - [Addon 配置 (addons)](#addon-配置-addons)
    - [环境变量](#环境变量)
    - [完整配置示例](#完整配置示例)
        - [befly.common.json](#beflycmmonjson)
        - [befly.development.json](#beflydevelopmentjson)
        - [befly.production.json](#beflyproductionjson)
    - [访问配置](#访问配置)
    - [最佳实践](#最佳实践)
    - [常见问题](#常见问题)

---

## 概述

Befly 配置系统采用分层配置设计，支持环境分离和本地覆盖，所有配置文件使用 JSON 格式。

### 核心特性

- **分层配置**：支持通用配置 + 环境配置 + 本地配置
- **环境分离**：自动根据 NODE_ENV 加载对应环境配置
- **深度合并**：配置项支持深度合并，后加载的覆盖先加载的
- **默认值**：所有配置项都有合理的默认值
- **类型安全**：完整的 TypeScript 类型定义

---

## 配置文件结构

### 文件位置

配置文件存放在项目根目录的 `configs/` 目录下：

```
// befly.development.json
└── configs/
    ├── befly.common.json   # 通用配置（所有环境共享）
    ├── befly.development.json  # 开发环境配置
    └── befly.production.json   # 生产环境配置
```

### 加载优先级

// befly.production.json
配置按以下顺序加载，后加载的覆盖先加载的：

```
默认配置（代码内置）
    ↓
befly.common.json（通用配置）
    ↓
befly.development.json 或 befly.production.json（环境配置）
```

**环境判断**：

- `NODE_ENV=production` → 加载 `befly.production.json`
- 其他情况 → 加载 `befly.development.json`

### 合并规则

配置采用深度合并策略：

```json
// befly.common.json
{
    "db": {
        "host": "127.0.0.1",
        "port": 3306,
        "database": "befly"
    }
}

// befly.development.json
{
    "db": {
        "password": "local_password"
    }
}

// 最终配置
{
    "db": {
        "host": "127.0.0.1",      // 来自 common
        "port": 3306,              // 来自 common
        "database": "befly",       // 来自 common
        "password": "local_password"  // 来自 local（覆盖默认值）
    }
}
```

---

## 配置项说明

### 核心参数

| 配置项        | 类型   | 默认值            | 说明                        |
| ------------- | ------ | ----------------- | --------------------------- |
| `nodeEnv`     | string | `'development'`   | 运行环境                    |
| `appName`     | string | `'野蜂飞舞'`      | 应用名称                    |
| `appPort`     | number | `3000`            | 应用端口                    |
| `appHost`     | string | `'127.0.0.1'`     | 应用主机                    |
| `devEmail`    | string | `'dev@qq.com'`    | 开发者邮箱（syncDev 使用）  |
| `devPassword` | string | -                 | 开发者密码（syncDev 使用）  |
| `bodyLimit`   | number | `1048576`         | 请求体大小限制（字节，1MB） |
| `tz`          | string | `'Asia/Shanghai'` | 时区                        |

```json
{
    "appName": "我的应用",
    "appPort": 8080,
    "appHost": "0.0.0.0",
    "bodyLimit": 5242880
}
```

---

### 日志配置 (logger)

| 配置项          | 类型   | 默认值                    | 说明                                 |
| --------------- | ------ | ------------------------- | ------------------------------------ |
| `debug`         | number | `1`                       | 是否开启调试模式（0: 关闭, 1: 开启） |
| `excludeFields` | string | `'password,token,secret'` | 日志中排除的敏感字段                 |
| `dir`           | string | `'./logs'`                | 日志文件目录                         |
| `console`       | number | `1`                       | 是否输出到控制台（0: 关闭, 1: 开启） |
| `maxSize`       | number | `10485760`                | 单个日志文件最大大小（字节，10MB）   |

```json
{
    "logger": {
        "debug": 0,
        "excludeFields": "password,token,secret,apiKey",
        "dir": "/var/log/befly",
        "console": 0,
        "maxSize": 52428800
    }
}
```

---

### 数据库配置 (db)

| 配置项     | 类型   | 默认值         | 说明                                |
| ---------- | ------ | -------------- | ----------------------------------- |
| `type`     | string | `'mysql'`      | 数据库类型（mysql/postgres/sqlite） |
| `host`     | string | `'127.0.0.1'`  | 数据库主机                          |
| `port`     | number | `3306`         | 数据库端口                          |
| `username` | string | `'root'`       | 数据库用户名                        |
| `password` | string | `'root'`       | 数据库密码                          |
| `database` | string | `'befly_demo'` | 数据库名称                          |
| `poolMax`  | number | `10`           | 连接池最大连接数                    |

```json
{
    "db": {
        "type": "mysql",
        "host": "localhost",
        "port": 3306,
        "username": "befly",
        "password": "your_password",
        "database": "befly_prod",
        "poolMax": 20
    }
}
```

**PostgreSQL 配置**：

```json
{
    "db": {
        "type": "postgres",
        "host": "localhost",
        "port": 5432,
        "username": "postgres",
        "password": "your_password",
        "database": "befly_prod"
    }
}
```

---

### Redis 配置 (redis)

| 配置项     | 类型   | 默认值          | 说明             |
| ---------- | ------ | --------------- | ---------------- |
| `host`     | string | `'127.0.0.1'`   | Redis 主机       |
| `port`     | number | `6379`          | Redis 端口       |
| `username` | string | `''`            | Redis 用户名     |
| `password` | string | `''`            | Redis 密码       |
| `db`       | number | `0`             | Redis 数据库索引 |
| `prefix`   | string | `'befly_demo:'` | Redis Key 前缀   |

```json
{
    "redis": {
        "host": "localhost",
        "port": 6379,
        "password": "redis_password",
        "db": 1,
        "prefix": "myapp:"
    }
}
```

---

### 认证配置 (auth)

| 配置项      | 类型          | 默认值           | 说明           |
| ----------- | ------------- | ---------------- | -------------- |
| `secret`    | string        | `'befly-secret'` | JWT 密钥       |
| `expiresIn` | string/number | `'7d'`           | Token 过期时间 |
| `algorithm` | string        | `'HS256'`        | 签名算法       |

```json
{
    "auth": {
        "secret": "your-super-secret-key-at-least-32-chars",
        "expiresIn": "30d",
        "algorithm": "HS256"
    }
}
```

**过期时间格式**：

- 字符串：`'7d'`（7天）、`'24h'`（24小时）、`'60m'`（60分钟）
- 数字：秒数，如 `604800`（7天）

---

### CORS 配置 (cors)

| 配置项           | 类型   | 默认值                             | 说明                   |
| ---------------- | ------ | ---------------------------------- | ---------------------- |
| `origin`         | string | `'*'`                              | 允许的来源             |
| `methods`        | string | `'GET,HEAD,PUT,PATCH,POST,DELETE'` | 允许的方法             |
| `allowedHeaders` | string | `'Content-Type,Authorization'`     | 允许的请求头           |
| `exposedHeaders` | string | `''`                               | 暴露的响应头           |
| `maxAge`         | number | `86400`                            | 预检请求缓存时间（秒） |
| `credentials`    | string | `'true'`                           | 是否允许凭证           |

```json
{
    "cors": {
        "origin": "https://example.com",
        "methods": "GET,POST",
        "allowedHeaders": "Content-Type,Authorization,X-Custom-Header",
        "credentials": "true"
    }
}
```

**多域名配置**：

```json
{
    "cors": {
        "origin": "https://app.example.com,https://admin.example.com"
    }
}
```

---

### 禁用配置

| 配置项           | 类型     | 默认值 | 说明           |
| ---------------- | -------- | ------ | -------------- |
| `disableHooks`   | string[] | `[]`   | 禁用的钩子列表 |
| `disablePlugins` | string[] | `[]`   | 禁用的插件列表 |
| `hiddenMenus`    | string[] | `[]`   | 隐藏的菜单路径 |

```json
{
    "disableHooks": ["requestLogger"],
    "disablePlugins": ["redis"],
    "hiddenMenus": ["/admin/debug", "/admin/test"]
}
```

---

### Addon 配置 (addons)

Addon 运行时配置按 Addon 名称分组：

```json
{
    "addons": {
        "admin": {
            "email": {
                "host": "smtp.qq.com",
                "port": 465,
                "secure": true,
                "user": "your-email@qq.com",
                "pass": "your-auth-code",
                "fromName": "系统通知"
            }
        },
        "pay": {
            "wechat": {
                "appId": "wx1234567890",
                "mchId": "1234567890",
                "apiKey": "your-api-key"
            }
        }
    }
}
```

**在插件中访问**：

```typescript
const emailConfig = befly.config?.addons?.admin?.email || {};
const wechatConfig = befly.config?.addons?.pay?.wechat || {};
```

---

## 环境变量

支持通过环境变量覆盖部分配置：

| 环境变量   | 对应配置  | 说明     |
| ---------- | --------- | -------- |
| `NODE_ENV` | `nodeEnv` | 运行环境 |

```bash
# 启动生产环境
NODE_ENV=production bun run start
```

---

## 完整配置示例

### befly.common.json

所有环境共享的配置：

```json
{
    "appName": "我的应用",
    "bodyLimit": 5242880,
    "tz": "Asia/Shanghai",

    "logger": {
        "excludeFields": "password,token,secret,apiKey"
    },

    "db": {
        "type": "mysql",
        "database": "myapp"
    },

    "redis": {
        "prefix": "myapp:"
    },

    "cors": {
        "allowedHeaders": "Content-Type,Authorization,X-Request-ID"
    }
}
```

### befly.development.json

开发环境配置：

```json
{
    "appPort": 3000,

    "logger": {
        "debug": 1,
        "console": 1
    },

    "db": {
        "host": "localhost",
        "username": "root",
        "password": "root"
    },

    "redis": {
        "host": "localhost"
    }
}
```

### befly.production.json

生产环境配置：

```json
{
    "appPort": 8080,
    "appHost": "0.0.0.0",

    "logger": {
        "debug": 0,
        "console": 0,
        "dir": "/var/log/myapp"
    },

    "auth": {
        "expiresIn": "7d"
    },

    "cors": {
        "origin": "https://myapp.com"
    }
}
```

## 访问配置

### 在 API 中访问

```typescript
export default {
    name: "示例接口",
    handler: async (befly, ctx) => {
        // 通过 befly.config 访问配置
        const appName = befly.config.appName;
        const dbType = befly.config.db?.type;
        const jwtSecret = befly.config.auth?.secret;

        // 访问 Addon 配置
        const emailConfig = befly.config.addons?.admin?.email;

        return befly.tool.Yes("成功", { appName: appName });
    }
};
```

### 在插件中访问

```typescript
import { beflyConfig } from "../befly.config.js";

const plugin: Plugin = {
    handler: () => {
        const port = beflyConfig.appPort;
        const dbConfig = beflyConfig.db;
        // ...
    }
};
```

### 直接导入

```typescript
import { beflyConfig } from "befly/befly.config";

console.log(beflyConfig.appName);
```

---

## 最佳实践

### 1. 敏感信息使用环境变量

不建议在 `configs/*.json` 中保存明文密码/密钥（这些文件通常会被提交）。

推荐做法：通过环境变量注入敏感信息（本地用 `.env`，部署用平台的 Secret/环境变量管理）。

### 2. 环境差异放环境配置

```json
// befly.development.json
{
    "logger": { "debug": 1, "console": 1 }
}

// befly.production.json
{
    "logger": { "debug": 0, "console": 0 }
}
```

### 3. 使用合理的默认值

框架已提供合理的默认值，只需覆盖需要修改的配置项。

### 4. JWT 密钥长度

```json
// ✅ 推荐：至少 32 字符
{
    "auth": {
        "secret": "your-super-secret-key-at-least-32-chars-long"
    }
}

// ❌ 避免：过短的密钥
{
    "auth": {
        "secret": "123456"
    }
}
```

### 5. 生产环境关闭调试

```json
// befly.production.json
{
    "logger": {
        "debug": 0,
        "console": 0
    }
}
```

---

## 常见问题

### Q1: 配置文件不生效？

1. 检查文件位置是否正确（`configs/` 目录）
2. 检查 JSON 格式是否正确
3. 检查配置项名称是否正确（区分大小写）
4. 重启应用使配置生效

### Q2: 如何查看最终配置？

```typescript
// 在 API 中打印
befly.logger.info({ config: befly.config }, "当前配置");
```

### Q3: local 配置被提交了？

不再使用“本地覆盖配置文件”。

如果你发现敏感配置被提交：请改为环境变量注入，并在仓库层面避免提交 `.env`、密钥文件等。

### Q4: 如何动态修改配置？

配置在应用启动时加载，不支持运行时动态修改。如需动态配置，建议使用数据库或 Redis 存储。

### Q5: 数组配置如何合并？

数组配置是覆盖而非合并：

```json
// befly.common.json
{ "disableHooks": ["hook1"] }

// befly.production.json
{ "disableHooks": ["hook2"] }

// 最终结果
{ "disableHooks": ["hook2"] }  // 覆盖，不是合并
```
