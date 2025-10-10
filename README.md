# Befly - 蜜蜂飞舞

> 道生一，一生二，二生三，三生万物

**Befly 3.0 - TypeScript 重构版本已发布！**

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

# 初始化项目（即将支持）
bunx befly init
```

### 最简示例

```typescript
// main.ts
import { Server } from 'befly';

await Server({
    name: 'My API',
    port: 3000
});
```

运行项目：

```bash
bun run main.ts
```

### 创建第一个接口

```typescript
// apis/user/hello.ts
import { Api, Yes } from 'befly';

export default Api.GET(
    '问候接口',
    false, // 公开接口
    {},
    [],
    async (befly, ctx) => {
        return Yes('Hello, Befly!', {
            timestamp: Date.now()
        });
    }
);
```

访问：`http://localhost:3000/user/hello`

## 🔥 新版本特性（3.0）

### TypeScript 全面支持

```typescript
import type { BeflyContext, ApiRoute } from 'befly';
import type { User } from './types/models';

// 完整的类型提示
export default Api.POST<User>('获取用户', true, { id: '用户ID⚡number⚡1⚡999999⚡null⚡0⚡null' }, ['id'], async (befly: BeflyContext, ctx) => {
    const { id } = ctx.body;

    // 类型安全的数据库查询
    const user = await befly.db.getDetail<User>({
        table: 'user',
        where: { id }
    });

    return Yes('查询成功', user);
});
```

### 增强的数据库操作

```typescript
// 查询单条
const user = await befly.db.getDetail<User>({
    table: 'user',
    where: { id: 1 }
});

// 分页列表
const result = await befly.db.getList<Product>({
    table: 'product',
    where: { category: 'electronics' },
    page: 1,
    limit: 10,
    orderBy: 'created_at DESC'
});

// 事务支持
await befly.db.trans(async (trans) => {
    await trans.insData({ table: 'order', data: orderData });
    await trans.updData({ table: 'product', data: { stock: newStock }, where: { id: productId } });
});
```

### 智能表定义

```json
{
    "username": "用户名⚡string⚡3⚡50⚡null⚡1⚡^[a-zA-Z0-9_]+$",
    "email": "邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    "age": "年龄⚡number⚡0⚡150⚡0⚡0⚡null",
    "tags": "标签⚡array⚡0⚡10⚡[]⚡0⚡null",
    "bio": "简介⚡text⚡0⚡5000⚡null⚡0⚡null"
}
```

同步到数据库：

```bash
bun run scripts/syncDb.ts
```

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

-   [快速开始](./docs/02-快速上手/01-10分钟体验.md)
-   [核心概念](./docs/03-核心概念/)
-   [API 开发](./docs/04-API开发/)
-   [数据库操作](./docs/05-数据库/)
-   [TypeScript 支持](./docs/10-TypeScript/01-TypeScript支持.md)

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
