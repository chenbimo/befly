# Quickstart 快速入门

> 5 分钟搭建你的第一个 Befly API 服务

## 目录

- [环境准备](#环境准备)
- [项目结构](#项目结构)
- [第一个 API](#第一个-api)
- [配置数据库](#配置数据库)
- [定义表结构](#定义表结构)
- [同步数据库](#同步数据库)
- [启动服务](#启动服务)
- [下一步](#下一步)

---

## 环境准备

### 必需软件

| 软件  | 版本要求 | 说明              |
| ----- | -------- | ----------------- |
| Bun   | >= 1.0   | JavaScript 运行时 |
| MySQL | >= 8.0   | 数据库            |
| Redis | >= 6.0   | 缓存（可选）      |

### 安装 Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS / Linux
curl -fsSL https://bun.sh/install | bash
```

### 创建项目

```bash
# 克隆模板项目
git clone https://github.com/chenbimo/befly-tpl.git my-api
cd my-api

# 安装依赖
bun install
```

---

## 项目结构

```
my-api/
├── apis/                  # API 接口目录
│   └── user/
│       └── login.ts       # 用户登录接口
├── tables/                # 表定义目录
│   └── user.json          # 用户表定义
├── configs/               # 配置文件目录
│   ├── befly.common.json  # 公共配置
│   ├── befly.development.json  # 开发环境配置
│   └── befly.production.json   # 生产环境配置
├── main.ts                # 入口文件
└── package.json
```

---

## 第一个 API

### 创建 API 文件

在 `apis/user/` 目录下创建 `login.ts`：

```typescript
import type { ApiRoute } from "befly/types/api";

export default {
    name: "用户登录",
    method: "POST",
    auth: false, // 不需要登录
    fields: {
        email: { name: "邮箱", type: "string", min: 5, max: 100, regexp: "@email" },
        password: { name: "密码", type: "string", min: 6, max: 100 }
    },
    required: ["email", "password"],
    handler: async (befly, ctx) => {
        // 查询用户
        const user = await befly.db.getDetail({
            table: "user",
            columns: ["id", "email", "password", "nickname"],
            where: { email: ctx.body.email }
        });

        if (!user?.id) {
            return No("用户不存在");
        }

        // 验证密码
        const isValid = await befly.cipher.verifyPassword(ctx.body.password, user.password);
        if (!isValid) {
            return No("密码错误");
        }

        // 签发令牌
        const token = befly.jwt.sign({ userId: user.id });

        return Yes("登录成功", { token: token, user: { id: user.id, nickname: user.nickname } });
    }
} as ApiRoute;
```

### API 路由规则

文件路径自动转换为路由：

| 文件路径                | 路由路径                  |
| ----------------------- | ------------------------- |
| `apis/user/login.ts`    | `POST /api/user/login`    |
| `apis/user/register.ts` | `POST /api/user/register` |
| `apis/article/list.ts`  | `POST /api/article/list`  |

---

## 配置数据库

### 编辑配置文件

修改 `configs/befly.development.json`：

```json
{
    "db": {
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "user": "root",
        "password": "your_password",
        "database": "my_api"
    },
    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "password": ""
    },
    "auth": {
        "secret": "your-jwt-secret-change-in-production",
        "expiresIn": "7d"
    },
    "logger": {
        "debug": 1,
        "console": 1
    }
}
```

### 创建数据库

```sql
CREATE DATABASE my_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 定义表结构

### 创建表定义文件

在 `tables/` 目录下创建 `user.json`：

```json
{
    "email": "邮箱|string|5|100||true|^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
    "password": "密码|string|6|100||true",
    "nickname": "昵称|string|2|50|用户",
    "avatar": "头像|string|0|500",
    "phone": "手机号|string|0|20"
}
```

### 字段定义格式

格式：`"字段标签|类型|最小|最大|默认|必填|正则"`

| 位置 | 说明        | 示例                  |
| ---- | ----------- | --------------------- |
| 1    | 字段标签    | `邮箱`                |
| 2    | 数据类型    | `string` / `number`   |
| 3    | 最小值/长度 | `5`                   |
| 4    | 最大值/长度 | `100`                 |
| 5    | 默认值      | `用户`                |
| 6    | 是否必填    | `true` / `false`      |
| 7    | 正则验证    | `@email` 或自定义正则 |

### 自动字段

每个表自动添加：

| 字段         | 类型    | 说明                            |
| ------------ | ------- | ------------------------------- |
| `id`         | BIGINT  | 主键，自增                      |
| `created_at` | BIGINT  | 创建时间戳                      |
| `updated_at` | BIGINT  | 更新时间戳                      |
| `state`      | TINYINT | 状态（1=正常，0=禁用，-1=删除） |

---

## 同步数据库

### 自动同步

服务启动时会在**主进程**自动执行同步流程：

1. `syncTable()`：同步表结构
2. `syncData()`：固定顺序执行 `syncApi` → `syncMenu` → `syncDev`

如需手动触发，可在代码中调用（一般不建议在请求路径中调用）：

```typescript
import { syncData } from "../sync/syncData.js";
import { syncTable } from "../sync/syncTable.js";

await syncTable();
await syncData();
```

### 验证同步结果

```bash
# 查看数据库
mysql -u root -p my_api -e "SHOW TABLES;"

# 应该看到：
# +------------------+
# | Tables_in_my_api |
# +------------------+
# | user             |
# +------------------+
```

---

## 启动服务

### 开发模式

```bash
bun run dev
```

服务启动后：

```
🚀 Befly 服务已启动
📍 http://localhost:3000
```

### 测试 API

```bash
# 测试登录接口
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

响应示例：

```json
{
    "code": 0,
    "msg": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "user": {
            "id": 1,
            "nickname": "用户"
        }
    }
}
```

---

## 下一步

### 学习更多

| 主题       | 文档                                 | 说明                 |
| ---------- | ------------------------------------ | -------------------- |
| API 开发   | [api.md](./api/api.md)               | API 定义、字段、权限 |
| 表结构     | [table.md](./table.md)               | 表定义格式详解       |
| 数据库操作 | [database.md](./plugins/database.md) | CRUD 操作            |
| 配置系统   | [config.md](./config.md)             | 配置文件说明         |
| 插件开发   | [plugin.md](./plugins/plugin.md)     | 自定义插件           |
| Hook 开发  | [hook.md](./hooks/hook.md)           | 请求处理钩子         |
| 验证系统   | [validator.md](./validator.md)       | 参数验证             |
| 日志系统   | [logger.md](./logger.md)             | 日志配置             |
| 加密工具   | [cipher.md](./plugins/cipher.md)     | 加密与 JWT           |
| 同步命令   | [sync.md](./sync.md)                 | 数据库同步           |

### 常用命令

```bash
# 开发
bun run dev          # 启动开发服务

# 生产
bun run build        # 构建
bun run start        # 启动生产服务
```

### 项目示例

```
apis/
├── user/
│   ├── login.ts      # 登录
│   ├── register.ts   # 注册
│   ├── info.ts       # 获取信息
│   └── update.ts     # 更新信息
├── article/
│   ├── list.ts       # 文章列表
│   ├── detail.ts     # 文章详情
│   ├── create.ts     # 创建文章
│   └── delete.ts     # 删除文章
└── common/
    └── upload.ts     # 文件上传

tables/
├── user.json         # 用户表
├── article.json      # 文章表
└── category.json     # 分类表
```
