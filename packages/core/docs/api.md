# 接口（API）

本页描述 API 的**定义方式**、**路由路径生成规则**与**RequestContext 用法**。

## 文件放哪里（扫描规则）

API 只从以下目录扫描（支持 `.ts/.js`，但推荐使用 `.ts`）：

-   项目：`<appDir>/apis/**/*.{ts,js}`
-   组件（addon）：`<addonRoot>/apis/**/*.{ts,js}`

固定过滤：

-   忽略 `.d.ts`
-   忽略任何以下划线 `_` 开头的文件或目录

## 路由路径如何生成

对每个 API 文件，系统会生成 `path`：

-   项目 API：`/api/app/<relativePath>`
-   addon API：`/api/addon/<addonName>/<relativePath>`

其中 `relativePath` 是相对 `apis/` 的路径，去掉扩展名。

示例：

-   `apis/user/login.ts` → `/api/app/user/login`
-   addon `apis/order/create.ts` → `/api/addon/<addonName>/order/create`

## API 默认字段（系统补全）

即使你在文件里不写，扫描阶段也会补上默认值：

-   `method: "POST"`
-   `auth: true`
-   `rawBody: false`
-   `fields: {}`
-   `required: []`

## API 定义（export default）

一个 API 文件必须 `export default` 一个对象，至少包含：

-   `name: string`
-   `handler: (befly, ctx) => ...`

可选字段：

-   `method?: "GET" | "POST" | "GET,POST"`
-   `auth?: boolean`
-   `fields?: TableDefinition`（字段规则）
-   `required?: string[]`
-   `rawBody?: boolean`

示例：

```ts
import type { ApiRoute } from "befly/types/api";

const loginApi: ApiRoute = {
    name: "用户登录",
    method: "POST",
    auth: false,
    fields: {
        email: { name: "邮箱", type: "string", max: 200, nullable: false },
        password: { name: "密码", type: "string", max: 200, nullable: false },
    },
    required: ["email", "password"],
    handler: async (befly, ctx) => {
        // 推荐：直接用 ctx.body.xxx，不要做无意义的中间变量转发
        const email = ctx.body["email"];
        const password = ctx.body["password"];

        if (typeof email !== "string" || typeof password !== "string") {
            return befly.tool.No("参数错误", { ok: false });
        }

        befly.logger.info({ msg: "login", email: email });

        return befly.tool.Yes("成功", { ok: true });
    },
};

export default loginApi;
```

## RequestContext（ctx）速查

`ctx` 的核心字段（见 `befly/types/context`）：

-   `ctx.method`: 请求方法
-   `ctx.body`: 请求体（已解析）
-   `ctx.user`: 用户信息（来自 JWT）
-   `ctx.req`: 原始 Request
-   `ctx.now`: 请求开始时间（毫秒）
-   `ctx.ip`: 客户端 IP
-   `ctx.headers`: 请求头
-   `ctx.route`: url.pathname（例如 `/api/app/user/login`）
-   `ctx.requestId`: 请求唯一 ID
-   `ctx.corsHeaders`: CORS 响应头
-   `ctx.api`: 当前命中的 API 配置（可能为空）
-   `ctx.response`: 若你直接赋值为 Response，将被直接返回
-   `ctx.result`: handler 的原始处理结果（Response 或 JSON）

## 返回值约定（Response / JSON）

`handler` 可以返回：

-   `Response`
-   或可 JSON 序列化的数据（框架会包装成 Response）

推荐使用注入的工具函数：

-   `befly.tool.Yes(msg, data)` → `{ code: 0, msg, data }`
-   `befly.tool.No(msg, data)` → `{ code: 1, msg, data }`
-   `befly.tool.Raw(ctx, data, options)` → 直接返回原始响应（自定义 status/contentType/headers）

> 注意：不要使用 `console.*`，统一用 `befly.logger.*`。
