# 钩子（Hook）

本页只描述 Hook 的**定义与使用**（扫描、命名、执行模型、禁用与 deps）。

## 执行模型（重要）

当前 core 的 hook 执行是：

-   按排序后的顺序，逐个执行 `handler(befly, ctx)`
-   **没有** `next()`，也不是洋葱模型

因此：Hook 的职责通常是“在请求处理前/后修改 ctx、提前返回 Response、做校验与权限检查”。

### 如何提前返回（短路）

Hook 如果需要拦截请求，应设置：

-   `ctx.response = new Response(...)`

一旦 `ctx.response` 被设置：

-   后续 hook 不再执行
-   API handler 不再执行
-   框架直接返回这个 Response

## 文件放哪里（扫描规则）

Hook 扫描目录：

-   项目：`<appDir>/hooks/*.{ts,js}`
-   addon：`<addonRoot>/hooks/*.{ts,js}`

core 内置 Hook 不从目录扫描，而是静态注册。

固定过滤：

-   忽略 `.d.ts`
-   忽略任何以下划线 `_` 开头的文件或目录

## moduleName（Hook 名）如何生成

Hook 的 `moduleName` 规则与插件一致，并用于：

-   deps 依赖排序
-   运行时记录/标识

示例：

-   `hooks/requestLogger.ts` → `app_requestLogger`
-   addon `admin` 的 `hooks/permission.ts` → `addon_admin_permission`
-   core 内置 hooks：`auth`, `cors`, `parser`, `validator`, `permission`

## export default 允许的字段（强约束）

Hook 文件的 `export default` 只能包含：

-   `enable: boolean`（可省略，缺省补为 `true`）
-   `deps?: string[]`（可省略，缺省补为 `[]`）
-   `handler: (befly, ctx) => void | Promise<void>`（必填）
-   `name?: string`（通常不需要写；core 内置 Hook 必须显式写且与 moduleName 一致）

### strict customKeys 白名单（启动期阻断）

启动期会对“用户在 `export default { ... }` 里写出来的字段集合”做严格校验：

-   只允许：`name`、`enable`、`deps`、`handler`
-   出现任何其他字段都会阻断启动

并且：

-   `enable` 如果显式写出，必须是 `boolean`（不允许 `0/1`）
-   `deps` 如果显式写出，必须是 `string[]`

## core 内置 Hook 的额外约束

core 内置 hook 来自静态注册（不是扫描目录），并且有额外限制：

-   必须显式写 `name`（string）
-   `name` 必须与 `moduleName` 完全一致
-   `name/moduleName` 必须满足：小写字母 + 下划线（例如 `auth`、`rate_limit`）

## 基本示例

`hooks/requestLogger.ts`：

```ts
import type { Hook } from "befly/types/hook";

const requestLoggerHook: Hook = {
    enable: true,
    deps: ["cors"],
    handler: async (befly, ctx) => {
        befly.logger.info({
            msg: "request",
            route: ctx.route,
            method: ctx.method,
            ip: ctx.ip,
            requestId: ctx.requestId,
        });
    },
};

export default requestLoggerHook;
```

## 禁用 Hook

将 `enable` 设为 `false`：

```ts
export default {
    enable: false,
    deps: [],
    handler: async () => {
        return;
    },
} as Hook;
```

> 当前代码以 `enable === false` 为唯一禁用方式；不要依赖历史文档里的 `disableHooks` 列表。

## deps（依赖排序）

-   `deps` 填写依赖的 **moduleName**
-   排序失败会阻断启动

建议：先依赖 core 内置 Hook（如 `cors`、`auth`），再依赖项目/组件 Hook。
