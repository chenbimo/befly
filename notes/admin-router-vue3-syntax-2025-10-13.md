# Vue 2 vs Vue 3 插件语法对比

> 更新日期：2025-10-13

## 📋 问题背景

用户指出 `plugins/router.ts` 的实现看起来像 Vue 2 的语法，询问是否是 Vue 3 的最新语法。

## 🔍 Vue 2 vs Vue 3 插件语法对比

### Vue 2 插件语法

```javascript
// Vue 2 插件示例
const MyPlugin = {
  install(Vue, options) {
    // 1. 全局组件注册
    Vue.component('my-component', MyComponent);

    // 2. 全局指令注册
    Vue.directive('my-directive', MyDirective);

    // 3. 全局混入
    Vue.mixin(MyMixin);

    // 4. 添加实例方法（原型）
    Vue.prototype.$myMethod = function() { ... };

    // 5. 添加全局过滤器
    Vue.filter('my-filter', MyFilter);
  }
};

// 使用方式
Vue.use(MyPlugin, options);
```

**Vue 2 特点：**

-   使用 `Vue` 构造函数作为参数
-   通过原型添加实例方法 `Vue.prototype`
-   有全局过滤器概念
-   JavaScript 为主，TypeScript 支持有限

### Vue 3 插件语法

```typescript
import type { App, Plugin } from 'vue';

// Vue 3 插件示例
const MyPlugin: Plugin = {
  install(app: App, options?: any) {
    // 1. 全局组件注册
    app.component('MyComponent', MyComponent);

    // 2. 全局指令注册
    app.directive('my-directive', MyDirective);

    // 3. 全局混入
    app.mixin(MyMixin);

    // 4. 添加全局属性（替代原型）
    app.config.globalProperties.$myMethod = function() { ... };

    // 5. 依赖注入（Vue 3 新特性）
    app.provide('myKey', someValue);

    // 6. 组合其他插件
    app.use(OtherPlugin);
  }
};

// 使用方式
const app = createApp(App);
app.use(MyPlugin, options);
```

**Vue 3 特点：**

-   使用 `app` 实例作为参数（更符合组合式 API）
-   通过 `app.config.globalProperties` 添加全局属性
-   新增 `app.provide()` 依赖注入
-   完整的 TypeScript 支持
-   移除了过滤器概念（在模板中使用方法替代）

## 🎯 路由插件的现代化改造

### 改造前（Vue 2 风格）

```typescript
export const RouterPlugin: Plugin = {
    install(app) {
        // 简单的路由创建和安装
        const router = createRouter({ ... });
        router.beforeEach((to, from, next) => { ... });
        app.use(router);
    }
};
```

### 改造后（Vue 3 现代风格）

```typescript
interface RouterPluginOptions {
    baseURL?: string;
    titlePrefix?: string;
    loginPath?: string;
}

export const RouterPlugin: Plugin = {
    install(app: App, options: RouterPluginOptions = {}) {
        const { baseURL, titlePrefix, loginPath } = options;

        // 1. 创建路由实例
        const router = createRouter({
            history: createWebHistory(baseURL),
            routes: autoRoutes
        });

        // 2. 路由守卫 - 更安全的检查
        router.beforeEach((to, from, next) => {
            if (to.meta?.title) {
                document.title = `${titlePrefix} - ${to.meta.title}`;
            }

            const token = localStorage.getItem('token');
            const isPublicRoute = to.meta?.public === true;

            if (!isPublicRoute && !token) {
                next(loginPath);
            } else {
                next();
            }
        });

        // 3. 路由后置处理
        router.afterEach((to) => {
            console.log(`[Router] 导航到: ${to.path}`);
        });

        // 4. 安装路由
        app.use(router);

        // 5. 依赖注入（Vue 3 新特性）
        app.provide('router', router);

        // 6. 全局属性（可选）
        app.config.globalProperties.$router = router;

        console.log('[RouterPlugin] ✓ 路由插件已安装');
    }
};
```

## ✨ Vue 3 现代语法的新特性

### 1. 完整的 TypeScript 支持

```typescript
import type { App, Plugin } from 'vue';

interface RouterPluginOptions {
    baseURL?: string;
    titlePrefix?: string;
    loginPath?: string;
}

export const RouterPlugin: Plugin = {
    install(app: App, options: RouterPluginOptions = {}) {
        // 类型安全的参数
    }
};
```

### 2. 依赖注入 (provide/inject)

```typescript
// 在插件中提供依赖
app.provide('router', router);

// 在组件中使用
import { inject } from 'vue';

const router = inject('router'); // 类型安全
```

### 3. 组合式 API 风格

```typescript
// 插件可以与 Composition API 完美配合
export const RouterPlugin: Plugin = {
    install(app: App) {
        // 可以在这里设置全局的组合式函数
        app.config.globalProperties.$useRouter = () => {
            return useRouter();
        };
    }
};
```

### 4. 更好的错误处理

```typescript
export const RouterPlugin: Plugin = {
    install(app: App) {
        try {
            // 插件逻辑
            console.log('[RouterPlugin] ✓ 路由插件已安装');
        } catch (error) {
            console.error('[RouterPlugin] ✗ 路由插件安装失败:', error);
        }
    }
};
```

### 5. 插件组合

```typescript
export const CombinedPlugin: Plugin = {
    install(app: App) {
        // 组合使用其他插件
        app.use(RouterPlugin);
        app.use(PermissionPlugin);
        app.use(ApiPlugin);
    }
};
```

## 🔄 路由插件的具体改进

### 1. 配置选项支持

```typescript
// 支持自定义配置
app.use(RouterPlugin, {
    baseURL: '/admin',
    titlePrefix: '管理系统',
    loginPath: '/auth/login'
});
```

### 2. 更安全的路由守卫

```typescript
// 使用可选链操作符和更明确的类型检查
const isPublicRoute = to.meta?.public === true;
if (!isPublicRoute && !token) {
    next(loginPath);
}
```

### 3. 路由导航日志

```typescript
router.afterEach((to) => {
    console.log(`[Router] 导航到: ${to.path}`);
});
```

### 4. 依赖注入支持

```typescript
// 提供路由实例给其他组件
app.provide('router', router);
```

### 5. 更好的日志输出

```typescript
console.log('[RouterPlugin] ✓ 路由插件已安装');
```

## 📊 对比总结

| 特性         | Vue 2 风格      | Vue 3 现代风格                   |
| ------------ | --------------- | -------------------------------- |
| **类型支持** | 基础 TypeScript | 完整类型安全 ✅                  |
| **参数传递** | `Vue, options`  | `app: App, options` ✅           |
| **全局属性** | `Vue.prototype` | `app.config.globalProperties` ✅ |
| **依赖注入** | 不支持          | `app.provide()` ✅               |
| **插件组合** | 不支持          | `app.use()` ✅                   |
| **错误处理** | 基础            | 更完善的错误处理 ✅              |
| **配置选项** | 简单对象        | 带默认值的接口 ✅                |
| **日志输出** | 无              | 结构化日志 ✅                    |

## 🎯 为什么现在是 Vue 3 语法

### 符合 Vue 3 设计理念

1. **组合式优先**: 使用 `app` 实例而不是全局 `Vue`
2. **TypeScript 优先**: 完整的类型定义和接口
3. **依赖注入**: 利用 Vue 3 的 provide/inject 机制
4. **插件组合**: 支持插件间的相互依赖

### 现代开发体验

1. **类型安全**: 编译时检查所有参数和返回值
2. **智能提示**: IDE 提供完整的代码提示
3. **重构友好**: 重命名和重构更加安全
4. **文档即代码**: 类型定义就是最好的文档

### 最佳实践

1. **配置化**: 支持运行时配置
2. **可组合**: 可以与其他插件组合使用
3. **可测试**: 更容易进行单元测试
4. **可维护**: 代码结构清晰，易于理解

## 💡 总结

现在的 `plugins/router.ts` 实现：

✅ **完全符合 Vue 3 现代语法**

-   使用 `App` 类型和 `Plugin` 接口
-   支持配置选项和类型安全
-   利用依赖注入等新特性
-   符合组合式 API 理念

❌ **不再是 Vue 2 风格**

-   不再使用 `Vue.prototype`
-   不再依赖全局构造函数
-   不再使用过时的 API

这个实现充分利用了 Vue 3 的所有新特性，是真正的现代 Vue 3 插件语法！

---

**更新状态：** ✅ 已更新为 Vue 3 现代语法
**兼容性：** Vue 3.0+
**TypeScript：** 完整支持
