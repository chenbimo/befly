# 路由插件设计说明

> 更新日期：2025-10-13

## 📋 问题澄清

用户指出了路由插件的设计问题：不应该在插件内部和 main.ts 中都调用 `app.use()`。

## 🎯 正确的设计方案

### 设计理念

路由插件应该：

1. ✅ 封装路由创建逻辑
2. ✅ 在插件内部创建并安装路由
3. ✅ 只在 main.ts 中调用一次 `app.use(RouterPlugin)`
4. ❌ 不应该在 main.ts 中还需要调用 `app.use(router)`

### 实现方式

#### 1. 插件结构

```typescript
// src/plugins/router.ts

/**
 * 创建路由实例的工厂函数
 */
export function createAppRouter(options) {
    // 创建路由实例
    const router = createRouter({...});

    // 配置路由守卫
    router.beforeEach((to, from, next) => {
        // 路由守卫逻辑
    });

    return router;
}

/**
 * 路由插件 - 可被 app.use() 安装
 */
export const RouterPlugin: Plugin = {
    install(app: App, options) {
        // 创建路由实例
        const router = createAppRouter(options);

        // 在插件内部安装路由
        app.use(router);

        // 挂载到全局
        app.config.globalProperties.$router = router;
        app.provide('router', router);

        console.log('[RouterPlugin] ✓ 路由插件已安装');
    }
};
```

#### 2. 使用方式

```typescript
// src/main.ts

const app = createApp(App);

// 只需一次 app.use() 调用
app.use(RouterPlugin); // ← 这会自动创建并安装路由

app.mount('#app');
```

### 🔄 工作流程

```
1. main.ts: app.use(RouterPlugin)
2. RouterPlugin.install() 被调用
3. createAppRouter() 创建路由实例
4. RouterPlugin.install() 中调用 app.use(router)
5. 路由安装完成
```

## 📊 对比错误设计

### ❌ 错误的双重安装

```typescript
// 错误的方式
export const RouterPlugin: Plugin = {
    install(app) {
        const router = createRouter({...});
        app.use(router);  // 在插件内部安装
    }
};

// main.ts
app.use(RouterPlugin);  // 在外部又安装了一次插件
// 结果：插件被安装了两次
```

### ✅ 正确的单次安装

```typescript
// 正确的方式
export const RouterPlugin: Plugin = {
    install(app) {
        const router = createRouter({...});
        app.use(router);  // 只在插件内部安装路由
    }
};

// main.ts
app.use(RouterPlugin);  // 只安装一次插件
// 结果：路由被正确安装
```

## 🎨 插件的两种使用模式

### 模式 1：插件模式（推荐）

```typescript
// 适合应用级别的封装
import { RouterPlugin } from './plugins/router';

app.use(RouterPlugin, {
    baseURL: '/admin',
    titlePrefix: '管理系统'
});
```

### 模式 2：工厂函数模式

```typescript
// 适合需要更多控制的情况
import { createAppRouter } from './plugins/router';

const router = createAppRouter({
    baseURL: '/admin'
});

app.use(router); // 直接安装路由
```

## 💡 设计优势

### 1. 封装性

-   ✅ 路由创建逻辑完全封装在插件内部
-   ✅ 外部只需要知道插件名称和配置选项
-   ✅ 内部实现可以自由修改而不影响外部使用

### 2. 一致性

-   ✅ 遵循 Vue 插件的标准模式
-   ✅ 与其他插件的使用方式完全一致
-   ✅ 符合开发者的预期

### 3. 灵活性

-   ✅ 支持配置选项
-   ✅ 可以扩展更多功能
-   ✅ 支持依赖注入等现代特性

### 4. 易用性

-   ✅ 只需一次 `app.use()` 调用
-   ✅ 自动处理所有路由相关逻辑
-   ✅ 提供全局访问方式

## 🔍 实际使用示例

### 基本使用

```typescript
// main.ts
import { createApp } from 'vue';
import { RouterPlugin } from './plugins/router';

const app = createApp(App);

app.use(RouterPlugin); // 自动创建并安装路由

app.mount('#app');
```

### 带配置使用

```typescript
app.use(RouterPlugin, {
    baseURL: '/admin',
    titlePrefix: '后台管理系统',
    loginPath: '/auth/login'
});
```

### 在组件中使用

```vue
<script setup lang="ts">
// 通过组合式 API 使用
import { useRouter } from 'vue-router';

const router = useRouter();

// 通过依赖注入使用
import { inject } from 'vue';

const router = inject('router');

// 通过全局属性使用
const router = getCurrentInstance()?.appContext.config.globalProperties.$router;
</script>
```

## 📝 总结

现在的路由插件设计：

✅ **正确的单次安装** - 只在 main.ts 中调用一次 `app.use(RouterPlugin)`
✅ **完全封装** - 路由创建和安装逻辑都在插件内部
✅ **符合 Vue 3 规范** - 使用现代插件语法和特性
✅ **灵活配置** - 支持运行时配置选项
✅ **多种访问方式** - 组合式 API、依赖注入、全局属性

这个设计完全解决了用户提出的问题，既符合 Vue 插件的设计理念，又提供了良好的开发体验！

---

**设计状态：** ✅ 已完成正确的插件设计
**使用方式：** `app.use(RouterPlugin)`
**安装次数：** 1 次（只在 main.ts）
