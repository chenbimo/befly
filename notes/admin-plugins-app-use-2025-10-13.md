# Admin 插件系统 - 使用 app.use() 方式

> 更新日期：2025-10-13

## 📋 最终方案

结合 `unplugin-auto-import` 的 `dirs` 自动导入功能和 Vue 标准的 `app.use()` 插件安装方式。

## 🎯 核心特点

1. ✅ **自动导入** - 无需手动 import
2. ✅ **标准用法** - 使用 `app.use()` 安装
3. ✅ **类型安全** - 完整的 TypeScript 支持
4. ✅ **统一规范** - 所有插件遵循 Vue Plugin 规范

## 📝 实现方式

### 1. Vite 配置自动导入

```typescript
// vite.config.ts
import AutoImport from 'unplugin-auto-import/vite';

export default defineConfig({
    plugins: [
        AutoImport({
            imports: ['vue', 'vue-router', 'pinia'],
            // 自动导入 plugins 目录下的所有导出
            dirs: ['./src/plugins'],
            dts: 'src/types/auto-imports.d.ts'
        })
    ]
});
```

### 2. 插件文件格式

```typescript
// src/plugins/router.ts
import type { Plugin } from 'vue';

export const RouterPlugin: Plugin = {
    install(app) {
        // 插件逻辑
    }
};
```

**命名规范：**

-   ✅ 导出名称使用 PascalCase
-   ✅ 以 `Plugin` 结尾（如 `RouterPlugin`）
-   ✅ 使用 `export const` 导出

### 3. 使用方式

```typescript
// src/main.ts
const app = createApp(App);

// 无需导入，直接使用！
app.use(RouterPlugin);
```

## 🔄 完整示例

### 路由插件

```typescript
// src/plugins/router.ts
import type { Plugin } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';

export const RouterPlugin: Plugin = {
    install(app) {
        const router = createRouter({
            history: createWebHistory(import.meta.env.BASE_URL),
            routes: autoRoutes
        });

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

        app.use(router);
    }
};
```

### 权限插件

```typescript
// src/plugins/permission.ts
import type { Plugin } from 'vue';

export const PermissionPlugin: Plugin = {
    install(app) {
        // 权限指令
        app.directive('permission', {
            mounted(el, binding) {
                const permissions = getPermissions();
                if (!permissions.includes(binding.value)) {
                    el.remove();
                }
            }
        });

        // 全局方法
        app.config.globalProperties.$hasPermission = (code: string) => {
            const permissions = getPermissions();
            return permissions.includes(code);
        };
    }
};

function getPermissions(): string[] {
    return JSON.parse(localStorage.getItem('permissions') || '[]');
}
```

### 指令插件

```typescript
// src/plugins/directives.ts
import type { Plugin } from 'vue';

export const DirectivesPlugin: Plugin = {
    install(app) {
        // 自动聚焦
        app.directive('focus', {
            mounted(el) {
                el.focus();
            }
        });

        // 防抖指令
        app.directive('debounce', {
            mounted(el, binding) {
                let timer: NodeJS.Timeout;
                el.addEventListener('click', () => {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => binding.value(), 300);
                });
            }
        });

        // Loading 指令
        app.directive('loading', {
            mounted(el, binding) {
                if (binding.value) {
                    el.classList.add('is-loading');
                }
            },
            updated(el, binding) {
                if (binding.value) {
                    el.classList.add('is-loading');
                } else {
                    el.classList.remove('is-loading');
                }
            }
        });
    }
};
```

### API 插件

```typescript
// src/plugins/api.ts
import type { Plugin } from 'vue';
import axios from 'axios';

export const ApiPlugin: Plugin = {
    install(app) {
        const api = axios.create({
            baseURL: '/api',
            timeout: 10000
        });

        // 请求拦截器
        api.interceptors.request.use((config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // 响应拦截器
        api.interceptors.response.use(
            (response) => response.data,
            (error) => {
                if (error.response?.status === 401) {
                    // 未授权，跳转登录
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
        );

        // 挂载到全局
        app.config.globalProperties.$api = api;
    }
};
```

## 📋 主文件配置

```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';

// 引入样式
import 'tdesign-vue-next/es/style/index.css';
import './styles/index.css';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());
app.use(TDesign);

// 安装自动导入的插件（无需 import）
app.use(RouterPlugin);
app.use(PermissionPlugin);
app.use(DirectivesPlugin);
app.use(ApiPlugin);

app.mount('#app');
```

## 🎨 插件开发规范

### 文件命名

```
✅ 推荐
src/plugins/router.ts
src/plugins/permission.ts
src/plugins/directives.ts
src/plugins/api.ts

❌ 不推荐
src/plugins/routerPlugin.ts  - 文件名不要加 Plugin 后缀
src/plugins/Router.ts        - 文件名应小驼峰
```

### 导出命名

```typescript
✅ 推荐
export const RouterPlugin: Plugin = { ... }
export const PermissionPlugin: Plugin = { ... }

❌ 不推荐
export const router: Plugin = { ... }          - 不够明确
export default { ... }                         - 不利于自动导入
export const routerPlugin: Plugin = { ... }    - 应使用 PascalCase
```

### 插件结构

```typescript
import type { Plugin } from 'vue';

export const XxxPlugin: Plugin = {
    install(app, options?) {
        // 1. 注册全局组件
        app.component('MyComponent', MyComponent);

        // 2. 注册全局指令
        app.directive('my-directive', { ... });

        // 3. 注册全局属性/方法
        app.config.globalProperties.$myMethod = () => { ... };

        // 4. 提供依赖注入
        app.provide('myKey', someValue);

        // 5. 执行其他初始化逻辑
        // ...
    }
};
```

## ✅ 优势总结

### 1. 零导入

```typescript
// ❌ 传统方式
import RouterPlugin from './plugins/router';
import PermissionPlugin from './plugins/permission';
import DirectivesPlugin from './plugins/directives';

app.use(RouterPlugin);
app.use(PermissionPlugin);
app.use(DirectivesPlugin);

// ✅ 自动导入方式
app.use(RouterPlugin);
app.use(PermissionPlugin);
app.use(DirectivesPlugin);
// 无需任何 import 语句！
```

### 2. 类型安全

自动生成的类型文件：

```typescript
// src/types/auto-imports.d.ts
declare global {
    const RouterPlugin: typeof import('../plugins/router')['RouterPlugin'];
    const PermissionPlugin: typeof import('../plugins/permission')['PermissionPlugin'];
    const DirectivesPlugin: typeof import('../plugins/directives')['DirectivesPlugin'];
}
```

### 3. 统一规范

-   ✅ 所有插件遵循 Vue Plugin 标准
-   ✅ 统一使用 `app.use()` 安装
-   ✅ 清晰的命名约定
-   ✅ 易于理解和维护

### 4. 灵活扩展

添加新插件只需：

1. 创建 `src/plugins/xxx.ts`
2. 导出 `export const XxxPlugin: Plugin = { ... }`
3. 在 `main.ts` 中使用 `app.use(XxxPlugin)`

## 📊 最终文件结构

```
packages/admin/
├── libs/
│   └── autoRouter.ts         # Vite 插件（构建工具）
├── src/
│   ├── plugins/              # 应用插件（运行时）
│   │   ├── router.ts         # 路由插件
│   │   ├── permission.ts     # 权限插件
│   │   ├── directives.ts     # 指令插件
│   │   └── api.ts            # API 插件
│   ├── main.ts               # 应用入口
│   └── types/
│       └── auto-imports.d.ts # 自动生成的类型定义
└── vite.config.ts            # Vite 配置
```

## 🎯 使用示例

### 在组件中使用插件功能

```vue
<template>
    <div>
        <!-- 使用权限指令 -->
        <t-button v-permission="'user:delete'">删除</t-button>

        <!-- 使用防抖指令 -->
        <t-button v-debounce="handleClick">搜索</t-button>

        <!-- 使用 Loading 指令 -->
        <div v-loading="isLoading">内容区域</div>

        <!-- 使用自动聚焦 -->
        <t-input v-focus />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isLoading = ref(false);

const handleClick = () => {
    console.log('搜索');
};

// 使用全局 API（通过 getCurrentInstance）
const instance = getCurrentInstance();
const api = instance?.appContext.config.globalProperties.$api;

// 使用全局方法
const hasPermission = instance?.appContext.config.globalProperties.$hasPermission;
</script>
```

## 🔍 自动生成的类型文件

```typescript
// src/types/auto-imports.d.ts (自动生成)
export {};
declare global {
    // Vue
    const computed: typeof import('vue')['computed'];
    const ref: typeof import('vue')['ref'];
    const reactive: typeof import('vue')['reactive'];
    const watch: typeof import('vue')['watch'];
    const onMounted: typeof import('vue')['onMounted'];
    const getCurrentInstance: typeof import('vue')['getCurrentInstance'];

    // Vue Router
    const useRouter: typeof import('vue-router')['useRouter'];
    const useRoute: typeof import('vue-router')['useRoute'];

    // Pinia
    const defineStore: typeof import('pinia')['defineStore'];
    const storeToRefs: typeof import('pinia')['storeToRefs'];

    // TDesign
    const MessagePlugin: typeof import('tdesign-vue-next')['MessagePlugin'];
    const DialogPlugin: typeof import('tdesign-vue-next')['DialogPlugin'];
    const NotifyPlugin: typeof import('tdesign-vue-next')['NotifyPlugin'];
    const LoadingPlugin: typeof import('tdesign-vue-next')['LoadingPlugin'];

    // Custom Plugins
    const RouterPlugin: typeof import('../plugins/router')['RouterPlugin'];
    const PermissionPlugin: typeof import('../plugins/permission')['PermissionPlugin'];
    const DirectivesPlugin: typeof import('../plugins/directives')['DirectivesPlugin'];
    const ApiPlugin: typeof import('../plugins/api')['ApiPlugin'];
}
```

## 💡 最佳实践

### 1. 插件依赖顺序

某些插件可能依赖其他插件，注意安装顺序：

```typescript
// main.ts
app.use(createPinia()); // 1. 状态管理（最先）
app.use(TDesign); // 2. UI 组件库
app.use(RouterPlugin); // 3. 路由（依赖 Pinia 的 store）
app.use(PermissionPlugin); // 4. 权限（依赖路由守卫）
app.use(DirectivesPlugin); // 5. 指令（独立）
app.use(ApiPlugin); // 6. API（独立）
```

### 2. 插件选项

如果插件需要配置选项：

```typescript
// src/plugins/api.ts
export const ApiPlugin: Plugin = {
    install(app, options: { baseURL?: string } = {}) {
        const api = axios.create({
            baseURL: options.baseURL || '/api',
            timeout: 10000
        });
        // ...
    }
};

// main.ts
app.use(ApiPlugin, { baseURL: '/api/v1' });
```

### 3. 插件拆分

将大型插件拆分为多个小插件：

```typescript
// ✅ 推荐：按功能拆分
src / plugins / router.ts - 路由;
src / plugins / permission.ts - 权限;
src / plugins / directives.ts - 指令;

// ❌ 不推荐：全部放在一个文件
src / plugins / common.ts - 所有功能混在一起;
```

## 🎉 总结

最终方案完美结合了：

1. ✅ **unplugin-auto-import** 的 `dirs` 自动导入
2. ✅ **Vue Plugin** 标准的 `app.use()` 安装方式
3. ✅ **TypeScript** 完整的类型支持
4. ✅ **零导入** 的开发体验

这是一个既符合 Vue 规范，又具有现代开发体验的插件系统！

---

**实施状态：** ✅ 完成
**推荐指数：** ⭐⭐⭐⭐⭐
