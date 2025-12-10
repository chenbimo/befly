# Addon 插件包开发

> 可复用的功能模块，包含 API、表、插件、视图

## 目录

- [概述](#概述)
- [Addon 结构](#addon-结构)
- [创建 Addon](#创建-addon)
- [发布 Addon](#发布-addon)
- [使用 Addon](#使用-addon)
- [命名规范](#命名规范)
- [API 路由](#api-路由)
- [表定义](#表定义)
- [插件开发](#插件开发)
- [视图与菜单](#视图与菜单)
- [官方 Addon](#官方-addon)
- [FAQ](#faq)

---

## 概述

Addon 是 Befly 的可复用功能模块，一个 Addon 可以包含：

| 目录       | 说明       | 自动加载 |
| ---------- | ---------- | -------- |
| `apis/`    | API 接口   | ✅       |
| `tables/`  | 表定义     | ✅       |
| `plugins/` | 自定义插件 | ✅       |
| `views/`   | 前端页面   | ✅       |
| `styles/`  | 样式文件   | 手动引入 |

**加载顺序**：Addon 的资源会在项目资源之前加载，项目可以覆盖 Addon 的配置。

---

## Addon 结构

### 标准目录结构

```
@befly-addon/admin/
├── apis/                    # API 接口
│   ├── admin/               # 管理员相关
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── info.ts
│   ├── role/                # 角色管理
│   │   ├── list.ts
│   │   └── update.ts
│   └── menu/                # 菜单管理
│       └── list.ts
├── tables/                  # 表定义
│   ├── admin.json           # 管理员表
│   ├── role.json            # 角色表
│   └── menu.json            # 菜单表
├── plugins/                 # 自定义插件
│   └── email.ts             # 邮件插件
├── views/                   # 前端视图
│   ├── login_1/             # 登录页
│   │   ├── login.vue
│   │   └── meta.json
│   └── permission/          # 权限管理
│       ├── permission.vue
│       └── meta.json
├── styles/                  # 样式文件
│   └── variables.scss
├── package.json             # 包配置
└── README.md                # 文档
```

### package.json 配置

```json
{
    "name": "@befly-addon/admin",
    "version": "1.0.0",
    "title": "管理后台",
    "description": "Befly - 管理后台功能组件",
    "type": "module",
    "private": false,
    "publishConfig": {
        "access": "public",
        "registry": "https://registry.npmjs.org"
    },
    "main": "package.json",
    "exports": {
        ".": "./package.json",
        "./styles/*": "./styles/*"
    },
    "files": ["apis", "plugins", "styles", "tables", "views", "package.json", "README.md"],
    "keywords": ["befly", "addon"],
    "dependencies": {
        "befly-shared": "^1.2.0"
    }
}
```

---

## 创建 Addon

### 1. 初始化目录

```bash
mkdir my-addon
cd my-addon
bun init
```

### 2. 修改 package.json

```json
{
    "name": "@befly-addon/my-addon",
    "version": "1.0.0",
    "title": "我的插件",
    "type": "module",
    "main": "package.json",
    "files": ["apis", "tables", "plugins", "views"]
}
```

### 3. 创建 API

`apis/hello/world.ts`：

```typescript
import type { ApiRoute } from 'befly/types/api.js';

export default {
    name: 'Hello World',
    method: 'GET',
    auth: false,
    handler: async (befly, ctx) => {
        return Yes('Hello from my-addon!');
    }
} as ApiRoute;
```

### 4. 创建表定义

`tables/example.json`：

```json
{
    "title": "标题|string|2|100||true",
    "content": "内容|text|0|10000",
    "sort": "排序|number|0|9999|0"
}
```

### 5. 本地测试

在项目中链接本地 Addon：

```bash
# 在 addon 目录
bun link

# 在项目目录
bun link @befly-addon/my-addon
```

---

## 发布 Addon

### 1. 检查配置

确保 `package.json` 包含：

```json
{
    "name": "@befly-addon/your-addon-name",
    "publishConfig": {
        "access": "public"
    },
    "files": ["apis", "tables", "plugins", "views"]
}
```

### 2. 登录 npm

```bash
npm login
```

### 3. 发布

```bash
npm publish
```

---

## 使用 Addon

### 安装

```bash
bun add @befly-addon/admin
```

### 自动加载

安装后，Befly 会自动扫描并加载：

- `node_modules/@befly-addon/*/apis/` 下的所有 API
- `node_modules/@befly-addon/*/tables/` 下的所有表定义
- `node_modules/@befly-addon/*/plugins/` 下的所有插件
- `node_modules/@befly-addon/*/views/` 下的所有视图

### 手动引入样式

```typescript
// main.ts 或 vite.config.js
import '@befly-addon/admin/styles/variables.scss';
```

---

## 命名规范

### 包名

- 格式：`@befly-addon/{addon-name}`
- 示例：`@befly-addon/admin`、`@befly-addon/cms`

### 表名前缀

Addon 的表自动添加 `addon_{name}_` 前缀：

| Addon   | 表文件         | 数据库表名          |
| ------- | -------------- | ------------------- |
| `admin` | `role.json`    | `addon_admin_role`  |
| `admin` | `menu.json`    | `addon_admin_menu`  |
| `cms`   | `article.json` | `addon_cms_article` |

### API 路由前缀

Addon 的 API 自动添加 `/addon/{name}/` 前缀：

| Addon   | API 文件              | 路由                                |
| ------- | --------------------- | ----------------------------------- |
| `admin` | `apis/admin/login.ts` | `POST /api/addon/admin/admin/login` |
| `admin` | `apis/role/list.ts`   | `POST /api/addon/admin/role/list`   |

---

## API 路由

### 文件结构

```
apis/
├── admin/
│   ├── login.ts      → /api/addon/{name}/admin/login
│   ├── logout.ts     → /api/addon/{name}/admin/logout
│   └── info.ts       → /api/addon/{name}/admin/info
└── role/
    ├── list.ts       → /api/addon/{name}/role/list
    └── update.ts     → /api/addon/{name}/role/update
```

### API 定义示例

```typescript
import type { ApiRoute } from 'befly/types/api.js';

export default {
    name: '管理员登录',
    method: 'POST',
    auth: false,
    desc: '管理员邮箱密码登录',
    fields: {
        email: { name: '邮箱', type: 'string', min: 5, max: 100, regexp: '@email' },
        password: { name: '密码', type: 'string', min: 6, max: 100 }
    },
    required: ['email', 'password'],
    handler: async (befly, ctx) => {
        // 使用 addon 表时需要完整表名
        const admin = await befly.db.getDetail({
            table: 'addon_admin_admin',
            columns: ['id', 'email', 'password', 'nickname'],
            where: { email: ctx.body.email }
        });

        // ... 业务逻辑

        return Yes('登录成功', { token: token });
    }
} as ApiRoute;
```

---

## 表定义

### 文件格式

表定义使用 JSON 格式，与项目表定义一致：

```json
{
    "email": "邮箱|string|5|100||true|@email",
    "password": "密码|string|6|100||true",
    "nickname": "昵称|string|2|50|用户",
    "role_id": "角色ID|number|1||",
    "last_login_at": "最后登录|number|0||"
}
```

### 表名转换

| 定义文件                  | 数据库表名                  |
| ------------------------- | --------------------------- |
| `tables/admin.json`       | `addon_{name}_admin`        |
| `tables/role.json`        | `addon_{name}_role`         |
| `tables/userProfile.json` | `addon_{name}_user_profile` |

### 在代码中使用

```typescript
// 使用完整表名
await befly.db.getList({
    table: 'addon_admin_role', // addon_{name}_{table}
    columns: ['id', 'name', 'code']
});
```

---

## 插件开发

### 插件定义

`plugins/email.ts`：

```typescript
import type { Plugin } from 'befly/types/plugin.js';

export interface EmailConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
}

const emailPlugin: Plugin = {
    after: ['config'], // 依赖 config 插件
    async handler(befly) {
        const config = befly.config.get('email') as EmailConfig;

        return {
            async send(to: string, subject: string, html: string) {
                // 发送邮件逻辑
            }
        };
    }
};

export default emailPlugin;
```

### 插件命名

- 插件名称由文件名决定（自动转小驼峰）
- `email.ts` → `befly.email`
- `myPlugin.ts` → `befly.myPlugin`

### 使用插件

```typescript
// 在 API 中使用
export default {
    name: '发送邮件',
    handler: async (befly, ctx) => {
        await befly.email.send(ctx.body.to, '欢迎注册', '<h1>欢迎使用</h1>');
        return Yes('发送成功');
    }
} as ApiRoute;
```

---

## 视图与菜单

### 视图结构

```
views/
├── login_1/              # 使用 layout 1
│   ├── login.vue         # 页面组件
│   └── meta.json         # 菜单配置
├── permission/
│   ├── permission.vue
│   ├── meta.json
│   ├── role/             # 子菜单
│   │   ├── role.vue
│   │   └── meta.json
│   └── menu/
│       ├── menu.vue
│       └── meta.json
```

### meta.json 配置

```json
{
    "name": "权限管理",
    "icon": "Shield",
    "sort": 10
}
```

### 目录命名规则

- `name_1/` → 使用 `layouts/1.vue` 布局
- `name_2/` → 使用 `layouts/2.vue` 布局
- `name/` → 使用默认布局

---

## 官方 Addon

### @befly-addon/admin

管理后台基础功能：

| 功能       | API            | 表                        |
| ---------- | -------------- | ------------------------- |
| 管理员管理 | `admin/*`      | `addon_admin_admin`       |
| 角色管理   | `role/*`       | `addon_admin_role`        |
| 菜单管理   | `menu/*`       | `addon_admin_menu`        |
| API 管理   | `api/*`        | `addon_admin_api`         |
| 字典管理   | `dict/*`       | `addon_admin_dict`        |
| 登录日志   | `loginLog/*`   | `addon_admin_login_log`   |
| 操作日志   | `operateLog/*` | `addon_admin_operate_log` |
| 邮件日志   | `email/*`      | `addon_admin_email_log`   |
| 系统配置   | `sysConfig/*`  | `addon_admin_sys_config`  |

**安装**：

```bash
bun add @befly-addon/admin
```

---

## FAQ

### Q: 如何覆盖 Addon 的 API？

A: 在项目中创建同路径的 API 文件，项目 API 优先级高于 Addon。

### Q: 如何禁用 Addon 的某个插件？

A: 在配置文件中设置：

```json
{
    "disablePlugins": ["email"]
}
```

### Q: Addon 的表如何迁移？

A: 使用 `befly sync:db` 命令，会自动同步所有 Addon 的表定义。

### Q: 如何在 Addon 中访问项目配置？

A: 通过 `befly.config` 访问：

```typescript
const dbConfig = befly.config.get('db');
const customConfig = befly.config.get('myAddon');
```

### Q: Addon 之间可以互相依赖吗？

A: 可以，在 `package.json` 中声明依赖：

```json
{
    "dependencies": {
        "@befly-addon/admin": "^1.0.0"
    }
}
```

### Q: 如何本地开发调试 Addon？

A: 使用 `bun link`：

```bash
# 在 addon 目录
bun link

# 在项目目录
bun link @befly-addon/my-addon

# 修改 addon 代码后会自动生效
```

### Q: Addon 的视图如何与项目视图合并？

A: Addon 视图会自动合并到路由系统中：

- Addon 视图路由前缀：`/addon/{name}/`
- 菜单会自动同步到 `addon_admin_menu` 表
