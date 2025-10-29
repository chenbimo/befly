# befly-auto-routes

Vue Router 自动路由生成插件，基于文件结构自动生成路由配置。

## 特性

- ✅ **基于文件系统**：自动扫描 `views` 目录生成路由
- ✅ **多级目录支持**：支持任意深度的目录嵌套
- ✅ **布局系统**：通过文件名后缀（`_n`）指定布局
- ✅ **智能排除**：自动排除 `components` 等目录
- ✅ **路径规范化**：自动转换为 kebab-case
- ✅ **HMR 支持**：文件变化时自动更新路由
- ✅ **TypeScript**：完整的类型支持
- ✅ **模板分离**：插件和模板文件分离，便于自定义

## 安装

```bash
bun add befly-auto-routes -D
# or
npm install befly-auto-routes -D
```

## 项目结构

```
befly-auto-routes/
├── index.ts        # 插件主文件
├── template.js     # 路由生成模板
├── package.json
└── README.md
```

## 使用

### 1. 配置 Vite 插件

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import autoRoutes from 'befly-auto-routes';

export default defineConfig({
    plugins: [
        vue(),
        autoRoutes() // 默认配置
        // 或
        // autoRoutes({ debug: false }) // 关闭调试输出
    ]
});
```

**固定配置**：

- `viewsDir`: `/src/views` - 视图目录
- `layoutsDir`: `/src/layouts` - 布局目录
- `excludeDirs`: `['components']` - 排除目录

**可选配置**：

- `debug`: `boolean` - 是否在开发环境打印路由信息（默认 `true`）

### 2. 在路由中使用

```typescript
// src/plugins/router.ts
import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';

const router = createRouter({
    history: createWebHistory(),
    routes: autoRoutes
});

export default router;
```

### 3. TypeScript 类型声明

```typescript
// src/types/auto-routes.d.ts
declare module 'virtual:auto-routes' {
    import type { RouteRecordRaw } from 'vue-router';
    const routes: RouteRecordRaw[];
    export default routes;
}
```

## 路由规则

### 目录结构

```
src/
├── layouts/
│   ├── 0.vue          # 默认布局
│   ├── 1.vue          # 布局1
│   └── 2.vue          # 布局2
└── views/
    ├── index.vue                    # / (根路径)
    ├── about/
    │   └── index.vue                # /about
    ├── user/
    │   ├── index.vue                # /user
    │   ├── profile/
    │   │   ├── index.vue            # /user/profile
    │   │   └── edit.vue             # /user/profile/edit
    │   └── components/              # 自动排除
    │       └── UserCard.vue
    ├── dashboard_2/                 # 使用布局2
    │   ├── index.vue                # /dashboard (布局2)
    │   └── analytics_2.vue          # /dashboard/analytics (布局2)
    └── news/
        ├── detail/
        │   └── detail.vue           # /news/detail/detail
        └── list.vue                 # /news/list
```

### 规则说明

1. **index.vue 作为默认路由**
    - `/views/news/index.vue` → `/news`
    - `/views/index.vue` → `/`

2. **非 index.vue 保留文件名**
    - `/views/news/detail/detail.vue` → `/news/detail/detail`
    - `/views/user/profile/edit.vue` → `/user/profile/edit`

3. **布局后缀规则**
    - `<name>_n.vue` 指定布局编号
    - `/views/dashboard_2/index.vue` → `/dashboard` (使用布局2)
    - 默认布局为 `0`

4. **自动排除**
    - `components` 目录下的文件自动忽略（固定规则）

5. **路径规范化**
    - 自动转换为 kebab-case
    - `UserProfile` → `user-profile`
    - `user_profile` → `user-profile`

## 配置选项

### debug

类型：`boolean`
默认值：`true`

是否在开发环境打印路由信息到控制台。

**示例**：

```typescript
// 启用调试（默认）
autoRoutes({ debug: true });

// 禁用调试
autoRoutes({ debug: false });
```

**控制台输出示例**（当 `debug: true` 时）：

```javascript
[auto-routes] 当前生成路由: [
    {
        layout: 'layout0',
        children: [
            { path: '/', name: 'index', file: '/src/views/index.vue' },
            { path: '/about', name: 'about', file: '/src/views/about.vue' }
        ]
    }
]
```

## 示例

### 基础使用

```
views/
├── index.vue           → /
├── about.vue           → /about
└── user.vue            → /user
```

### 嵌套路由

```
views/
└── user/
    ├── index.vue       → /user
    ├── profile.vue     → /user/profile
    └── settings.vue    → /user/settings
```

### 多级嵌套

```
views/
└── admin/
    └── system/
        └── user/
            ├── index.vue   → /admin/system/user
            └── role.vue    → /admin/system/user/role
```

### 布局系统

```
views/
├── index.vue           → / (布局0)
├── dashboard_1/
│   └── index.vue       → /dashboard (布局1)
└── admin_2/
    └── index.vue       → /admin (布局2)

layouts/
├── 0.vue              # 默认布局
├── 1.vue              # 仪表盘布局
└── 2.vue              # 管理员布局
```

## 开发调试

开发环境下，插件会在浏览器控制台打印生成的路由信息：

```javascript
[auto-routes] 当前生成路由: [
    {
        layout: 'layout0',
        children: [
            { path: '/', name: 'index', file: '/src/views/index.vue' },
            { path: '/about', name: 'about', file: '/src/views/about.vue' }
        ]
    }
]
```

可通过 `debug: false` 关闭此功能。

## License

Apache-2.0
