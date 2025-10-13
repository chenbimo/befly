# Admin 插件自动导入优化记录

> 执行日期：2025-10-13

## 📋 优化概述

使用 `unplugin-auto-import` 的 `dirs` 选项自动导入 `src/plugins` 目录下的所有导出，实现真正的"零导入"插件系统。

## 🔄 改进对比

### 改进前（手动 import.meta.glob）

```typescript
// main.ts
import type { Plugin } from 'vue';

// 手动加载插件
const pluginModules = import.meta.glob<{ default: Plugin }>('./plugins/*.ts', {
    eager: true
});

for (const path in pluginModules) {
    const plugin = pluginModules[path].default;
    if (plugin && typeof plugin.install === 'function') {
        app.use(plugin);
        console.log(`[Plugins] ✓ 已加载: ${path}`);
    }
}
```

**问题：**

-   ❌ 需要在 main.ts 中编写加载逻辑
-   ❌ 需要循环处理插件模块
-   ❌ 插件必须是 Vue Plugin 格式（default export + install 方法）
-   ❌ 代码冗长，不够优雅

### 改进后（unplugin-auto-import dirs）

```typescript
// vite.config.ts
AutoImport({
    imports: ['vue', 'vue-router', 'pinia'],
    dirs: ['./src/plugins'], // ← 自动导入此目录下的所有导出
    dts: 'src/types/auto-imports.d.ts'
});
```

```typescript
// main.ts
const app = createApp(App);

// 直接使用，无需导入！
setupRouter(app);
```

**优势：**

-   ✅ 无需在 main.ts 中编写加载逻辑
-   ✅ 无需循环处理
-   ✅ 插件可以是普通函数导出（更灵活）
-   ✅ 代码简洁，一行搞定
-   ✅ TypeScript 自动生成类型定义

## 📝 文件变更详情

### 1. `vite.config.ts` - 添加 dirs 配置

```typescript
AutoImport({
    imports: [
        'vue',
        'vue-router',
        'pinia',
        {
            'tdesign-vue-next': ['MessagePlugin', 'DialogPlugin', 'NotifyPlugin', 'LoadingPlugin']
        }
    ],
    // 自动导入 plugins 目录下的所有导出
    dirs: ['./src/plugins'],
    dts: 'src/types/auto-imports.d.ts',
    eslintrc: {
        enabled: false
    }
});
```

**关键配置：**

-   `dirs: ['./src/plugins']` - 扫描此目录下的所有 `.ts` 文件
-   自动导入所有 `export` 的函数和变量
-   自动生成 TypeScript 类型定义

### 2. `src/plugins/router.ts` - 改为函数导出

**改造前（Plugin 格式）：**

```typescript
export default {
    install(app: App) {
        // 创建路由
        // 配置守卫
        // 安装路由
    }
};
```

**改造后（函数导出）：**

```typescript
export function setupRouter(app: App) {
    // 创建路由实例
    const router = createRouter({
        history: createWebHistory(import.meta.env.BASE_URL),
        routes: autoRoutes
    });

    // 路由守卫
    router.beforeEach((to, from, next) => {
        if (to.meta.title) {
            document.title = `${to.meta.title} - Befly Admin`;
        }

        const token = localStorage.getItem('token');
        if (!to.meta.public && !token) {
            next('/login');
        } else {
            next();
        }
    });

    // 安装路由
    app.use(router);

    return router;
}
```

**关键变化：**

-   ✅ 从 `export default { install }` 改为 `export function setupRouter`
-   ✅ 可以返回 router 实例供外部使用
-   ✅ 命名更语义化（`setupRouter` 而不是匿名 plugin）
-   ✅ 更灵活，可以传递其他参数

### 3. `src/main.ts` - 简化为直接调用

**改造前：**

```typescript
import type { Plugin } from 'vue';

const pluginModules = import.meta.glob<{ default: Plugin }>('./plugins/*.ts', {
    eager: true
});

for (const path in pluginModules) {
    const plugin = pluginModules[path].default;
    if (plugin && typeof plugin.install === 'function') {
        app.use(plugin);
        console.log(`[Plugins] ✓ 已加载: ${path}`);
    }
}
```

**改造后：**

```typescript
// 自动导入的 setupRouter 函数（来自 src/plugins/router.ts）
// 无需手动导入，unplugin-auto-import 会自动处理
setupRouter(app);
```

**关键变化：**

-   ✅ 移除所有手动加载逻辑
-   ✅ 直接调用 `setupRouter`，无需 `import`
-   ✅ TypeScript 有完整的类型提示
-   ✅ 代码从 ~15 行减少到 1 行

## 🎯 插件开发规范

### 插件文件命名

```
✅ 推荐
src/plugins/router.ts        - 路由插件
src/plugins/permission.ts    - 权限插件
src/plugins/directives.ts    - 指令插件

❌ 不推荐
src/plugins/routerPlugin.ts  - 冗余后缀
src/plugins/setup-router.ts  - 应使用驼峰
```

### 插件导出格式

**方式 1：导出 setup 函数（推荐）**

```typescript
// src/plugins/router.ts
export function setupRouter(app: App) {
    // 插件逻辑
}

// main.ts - 自动导入，直接使用
setupRouter(app);
```

**方式 2：导出多个工具函数**

```typescript
// src/plugins/utils.ts
export function formatDate(date: Date) {
    return date.toLocaleDateString();
}

export function formatPrice(price: number) {
    return `¥${price.toFixed(2)}`;
}

// 在任何组件中使用（自动导入）
const date = formatDate(new Date());
const price = formatPrice(100);
```

**方式 3：导出常量**

```typescript
// src/plugins/constants.ts
export const API_BASE_URL = '/api';
export const APP_NAME = 'Befly Admin';
export const PAGE_SIZE = 20;

// 在任何地方使用（自动导入）
console.log(API_BASE_URL);
```

### 插件初始化顺序

```typescript
// main.ts
const app = createApp(App);

// 1. 基础插件
app.use(createPinia());
app.use(TDesign);

// 2. 自动导入的插件（按文件名字母顺序）
setupRouter(app); // plugins/router.ts
setupPermission(app); // plugins/permission.ts
setupDirectives(app); // plugins/directives.ts

app.mount('#app');
```

## ✅ 优势总结

### 1. 开发体验提升

**改造前：**

```typescript
// 需要导入
import { formatDate } from '@/plugins/utils';

const date = formatDate(new Date());
```

**改造后：**

```typescript
// 无需导入，直接使用！
const date = formatDate(new Date());
```

### 2. 类型安全

`unplugin-auto-import` 会自动生成类型定义文件：

```typescript
// src/types/auto-imports.d.ts
export {};
declare global {
    const setupRouter: typeof import('../plugins/router')['setupRouter'];
    const formatDate: typeof import('../plugins/utils')['formatDate'];
    // ... 所有导出都有类型定义
}
```

### 3. 易于维护

**添加新插件只需两步：**

1. 创建文件 `src/plugins/xxx.ts`
2. 导出函数 `export function setupXxx(app: App) {}`

**无需修改任何其他文件！**

### 4. 性能优化

-   ✅ 自动 Tree-shaking（未使用的函数不会打包）
-   ✅ 按需加载（只加载使用的函数）
-   ✅ 编译时处理（无运行时开销）

## 📚 使用示例

### 示例 1：权限插件

```typescript
// src/plugins/permission.ts
import type { App } from 'vue';

export function setupPermission(app: App) {
    app.directive('permission', {
        mounted(el, binding) {
            const permissions = getPermissions();
            if (!permissions.includes(binding.value)) {
                el.remove();
            }
        }
    });
}

export function hasPermission(code: string): boolean {
    const permissions = getPermissions();
    return permissions.includes(code);
}

function getPermissions(): string[] {
    return JSON.parse(localStorage.getItem('permissions') || '[]');
}
```

**使用方式：**

```vue
<template>
    <!-- 指令方式 -->
    <t-button v-permission="'user:delete'">删除</t-button>

    <!-- 函数方式 -->
    <t-button v-if="hasPermission('user:edit')">编辑</t-button>
</template>

<script setup lang="ts">
// 无需导入 hasPermission，自动可用！
</script>
```

### 示例 2：API 工具函数

```typescript
// src/plugins/api.ts
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000
});

export function setupApi(app: App) {
    // 请求拦截器
    api.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    // 挂载到全局
    app.config.globalProperties.$api = api;
}

// 导出 API 方法
export async function getUser(id: number) {
    return api.get(`/user/${id}`);
}

export async function updateUser(id: number, data: any) {
    return api.put(`/user/${id}`, data);
}
```

**使用方式：**

```vue
<script setup lang="ts">
// 无需导入，直接使用！
const user = await getUser(1);
await updateUser(1, { name: 'New Name' });
</script>
```

### 示例 3：工具函数库

```typescript
// src/plugins/utils.ts
export function formatDate(date: Date, format = 'YYYY-MM-DD'): string {
    // 格式化日期
    return date.toLocaleDateString();
}

export function formatPrice(price: number): string {
    return `¥${price.toFixed(2)}`;
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return function (...args: Parameters<T>) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let lastTime = 0;
    return function (...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastTime >= wait) {
            func(...args);
            lastTime = now;
        }
    };
}
```

**使用方式：**

```vue
<script setup lang="ts">
// 所有工具函数自动可用！
const date = formatDate(new Date());
const price = formatPrice(199.99);

const handleSearch = debounce(() => {
    console.log('搜索...');
}, 300);
</script>
```

## 🔍 自动生成的类型文件

运行开发服务器后，会自动生成 `src/types/auto-imports.d.ts`：

```typescript
// Auto-generated by unplugin-auto-import
export {};
declare global {
    // Vue
    const computed: typeof import('vue')['computed'];
    const ref: typeof import('vue')['ref'];
    const reactive: typeof import('vue')['reactive'];

    // Vue Router
    const useRouter: typeof import('vue-router')['useRouter'];
    const useRoute: typeof import('vue-router')['useRoute'];

    // Pinia
    const defineStore: typeof import('pinia')['defineStore'];

    // TDesign
    const MessagePlugin: typeof import('tdesign-vue-next')['MessagePlugin'];

    // Plugins
    const setupRouter: typeof import('../plugins/router')['setupRouter'];
    const hasPermission: typeof import('../plugins/permission')['hasPermission'];
    const formatDate: typeof import('../plugins/utils')['formatDate'];
    const formatPrice: typeof import('../plugins/utils')['formatPrice'];
    // ... 所有 plugins 目录下的导出
}
```

## 📊 对比总结

| 特性             | 改造前                | 改造后                  |
| ---------------- | --------------------- | ----------------------- |
| **加载方式**     | 手动 import.meta.glob | unplugin-auto-import ✅ |
| **导入语句**     | 需要 import           | 无需 import ✅          |
| **类型安全**     | 手动维护              | 自动生成 ✅             |
| **代码行数**     | ~15 行                | 1 行 ✅                 |
| **扩展性**       | 中等                  | 极强 ✅                 |
| **维护成本**     | 高                    | 低 ✅                   |
| **Tree-shaking** | 手动                  | 自动 ✅                 |

## 🎉 总结

通过使用 `unplugin-auto-import` 的 `dirs` 选项，我们实现了：

1. ✅ **零导入** - 所有 plugins 导出自动可用
2. ✅ **类型安全** - 自动生成 TypeScript 类型定义
3. ✅ **极简代码** - main.ts 从 15+ 行减少到 1 行
4. ✅ **灵活导出** - 支持函数、常量、类等任意导出
5. ✅ **自动优化** - 支持 Tree-shaking 和按需加载

这是一个更现代、更优雅的插件系统实现方式！

---

**实施状态：** ✅ 完成
**测试状态：** 待测试
**性能影响：** 无负面影响，反而更优
