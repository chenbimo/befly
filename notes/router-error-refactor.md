# Router Error 文件重构记录

## 重构时间

2025-10-11

## 重构原因

`core/router/error.ts` 文件存在以下问题：

1. **文件过小**：只有 1 个函数，仅 20 行代码（包括注释）
2. **使用单一**：只在 `bootstrap.ts` 中被引用 1 次
3. **职责简单**：仅记录错误日志并返回统一的错误响应
4. **性价比低**：相比其他 router 文件（api.ts 115 行、static.ts 47 行、root.ts 30 行），error.ts 过于简单

## 重构方案

采用 **方案 1：直接内联到 `bootstrap.ts`**

### 为什么选择这个方案？

1. ✅ `errorHandler` 只在 `bootstrap.ts` 中使用 1 次，直接内联最简洁
2. ✅ 减少文件数量，降低项目复杂度
3. ✅ 错误处理逻辑简单，不需要单独抽取
4. ✅ 内联后代码更紧凑，易于理解

## 重构内容

### 第一步：合并到 bootstrap.ts（作为函数）

**修改前：**

```typescript
// router/error.ts
export function errorHandler(error: Error): Response {
    Logger.error({
        msg: '服务启动时发生错误',
        error: error.message,
        stack: error.stack
    });
    return Response.json(No('内部服务器错误'));
}

// bootstrap.ts
import { errorHandler } from '../router/error.js';

const server = Bun.serve({
    // ...
    error: errorHandler
});
```

**修改后：**

```typescript
// bootstrap.ts
function errorHandler(error: Error): Response {
    Logger.error({
        msg: '服务启动时发生错误',
        error: error.message,
        stack: error.stack
    });
    return Response.json(No('内部服务器错误'));
}

const server = Bun.serve({
    // ...
    error: errorHandler
});
```

### 第二步：进一步优化，直接内联

**最终版本：**

```typescript
// bootstrap.ts
const server = Bun.serve({
    port: Env.APP_PORT,
    hostname: Env.APP_HOST,
    routes: {
        '/': rootHandler,
        '/api/*': apiHandler(befly.apiRoutes, befly.pluginLists, befly.appContext),
        '/*': staticHandler,
        ...(befly.appOptions.routes || {})
    },
    error: (error: Error) => {
        Logger.error({
            msg: '服务启动时发生错误',
            error: error.message,
            stack: error.stack
        });
        return Response.json(No('内部服务器错误'));
    }
});
```

### 删除文件

`core/router/error.ts` 文件已被完全删除。

## 重构前后对比

### 文件结构

**重构前：**

```
core/
  router/
    api.ts       (115 行)
    error.ts     (20 行)  ← 被删除
    root.ts      (30 行)
    static.ts    (47 行)
  lifecycle/
    bootstrap.ts (62 行)
```

**重构后：**

```
core/
  router/
    api.ts       (115 行)
    root.ts      (30 行)
    static.ts    (47 行)
  lifecycle/
    bootstrap.ts (75 行)  ← errorHandler 合并进来
```

### 代码行数变化

-   `router/error.ts`: 20 行 → **删除**
-   `bootstrap.ts`: 62 行 → **66 行**（+4 行）
-   **净减少**: 16 行代码
-   **减少文件**: 1 个

## 优势总结

1. **更简洁**：减少了 1 个文件，降低项目复杂度
2. **更内聚**：错误处理逻辑与使用它的地方在一起
3. **更易维护**：不需要在多个文件间跳转
4. **保持灵活**：未来如果需要在其他地方使用，再提取也很容易

## 测试结果

-   ✅ 所有 81 个测试通过
-   ✅ 功能完全正常
-   ✅ 没有引入任何问题

## 影响范围

-   ✅ `core/lifecycle/bootstrap.ts` - 已更新
-   ✅ `core/router/error.ts` - 已删除
-   ✅ 所有测试通过
-   ✅ 无其他文件受影响

## 后续建议

这次重构体现了一个重要原则：**不要为了"职责单一"而过度拆分文件**。

### 何时应该独立文件？

✅ **应该独立**：

-   代码量较大（50+ 行实际代码）
-   在多个地方被使用
-   有独立的扩展需求
-   有复杂的业务逻辑

❌ **不应该独立**：

-   代码量很小（< 30 行）
-   只在一个地方使用
-   逻辑非常简单
-   与调用者紧密耦合

### 类似场景

如果项目中还有类似的"过小文件"，也可以考虑合并：

1. 检查文件大小和使用频率
2. 评估与调用者的耦合度
3. 权衡独立性和简洁性
4. 做出合理的重构决策

## 相关文档

-   `core/lifecycle/bootstrap.ts` - 服务启动引导器
-   `core/router/` 目录 - 路由处理器集合
-   `notes/` 目录 - 项目重构记录
