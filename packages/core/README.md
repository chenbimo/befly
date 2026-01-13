# Befly - 野蜂飞舞

![野蜂飞舞](https://static.yicode.tech/befly.svg)

> 道生一，一生二，二生三，三生万物

专为 Bun 运行时设计的 API 框架：插件化、自动同步、内置权限与缓存。

## 运行环境

- Bun >= 1.0
- MySQL >= 8.0（或 PostgreSQL / SQLite）
- Redis >= 6.0（可选，但推荐）

## 安装与启动

### 1) 安装

在你的项目里安装：

```bash
bun add befly
```

### 2) 项目结构（约定）

```text
my-api/
├── apis/                 # 项目 API（扫描 ts/js）
│   └── user/
│       └── hello.ts
├── tables/               # 表定义 JSON（可选）
│   └── user.json
├── configs/              # 配置文件（必需）
│   ├── befly.common.json
│   ├── befly.development.json
│   └── befly.production.json
└── main.ts
```

### 3) 配置文件

`configs/befly.development.json` 示例：

```json
{
    "appName": "My API",
    "appPort": 3000,
    "appHost": "127.0.0.1",

    "db": {
        "dialect": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "username": "root",
        "password": "root",
        "database": "my_api2"
    },

    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "db": 0,
        "prefix": "my_api"
    },

    "auth": {
        "secret": "change-me",
        "expiresIn": "7d",
        "algorithm": "HS256"
    }
}
```

> 注意：`redis.prefix` 不要包含 `:`，框架会自动拼接分隔符。

### 4) 启动入口

```typescript
// main.ts
import { Befly } from "befly";

const app = new Befly();
await app.start(Bun.env);
```

## 编写第一个 API

```typescript
// apis/user/hello.ts
import type { ApiRoute } from "befly/types/api";

export default {
    name: "问候接口",
    auth: false,
    handler: async (_befly, _ctx) => {
        return { code: 0, msg: "Hello, Befly!", data: { ts: Date.now() } };
    }
} as ApiRoute;
```

启动后访问：

- `GET http://localhost:3000/api/app/user/hello`

## 路由规则（重要）

Befly 会根据“来源 + 文件相对路径”生成 `routePath`：

- 项目 API：`apis/**/*.{ts,js}` → `/api/app/...`
- Addon API：
    - `addons/<addonName>/apis/**/*.{ts,js}` → `/api/addon/<addonName>/...`
    - `node_modules/@befly-addon/<addonName>/apis/**/*.{ts,js}` → `/api/addon/<addonName>/...`

并且：

- 系统内部用于存储/权限判断的 `routePath` **只看 `url.pathname`**（例如 `/api/app/user/login`）。
- **禁止**把权限写成 `POST /api/...` 或 `POST/api/...`（那只是请求行展示，不参与存储）。

## TypeScript 类型导入（public types）

只从 `befly/types/*` 子路径引入类型：

```typescript
import type { ApiRoute } from "befly/types/api";
import type { BeflyContext } from "befly/types/befly";
```

## 文档

更多细节请看 `packages/core/docs/`：

- `docs/guide/quickstart.md`
- `docs/reference/sync.md`
- `docs/plugins/plugin.md`
