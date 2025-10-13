# Export Default 使用规范

## 修改日期

2025-10-11

## 原则

**尽可能使用具名导出（Named Exports），仅在框架强制要求时使用默认导出（Default Export）**

## 必须使用 `export default` 的情况

### 1. API 接口文件 ⚠️ **强制要求**

**位置**：

-   `core/apis/**/*.ts`
-   `tpl/apis/**/*.ts` (用户项目)

**原因**：
Befly 的 API 加载器（`lifecycle/loader.ts` 第 196 行）通过 `(await import(file)).default` 动态加载 API 处理器，必须使用默认导出。

**示例**：

```typescript
// ✅ 正确 - 必须使用 export default
export default Api.POST(
    '用户登录',
    false,
    {
        /* 字段定义 */
    },
    ['username', 'password'],
    async (befly: BeflyContext, ctx: RequestContext) => {
        // 处理逻辑
    }
);
```

**适用文件**：

-   `core/apis/health/info.ts`
-   `core/apis/tool/tokenCheck.ts`
-   `tpl/apis/user/login.ts`
-   `tpl/apis/user/list.ts`
-   `tpl/apis/article/create.ts`
-   `tpl/apis/article/list.ts`
-   `tpl/apis/test/hi.ts`

### 2. 插件文件 ⚠️ **强制要求**

**位置**：

-   `core/plugins/*.ts`
-   `tpl/plugins/*.ts` (用户项目)

**原因**：
插件加载器（`lifecycle/loader.ts` 第 48 行）通过 `plugin.default` 访问插件实例，必须使用默认导出。

**示例**：

```typescript
// ✅ 正确 - 必须使用 export default
const myPlugin: Plugin = {
    pluginName: 'my-plugin',
    version: '1.0.0',
    onInit: async (ctx) => {
        // 初始化逻辑
        return {};
    }
};

export default myPlugin;
```

**适用文件**：

-   `core/plugins/db.ts`
-   `core/plugins/logger.ts`
-   `core/plugins/redis.ts`
-   `core/plugins/tool.ts`

## 应该使用具名导出的情况

### 1. 工具类和配置对象 ✅ **推荐**

**原因**：

-   更好的 IDE 支持和自动补全
-   明确的导入语义
-   支持 Tree Shaking
-   可以同时导出多个成员

**示例**：

```typescript
// ✅ 推荐 - 使用具名导出
export class Crypto2 {
    static md5(data: string): string {
        /* ... */
    }
}

export const Env = {
    NODE_ENV: process.env.NODE_ENV || 'development'
};

// 导入时
import { Crypto2, Env } from './utils';
```

### 2. 类型定义 ✅ **推荐**

**原因**：

-   TypeScript 类型系统的最佳实践
-   支持批量导入

**示例**：

```typescript
// ✅ 推荐
export interface User {
    id: number;
    username: string;
}

export type UserRole = 'admin' | 'user';

// 导入时
import type { User, UserRole } from './types';
```

### 3. 常量和变量 ✅ **推荐**

**示例**：

```typescript
// ✅ 推荐
export const API_VERSION = '3.0.0';
export const DEFAULT_PORT = 3000;
```

## 已修改的文件

### `core/system.ts` ✅ 已修改

**修改前**：

```typescript
const system = {
    /* ... */
};
export default system;
export { __filename, __dirname };
```

**修改后**：

```typescript
const system = {
    /* ... */
};
export { __filename, __dirname, system };
```

**影响**：

-   ✅ 无破坏性更改（所有现有代码都使用具名导入）
-   ✅ 更符合最佳实践

## 总结统计

| 类型      | 数量 | 状态              | 原因                  |
| --------- | ---- | ----------------- | --------------------- |
| API 文件  | 7 个 | ⚠️ 必须保留       | 框架加载器要求        |
| 插件文件  | 4 个 | ⚠️ 必须保留       | 框架加载器要求        |
| system.ts | 1 个 | ✅ 已改为具名导出 | 无使用 default import |

## 开发建议

1. **新建 API 文件**：必须使用 `export default Api.POST/GET/...`
2. **新建插件文件**：必须使用 `export default plugin`
3. **新建工具类**：使用 `export class/const/function`
4. **新建类型文件**：使用 `export type/interface`
5. **代码审查**：检查是否误用了 `export default`

## 参考资源

-   [TypeScript 官方文档 - Modules](https://www.typescriptlang.org/docs/handbook/modules.html)
-   [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html#exports)
-   [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript#modules)

## 验证

运行以下命令验证没有错误：

```bash
# TypeScript 类型检查
bun run type-check

# 启动框架测试
cd tpl && bun main.ts
```

✅ 所有修改已完成，框架功能正常
