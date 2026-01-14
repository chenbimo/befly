# Befly - 野蜂飞舞

![野蜂飞舞](https://static.yicode.tech/befly.svg)

> 道生一，一生二，二生三，三生万物

> 仅作者个人使用，请勿使用。

## 🎯 简介

Befly 是专为 Bun 运行时设计的现代化 API 框架，提供：

-   ⚡ **原生 TypeScript 支持** - 完整的类型定义和智能提示
-   🚀 **高性能** - 基于 Bun 运行时，超快的启动和执行速度
-   🔌 **插件化架构** - 灵活的插件系统，轻松扩展功能
-   🗄️ **多数据库支持** - MySQL、PostgreSQL、SQLite 统一接口
-   📝 **自动化表管理** - 基于 JSON 的表定义，自动同步数据库结构
-   🔐 **内置身份验证** - JWT 认证，角色权限管理
-   📊 **完整日志系统** - 结构化日志，敏感字段过滤

## 📦 快速开始

### 安装

```bash
# 创建新项目
mkdir my-api && cd my-api

# 安装 Befly
bun add befly
```

### 最简示例

```typescript
// main.ts
import { Befly } from "befly";

// 配置从 configs/befly.*.json 扫描加载（见 packages/core/befly.config.ts）
const app = new Befly();
await app.start();
```

运行项目：

```bash
bun run main.ts
```

### 创建第一个接口

```typescript
// apis/user/hello.ts
import type { ApiRoute } from "befly/types/api";

export default {
    name: "问候接口",
    auth: false, // 公开接口
    fields: {},
    handler: async (befly, ctx) => {
        return {
            msg: "Hello, Befly!",
            data: {
                timestamp: Date.now(),
            },
        };
    },
} as ApiRoute;
```

访问：`http://localhost:3000/api/app/user/hello`

### 路由命名空间速查

-   **核心 API**：`/api/core/...`（来自 `packages/core/dist/apis/**/*.js`）
-   **项目 API**：`/api/app/...`（来自项目 `apis/**/*.{ts,js}`）
-   **Addon API**：`/api/addon/<addonName>/...`（来自 `addons/<addonName>/apis/**/*.{ts,js}` 或 `node_modules/@befly-addon/<addonName>/apis/**/*.{ts,js}`）

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
        id: "用户ID|number|1|999999|null|1|null",
    },
    required: ["id"],
    handler: async (befly: BeflyContext, ctx) => {
        const { id } = ctx.body;

        // 类型安全的数据库查询
        const user = await befly.db.getOne<User>({
            table: "user",
            where: { id },
        });

        return { msg: "查询成功", data: user };
    },
} as ApiRoute;
```

### 增强的数据库操作

```typescript
// 查询单条
const user = await befly.db.getOne<User>({
    table: "user",
    where: { id: 1 },
});

// 分页列表
const result = await befly.db.getList<Product>({
    table: "product",
    where: { category: "electronics" },
    page: 1,
    limit: 10,
    orderBy: ["createdAt#DESC"],
});

// 插入数据
await befly.db.insData({
    table: "user",
    data: {
        username: "john",
        email: "john@example.com",
    },
});

// 更新数据
await befly.db.updData({
    table: "user",
    where: { id: 1 },
    data: {
        nickname: "John Doe",
    },
});

// 删除数据
await befly.db.delData({
    table: "user",
    where: { id: 1 },
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

请参考：`packages/core/docs/reference/sync.md`（`syncDb` / `syncAll` 等同步流程说明）。

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

## 📖 文档

完整文档请访问 [`/docs` 目录](./docs/)：

## 🧹 代码格式化

本仓库统一使用 **oxfmt** 进行格式化（已移除 Prettier）。

-   格式化：`bun run format`
-   检查：`bunx oxfmt --check .`

-   [快速开始](./docs/02-快速上手/01-10分钟体验.md)
-   [核心概念](./docs/03-核心概念/)
-   [API 开发](./docs/04-API开发/)
-   [数据库操作](./docs/05-数据库/)
-   [TypeScript 支持](./docs/10-TypeScript/01-TypeScript支持.md)

## 📌 导入路径约定（当前）

-   **服务端/框架侧能力**：从 `befly` 默认入口导入（core 不再提供 `befly/lib/*` / `befly/utils/*` 子路径导出）
-   **前端/Vite 环境工具**：从 `befly-vite` 导入

### 目录说明

-   **`packages/core`** - Befly 核心框架包（发布到 npm）
-   **`packages/tpl`** - API 项目模板示例
-   **`packages/admin`** - 后台管理系统（Vue3 + TDesign Vue Next + 自动导入）

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
