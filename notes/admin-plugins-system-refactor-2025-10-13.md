# Admin 插件系统重构记录

> 执行日期：2025-10-13

## 📋 变更概述

将路由配置从独立目录改为插件化管理，实现 `src/plugins` 目录下的插件自动加载机制。

## 🔄 目录结构变更

### 变更前

```
packages/admin/src/
├── router/
│   └── index.ts          ← 路由配置
├── main.ts
└── ...
```

### 变更后

```
packages/admin/src/
├── plugins/
│   └── router.ts         ← 路由插件
├── main.ts               ← 自动加载插件
└── ...
```

## 📝 文件变更详情

### 1. 创建 `src/plugins/router.ts`

**改造方式：** 将路由配置改为 Vue 插件格式

```typescript
import type { App } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';

export default {
    install(app: App) {
        // 创建路由实例
        const router = createRouter({
            history: createWebHistory(import.meta.env.BASE_URL),
            routes: autoRoutes
        });

        // 路由守卫
        router.beforeEach((to, from, next) => {
            // 设置页面标题
            if (to.meta.title) {
                document.title = `${to.meta.title} - Befly Admin`;
            }

            // 登录验证
            const token = localStorage.getItem('token');
            if (!to.meta.public && !token) {
                next('/login');
            } else {
                next();
            }
        });

        // 安装路由
        app.use(router);
    }
};
```

**关键变化：**

-   ✅ 从直接导出 router 改为导出 Vue 插件对象
-   ✅ 将路由安装逻辑封装在 `install` 方法中
-   ✅ 保持原有的路由守卫逻辑不变

### 2. 更新 `src/main.ts`

**改造方式：** 使用 `import.meta.glob` 自动加载 plugins 目录

```typescript
import type { Plugin } from 'vue';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';

// 引入 TDesign 样式
import 'tdesign-vue-next/es/style/index.css';

// 引入全局样式
import './styles/index.css';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());
app.use(TDesign);

// 自动加载并安装 plugins 目录下的所有插件
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

app.mount('#app');
```

**关键变化：**

-   ✅ 移除 `import router from './router'`
-   ✅ 使用 `import.meta.glob` 自动扫描 `./plugins/*.ts`
-   ✅ 设置 `eager: true` 实现同步加载
-   ✅ 自动验证插件格式（必须有 `install` 方法）
-   ✅ 添加加载日志便于调试

### 3. 删除 `src/router/` 目录

```bash
# 已删除
src/router/
└── index.ts
```

## 🎯 插件系统规范

### 插件文件规范

所有插件文件必须遵循以下规范：

```typescript
import type { App } from 'vue';

export default {
    install(app: App) {
        // 插件初始化逻辑
    }
};
```

### 插件加载规则

1. **位置：** 必须放在 `src/plugins/` 目录下
2. **扩展名：** 必须是 `.ts` 文件
3. **导出：** 必须使用 `export default` 导出插件对象
4. **格式：** 插件对象必须包含 `install(app: App)` 方法
5. **加载：** 所有插件会在应用启动时自动加载

### 插件执行顺序

```
1. 创建 Vue 应用实例
2. 安装 Pinia（状态管理）
3. 安装 TDesign（UI 组件库）
4. 自动加载并安装 plugins 目录下的所有插件
   - router.ts（路由插件）
   - ...（其他插件）
5. 挂载应用
```

## ✅ 优势分析

### 1. 模块化管理

**改造前：**

```typescript
// main.ts 中混杂各种导入
import router from './router';
import someModule from './someModule';
// ... 越来越多的导入
```

**改造后：**

```typescript
// main.ts 只需一行自动加载
const pluginModules = import.meta.glob('./plugins/*.ts', { eager: true });
```

### 2. 扩展性强

**添加新插件只需两步：**

1. 创建插件文件 `src/plugins/xxx.ts`
2. 导出符合规范的插件对象

**无需修改任何其他文件！**

### 3. 统一规范

所有功能模块都遵循 Vue 插件规范：

-   ✅ 统一的 `install` 方法
-   ✅ 统一的初始化流程
-   ✅ 统一的加载机制

### 4. 调试友好

```
[Plugins] ✓ 已加载: ./plugins/router.ts
[Plugins] ✓ 已加载: ./plugins/permission.ts
[Plugins] ✓ 已加载: ./plugins/directive.ts
```

清晰的日志输出，便于追踪插件加载情况。

## 📚 使用示例

### 示例 1：创建权限插件

```typescript
// src/plugins/permission.ts
import type { App } from 'vue';

export default {
    install(app: App) {
        // 全局权限指令
        app.directive('permission', {
            mounted(el, binding) {
                const permissions = localStorage.getItem('permissions');
                if (!permissions?.includes(binding.value)) {
                    el.remove();
                }
            }
        });

        console.log('[Permission] 权限插件已加载');
    }
};
```

**使用方式：**

```vue
<template>
    <t-button v-permission="'user:delete'">删除</t-button>
</template>
```

### 示例 2：创建全局指令插件

```typescript
// src/plugins/directives.ts
import type { App } from 'vue';

export default {
    install(app: App) {
        // 自动聚焦指令
        app.directive('focus', {
            mounted(el) {
                el.focus();
            }
        });

        // 防抖指令
        app.directive('debounce', {
            mounted(el, binding) {
                let timer: number;
                el.addEventListener('click', () => {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => {
                        binding.value();
                    }, 300);
                });
            }
        });

        console.log('[Directives] 指令插件已加载');
    }
};
```

### 示例 3：创建 API 插件

```typescript
// src/plugins/api.ts
import type { App } from 'vue';
import axios from 'axios';

export default {
    install(app: App) {
        // 创建 axios 实例
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
                console.error('[API] 请求失败:', error);
                return Promise.reject(error);
            }
        );

        // 挂载到全局属性
        app.config.globalProperties.$api = api;

        console.log('[API] API 插件已加载');
    }
};
```

## 🔍 验证方法

### 1. 检查文件结构

```bash
# 确认 plugins 目录
ls packages/admin/src/plugins/

# 应该看到：
# router.ts
```

### 2. 启动开发服务器

```bash
cd packages/admin
bunx vite
```

### 3. 查看控制台日志

应该看到类似输出：

```
[Plugins] ✓ 已加载: ./plugins/router.ts
```

### 4. 测试路由功能

-   访问 `/login` - 应该正常显示登录页
-   访问 `/dashboard` - 如果未登录应该重定向到 `/login`
-   登录后访问 `/dashboard` - 应该正常显示

## 📊 对比总结

| 特性         | 改造前            | 改造后                 |
| ------------ | ----------------- | ---------------------- |
| **目录**     | `src/router/`     | `src/plugins/` ✅      |
| **文件**     | `router/index.ts` | `plugins/router.ts` ✅ |
| **导入方式** | 手动导入          | 自动加载 ✅            |
| **扩展性**   | 需修改 main.ts    | 只需添加文件 ✅        |
| **规范性**   | 无统一规范        | Vue 插件规范 ✅        |
| **调试性**   | 无日志            | 自动日志 ✅            |

## 🎯 后续规划

### 可以添加的插件

1. **权限插件** (`plugins/permission.ts`)

    - 全局权限指令
    - 权限检查方法

2. **指令插件** (`plugins/directives.ts`)

    - 常用自定义指令
    - 如 v-loading, v-debounce 等

3. **API 插件** (`plugins/api.ts`)

    - 封装 axios
    - 统一请求/响应处理

4. **WebSocket 插件** (`plugins/websocket.ts`)

    - WebSocket 连接管理
    - 消息推送

5. **埋点插件** (`plugins/analytics.ts`)
    - 用户行为追踪
    - 数据上报

## 💡 最佳实践

### 1. 插件命名

```
✅ 推荐
router.ts         - 路由插件
permission.ts     - 权限插件
directives.ts     - 指令插件

❌ 不推荐
routerPlugin.ts   - 冗余后缀
myRouter.ts       - 不够规范
```

### 2. 插件职责

每个插件应该：

-   ✅ 单一职责
-   ✅ 独立功能
-   ✅ 可选加载
-   ❌ 避免相互依赖

### 3. 错误处理

```typescript
export default {
    install(app: App) {
        try {
            // 插件逻辑
        } catch (error) {
            console.error('[PluginName] 加载失败:', error);
        }
    }
};
```

## 📝 相关文件

-   ✅ `src/plugins/router.ts` - 路由插件（新建）
-   ✅ `src/main.ts` - 应用入口（已更新）
-   ❌ `src/router/` - 路由目录（已删除）
-   ❌ `src/plugins/index.ts` - 插件索引（已删除，改用自动加载）

---

**实施状态：** ✅ 完成
**测试状态：** 待测试
**影响范围：** 路由系统重构
