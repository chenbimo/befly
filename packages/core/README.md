# Befly - 野蜂飞舞

![野蜂飞舞](https://static.yicode.tech/befly.svg)

> 道生一，一生二，二生三，三生万物

**Befly 3.0 - TypeScript 重构版本已发布！**

## 🎯 简介

Befly 是专为 Bun 运行时设计的现代化 API 框架，提供：

- ⚡ **原生 TypeScript 支持** - 完整的类型定义和智能提示
- 🚀 **高性能** - 基于 Bun 运行时，超快的启动和执行速度
- 🔌 **插件化架构** - 灵活的插件系统，轻松扩展功能
- 🗄️ **多数据库支持** - MySQL、PostgreSQL、SQLite 统一接口
- 📝 **自动化表管理** - 基于 JSON 的表定义，自动同步数据库结构
- 🔐 **内置身份验证** - JWT 认证，角色权限管理
- 📊 **完整日志系统** - 结构化日志，敏感字段过滤

## 📦 快速开始

### 安装

```bash
# 创建新项目
mkdir my-api && cd my-api
如果你在自定义脚本/测试中需要“脱离框架启动流程”去连接数据库/Redis：

- 推荐直接使用你选用的 DB/Redis 客户端在脚本中自行建立连接（因为 Befly 的连接管理属于框架内部实现，不作为默认入口的 public API 导出）。
- 或者在脚本里通过 `new Befly().start()` 走完整启动流程（会执行启动检查、加载插件与同步逻辑）。
    }
} as ApiRoute;
```

访问：`http://localhost:3000/api/user/hello`

## 🔥 新版本特性（3.0）

### TypeScript 全面支持

```typescript
import type { ApiRoute } from "befly/types/api";
import type { BeflyContext } from "befly/types/befly";
import type { User } from "./types/models";

export default {
    name: "获取用户",
    auth: true,
    fields: {
        id: "用户ID|number|1|999999|null|1|null"
    },
    如果你在自定义脚本/测试中需要“脱离框架启动流程”去连接数据库/Redis：

    - 推荐直接使用你选用的 DB/Redis 客户端在脚本中自行建立连接（Befly 的连接管理属于内部实现，不作为默认入口的 public API 导出）。
    - 或者在脚本里通过 `new Befly().start()` 走完整启动流程（会执行启动检查、加载插件与同步逻辑）。
    table: "product",
    where: { category: "electronics" },
    page: 1,
    limit: 10,
    orderBy: ["createdAt#DESC"]
});

// 插入数据
await befly.db.insData({
    table: "user",
    data: {
        username: "john",
        email: "john@example.com"
    }
});

// 更新数据
await befly.db.updData({
    table: "user",
    where: { id: 1 },
    data: {
        nickname: "John Doe"
    }
});

// 删除数据
await befly.db.delData({
    table: "user",
    where: { id: 1 }
});
```

### 智能表定义

```json
{
    "username": "用户名|string|3|50|null|1|^[a-zA-Z0-9_]+$",
    "email": "邮箱|string|5|100|null|1|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    "age": "年龄|number|0|150|18|0|null",
    "tags": "标签|array_string|0|10|null|0|null",
    "bio": "简介|text|0|5000|null|0|null"
}
```

字段定义格式：`"字段名|类型|最小值|最大值|默认值|是否索引|正则约束"`

同步到数据库：

请参考：`docs/reference/sync.md`（`syncTable` / `syncData` 等同步流程说明）。

## 🗄️ 数据库配置

统一使用环境变量配置，支持三种数据库：

```bash
# MySQL
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=my_database

# PostgreSQL
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=my_database

# SQLite
DB_TYPE=sqlite
DB_NAME=/path/to/database.sqlite
# 或使用内存数据库
DB_NAME=:memory:
```

## ⚙️ 项目配置文件

Befly 使用 `befly.config.ts` 作为统一配置文件：

```typescript
// befly.config.ts
export const beflyConfig = {
    appName: "我的应用",
    appPort: 3000,
    appHost: "0.0.0.0",

    // 数据库配置（优先使用环境变量）
    db: {
        type: "mysql",
        host: "127.0.0.1",
        port: 3306,
        username: "root",
        password: "password",
        database: "my_database"
    },

    // Redis 配置
    redis: {
        host: "127.0.0.1",
        port: 6379,
        prefix: "befly"
    },

    // CORS 跨域配置
    cors: {
        origin: ["http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE"]
    },

    // Addon 插件配置
    addons: {
        admin: {
            email: { host: "smtp.qq.com" }
        }
    }
};
```

> 注意：`redis.prefix` 不要包含 `:`（系统会自动拼接分隔符）。

### 数据库连接

通常你不需要手动连接（框架启动期会完成连接并注入插件实例）。

如果你在自定义脚本/测试中需要“脱离框架启动流程”去连接数据库/Redis：

- 推荐直接使用你选用的 DB/Redis 客户端在脚本中自行建立连接（Befly 的连接管理属于内部实现，不作为默认入口的 public API 导出）。
- 或者在脚本里通过 `new Befly().start()` 走完整启动流程（会执行启动检查、加载插件与同步逻辑）。

### 配置文件（当前约定）

配置文件名为 `befly.config.ts`，导出名为 `beflyConfig`：

```typescript
export const beflyConfig = {
    // ...
};
```

## 📖 文档

完整文档请访问 [`/docs` 目录](./docs/)：

- [快速开始](./docs/02-快速上手/01-10分钟体验.md)
- [核心概念](./docs/03-核心概念/)
- [API 开发](./docs/04-API开发/)
- [数据库操作](./docs/05-数据库/)
- [TypeScript 支持](./docs/10-TypeScript/01-TypeScript支持.md)

### 目录说明

- **`packages/core`** - Befly 核心框架包（发布到 npm）
- **`packages/tpl`** - API 项目模板示例
- **`packages/admin`** - 后台管理系统（Vue3 + TDesign Vue Next + 自动导入）

## 🚀 快速启动

### 启动 API 服务

```bash
bun run dev
# 访问: http://localhost:3000
```

### 启动后台管理

```bash
bun run dev:admin
# 访问: http://localhost:5173
```

## 🎓 示例项目

查看 `/tpl` 目录获取完整的示例项目。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License

## 🌟 致谢

感谢所有为 Befly 做出贡献的开发者！

---

**Befly 3.0 - 让 API 开发更简单、更高效！** 🚀
