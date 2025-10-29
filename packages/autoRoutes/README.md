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

### 示例 1：基础路由

```
views/
├── index.vue           → / (根路径)
├── about.vue           → /about
└── contact.vue         → /contact
```

**生成路由**：

```javascript
[
    {
        path: '/',
        name: 'layout0',
        component: () => import('/src/layouts/0.vue'),
        children: [
            { path: '/', name: 'index', component: () => import('/src/views/index.vue') },
            { path: '/about', name: 'about', component: () => import('/src/views/about.vue') },
            { path: '/contact', name: 'contact', component: () => import('/src/views/contact.vue') }
        ]
    }
];
```

---

### 示例 2：嵌套路由

```
views/
└── user/
    ├── index.vue       → /user
    ├── profile.vue     → /user/profile
    └── settings.vue    → /user/settings
```

**生成路由**：

```javascript
children: [
    { path: '/user', name: 'user' },
    { path: '/user/profile', name: 'user-profile' },
    { path: '/user/settings', name: 'user-settings' }
];
```

---

### 示例 3：多级嵌套

```
views/
└── admin/
    └── system/
        └── user/
            ├── index.vue   → /admin/system/user
            └── role.vue    → /admin/system/user/role
```

**生成路由**：

```javascript
children: [
    { path: '/admin/system/user', name: 'admin-system-user' },
    { path: '/admin/system/user/role', name: 'admin-system-user-role' }
];
```

---

### 示例 4：目录布局继承 ✨

```
views/
├── index.vue           → / (布局0)
└── dashboard_1/        → 目录指定布局1
    ├── index.vue       → /dashboard (布局1，继承目录)
    ├── analytics.vue   → /dashboard/analytics (布局1，继承目录)
    └── reports.vue     → /dashboard/reports (布局1，继承目录)

layouts/
├── 0.vue              # 默认布局
└── 1.vue              # 仪表盘布局
```

**生成路由**：

```javascript
[
    {
        path: '/',
        name: 'layout0',
        component: () => import('/src/layouts/0.vue'),
        children: [{ path: '/', name: 'index' }]
    },
    {
        path: '/',
        name: 'layout1',
        component: () => import('/src/layouts/1.vue'),
        children: [
            { path: '/dashboard', name: 'dashboard' },
            { path: '/dashboard/analytics', name: 'dashboard-analytics' },
            { path: '/dashboard/reports', name: 'dashboard-reports' }
        ]
    }
];
```

**要点**：

- ✅ 目录名 `dashboard_1` 中的 `_1` 后缀被移除，路径为 `/dashboard`
- ✅ 目录下所有文件自动使用布局 1

---

### 示例 5：文件布局优先于目录布局 ✨

```
views/
└── admin_1/            → 目录指定布局1
    ├── index.vue       → /admin (布局1，继承目录)
    ├── users.vue       → /admin/users (布局1，继承目录)
    ├── settings_2.vue  → /admin/settings (布局2，文件优先！)
    └── profile_3.vue   → /admin/profile (布局3，文件优先！)
```

**生成路由**：

```javascript
[
    {
        name: 'layout1',
        children: [
            { path: '/admin', name: 'admin' },
            { path: '/admin/users', name: 'admin-users' }
        ]
    },
    {
        name: 'layout2',
        children: [{ path: '/admin/settings', name: 'admin-settings' }]
    },
    {
        name: 'layout3',
        children: [{ path: '/admin/profile', name: 'admin-profile' }]
    }
];
```

**要点**：

- ✅ 文件名的布局后缀优先级高于目录布局
- ✅ `settings_2.vue` 使用布局 2，覆盖目录的布局 1

---

### 示例 6：多级目录布局（最内层优先）✨

```
views/
└── app_1/              → 外层目录指定布局1
    └── module_2/       → 内层目录指定布局2
        ├── index.vue       → /app/module (布局2，最内层优先！)
        ├── list.vue        → /app/module/list (布局2)
        └── detail_3.vue    → /app/module/detail (布局3，文件优先)
```

**生成路由**：

```javascript
[
    {
        name: 'layout2',
        children: [
            { path: '/app/module', name: 'app-module' },
            { path: '/app/module/list', name: 'app-module-list' }
        ]
    },
    {
        name: 'layout3',
        children: [{ path: '/app/module/detail', name: 'app-module-detail' }]
    }
];
```

**要点**：

- ✅ 多级目录时，最内层的布局目录优先（使用布局 2，不是布局 1）
- ✅ 文件布局仍然优先于目录布局

---

### 示例 7：components 目录自动排除

```
views/
└── page/
    ├── index.vue           → /page (生成路由✓)
    └── components/
        ├── Header.vue      → 不生成路由 ✗
        └── Footer.vue      → 不生成路由 ✗
```

**生成路由**：

```javascript
children: [
    { path: '/page', name: 'page' }
    // ❌ components 目录下的文件不会出现
];
```

---

### 示例 8：kebab-case 自动转换

```
views/
├── UserProfile/
│   └── UserProfile.vue     → /user-profile/user-profile
├── user-management/
│   └── user-list.vue       → /user-management/user-list
└── my_account/
    └── my_settings.vue     → /my-account/my-settings
```

**生成路由**：

```javascript
children: [
    { path: '/user-profile/user-profile', name: 'user-profile-user-profile' },
    { path: '/user-management/user-list', name: 'user-management-user-list' },
    { path: '/my-account/my-settings', name: 'my-account-my-settings' }
];
```

**转换规则**：

- `UserProfile` → `user-profile`（驼峰 → 短横线）
- `user_settings` → `user-settings`（下划线 → 短横线）

---

### 示例 9：实际项目结构

```
src/
├── layouts/
│   ├── 0.vue          # 默认布局（公开页面）
│   ├── 1.vue          # 用户中心布局
│   └── 2.vue          # 管理后台布局
└── views/
    ├── index.vue                    # / (布局0)
    ├── about.vue                    # /about (布局0)
    ├── login.vue                    # /login (布局0)
    ├── user_1/                      # 用户中心（布局1）
    │   ├── index_1.vue              # /user (布局1)
    │   ├── profile_1.vue            # /user/profile (布局1)
    │   └── settings_1.vue           # /user/settings (布局1)
    └── admin_2/                     # 管理后台（布局2）
        ├── index_2.vue              # /admin (布局2)
        ├── dashboard_2.vue          # /admin/dashboard (布局2)
        └── users_2/
            ├── list_2.vue           # /admin/users/list (布局2)
            └── detail_2.vue         # /admin/users/detail (布局2)
```

**生成的路由结构**：

```javascript
[
    {
        name: 'layout0',
        component: () => import('/src/layouts/0.vue'),
        children: [
            { path: '/', name: 'index' },
            { path: '/about', name: 'about' },
            { path: '/login', name: 'login' }
        ]
    },
    {
        name: 'layout1',
        component: () => import('/src/layouts/1.vue'),
        children: [
            { path: '/user', name: 'user' },
            { path: '/user/profile', name: 'user-profile' },
            { path: '/user/settings', name: 'user-settings' }
        ]
    },
    {
        name: 'layout2',
        component: () => import('/src/layouts/2.vue'),
        children: [
            { path: '/admin', name: 'admin' },
            { path: '/admin/dashboard', name: 'admin-dashboard' },
            { path: '/admin/users/list', name: 'admin-users-list' },
            { path: '/admin/users/detail', name: 'admin-users-detail' }
        ]
    }
];
```

---

## 最佳实践

### 1. 布局组织

```typescript
// layouts/0.vue - 公开页面布局
<template>
    <div class="public-layout">
        <header>公开页面头部</header>
        <router-view />
        <footer>页脚</footer>
    </div>
</template>

// layouts/1.vue - 用户中心布局
<template>
    <div class="user-layout">
        <aside>用户菜单</aside>
        <main><router-view /></main>
    </div>
</template>
```

### 2. 目录命名建议

```
✅ 推荐：
views/
├── dashboard_1/      # 清晰的布局分组
├── admin_2/
└── user_1/

❌ 不推荐：
views/
├── Dashboard_1/      # 避免大写开头
├── admin-2/          # 短横线会被转换，但不直观
└── user1/            # 缺少下划线分隔符
```

### 3. 文件命名一致性

```
✅ 推荐：同一目录保持一致
dashboard_1/
├── index.vue         # 不带后缀
├── analytics.vue     # 不带后缀
└── reports.vue       # 不带后缀

或

admin_2/
├── index_2.vue       # 都带后缀
├── users_2.vue
└── settings_2.vue

❌ 避免混用（虽然支持）
mixed/
├── index.vue         # 无后缀
├── users_1.vue       # 有后缀
└── settings_2.vue    # 不同后缀
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
