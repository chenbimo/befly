# Befly 框架类型系统修复 - 变更记录

> 日期: 2025-10-11
> 类型: Bug Fix (P0)
> 影响: 类型定义与实现一致性

---

## 变更摘要

修复了 Befly 框架核心类型定义与实际实现不一致的问题,恢复了 TypeScript 类型系统的完整功能。

---

## 详细变更

### 1. checker.ts - 移除未使用的参数

**文件**: `core/lifecycle/checker.ts`

**变更**:

```diff
- import type { BeflyContext } from '../types/befly.js';

- static async run(appContext: BeflyContext): Promise<void> {
+ static async run(): Promise<void> {

- const checkResult = await checkFn(appContext);
+ const checkResult = await checkFn();
```

**原因**: 检查函数实际不需要 appContext 参数

---

### 2. plugin.d.ts - 重写插件接口定义

**文件**: `core/types/plugin.d.ts`

**变更**:

```diff
- export type PluginRegisterFunction = (befly: Befly) => Promise<void> | void;
+ export type PluginInitFunction = (befly: BeflyContext) => Promise<any> | any;
+ export type PluginGetHook = (befly: BeflyContext, ctx: any, req: Request) => Promise<void> | void;

export interface Plugin {
    name: string;
-   order: number;
-   register: PluginRegisterFunction;
-   dependencies?: string[];
+   pluginName?: string;
+   after?: string[];
+   onInit?: PluginInitFunction;
+   onGet?: PluginGetHook;
    description?: string;
    version?: string;
    author?: string;
}

- executeAll(befly: Befly): Promise<void>;
+ executeAll(befly: BeflyContext): Promise<void>;
```

**原因**:

-   实际插件使用 `onInit` 而非 `register`
-   使用 `after` 而非 `dependencies`
-   添加了 `onGet` 钩子支持

---

### 3. api.d.ts - 统一字段命名

**文件**: `core/types/api.d.ts`

**变更**:

```diff
- import type { Befly } from './befly.js';
- import type { KeyValue } from './common.js';
+ import type { BeflyContext } from './befly.js';
+ import type { KeyValue, TableDefinition } from './common.js';

- export type ApiHandler = (befly: Befly, ctx: RequestContext) => Promise<Response | R>;
+ export type ApiHandler = (befly: BeflyContext, ctx: any, req?: Request) => Promise<Response | R> | Response | R;

export interface ApiRoute {
    method: HttpMethod;
-   path: string;
-   description: string;
-   auth: AuthType;
-   rules: KeyValue<string>;
+   name: string;
+   route?: string;
+   auth: boolean | string | string[];
+   fields: TableDefinition;
    required: string[];
    handler: ApiHandler;
}
```

**原因**:

-   实际使用 `fields` 而非 `rules`
-   使用 `name` 而非 `description`
-   `route` 是运行时生成的
-   简化了 `auth` 类型

---

## 破坏性变更

### ❌ 无破坏性变更

所有修改都是使类型定义与现有实现保持一致,不影响任何现有代码。

---

## 迁移指南

### 不需要迁移

如果你的代码已经能够正常运行,则无需任何修改。这些变更只是修正了类型定义。

### 新项目建议

如果你正在创建新的插件或 API:

**插件开发**:

```typescript
// ✅ 推荐写法
const myPlugin: Plugin = {
    name: 'myPlugin',
    after: ['_db', '_redis'], // 而非 dependencies
    async onInit(befly) {
        // 而非 register
        return {
            /* plugin exports */
        };
    },
    async onGet(befly, ctx, req) {
        // 请求钩子
    }
};

export default myPlugin;
```

**API 开发**:

```typescript
// ✅ 推荐写法
export default Api.POST(
    '接口名称',
    false,
    {
        username: '用户名⚡string⚡2⚡20', // fields 字段
        email: '邮箱⚡string⚡0⚡100'
    },
    ['username'],
    async (befly, ctx) => {
        // 处理逻辑
    }
);
```

---

## 测试验证

### 类型检查

```bash
# 运行 TypeScript 编译检查
cd core
bun run tsc --noEmit
```

### 功能测试

```bash
# 运行测试套件
bun test
```

---

## 相关文档

-   [架构分析报告](./core-architecture-analysis.md)
-   [P0 修复总结](./p0-fixes-summary.md)

---

## 贡献者

-   GitHub Copilot (AI 辅助)
-   基于代码审查和架构分析

---

## 下一步计划

1. ✅ P0 级别问题已修复
2. ⏳ P1 级别: 重构中间件系统
3. ⏳ P2 级别: 代码优化和去重
4. ⏳ P3 级别: 性能优化和测试补充

---

## 版本信息

-   **修复版本**: 当前版本
-   **影响范围**: `core/` 目录
-   **兼容性**: 完全向后兼容
-   **建议操作**: 立即更新并测试

---

## 问题反馈

如果发现任何问题,请:

1. 检查 TypeScript 编译错误
2. 查看运行时日志
3. 对比本变更记录
4. 提交 Issue 或 PR
