# 接口（API）

本页描述 API 的**定义方式**、**路由路径生成规则**与**RequestContext 用法**。

## 路由匹配规则（重要）

### 只使用 url.pathname 做匹配

当前实现中：

- 路由表 `apisMap` 的 key 是 `scanFiles/loadApis` 生成的 `path`（例如 `/api/app/user/login`）
- 请求命中判断 **只使用** `new URL(req.url).pathname`（例如 `/api/app/user/login`）
- **不会** 把 HTTP method 拼到 key 里（例如 `POST /api/...` 这种写法是错误的）

因此：

- 你不需要、也不应该在任何地方构造 `POST /api/...`、`POST/api/...` 这种 path
- `path` 必须是严格的 pathname（以 `/` 开头、无空格、以 `/api/` 开头）

### method 字段的现状

API 的 `method` 字段会被规范化为 `"GET" | "POST" | "GET,POST"` 并保存到 `ctx.api.method`。

但目前 **路由分发不基于 method**（也就是说：请求是否能进入该 API handler，取决于 pathname 是否匹配）。

如果你需要“强制只允许 GET/POST”：请在 handler 内自行判断：

- `if (ctx.method !== "POST") return befly.tool.No("Method Not Allowed");`

## 文件放哪里（扫描规则）

API 只从以下目录扫描（支持 `.ts/.js`，但推荐使用 `.ts`）：

- 项目：`<appDir>/apis/**/*.{ts,js}`
- 组件（addon）：`<addonRoot>/apis/**/*.{ts,js}`

固定过滤：

- 忽略 `.d.ts`
- 忽略任何以下划线 `_` 开头的文件或目录

## 路由路径如何生成

对每个 API 文件，系统会生成 `path`：

- 项目 API：`/api/app/<relativePath>`
- addon API：`/api/addon/<addonName>/<relativePath>`

其中 `relativePath` 是相对 `apis/` 的路径，去掉扩展名。

示例：

- `apis/user/login.ts` → `/api/app/user/login`
- addon `apis/order/create.ts` → `/api/addon/<addonName>/order/create`

## API 默认字段（系统补全）

即使你在文件里不写，扫描阶段也会补上默认值：

- `method: "POST"`
- `auth: true`
- `rawBody: false`
- `fields: {}`
- `required: []`

## API 定义（export default）

一个 API 文件必须 `export default` 一个对象，至少包含：

- `name: string`
- `handler: (befly, ctx) => ...`

可选字段：

- `method?: "GET" | "POST" | "GET,POST"`
- `auth?: boolean`
- `fields?: TableDefinition`（字段规则；`type` 使用数据库类型，`input` 控制输入校验）
- `required?: string[]`
- `rawBody?: boolean`

示例：

```ts
import type { ApiRoute } from "befly/types/api";

const loginApi: ApiRoute = {
    name: "用户登录",
    method: "POST",
    auth: false,
    fields: {
        email: { name: "邮箱", type: "varchar", input: "string", max: 200, nullable: false },
        password: { name: "密码", type: "varchar", input: "string", max: 200, nullable: false },
        lastLoginAt: { name: "最后登录时间", type: "datetime", input: "string", nullable: true, default: null },
        roleIds: { name: "角色ID", type: "varchar", input: "array_number", max: 32, default: "[]", nullable: false },
        profile: { name: "用户信息", type: "json", input: "json", default: null, nullable: true },
        scores: { name: "评分", type: "json", input: "json_number", default: null, nullable: true }
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
    }
};

export default loginApi;
```

`datetime` 校验失败示例：

- 输入：`2026-01-16`
- 错误：`最后登录时间格式不正确`

`array_number` 读写说明：

- 请求体传入数组（例如 `roleIds: [1, 2]`）
- 数据库存储为 JSON 字符串（例如 `"[1,2]"`）
- 查询返回时自动反序列化为数组

`array_number` 失败示例：

- 输入：`roleIds: ["1", "2"]`
- 错误：`角色ID数组元素必须是数字`

`json` 校验说明：

- 仅允许对象或数组（例如 `{ "nickname": "Tom" }` 或 `[1, 2]`）
- 非对象/数组会被判定为格式错误

`json_number` 校验说明：

- JSON 结构中所有叶子值必须是 number
- 若包含非数字（例如字符串）会被判定为格式错误

`json_number` 失败示例：

- 输入：`scores: { "math": 90, "english": "A" }`
- 错误：`评分JSON值必须是数字`

## RequestContext（ctx）速查

`ctx` 的核心字段（见 `befly/types/context`）：

- `ctx.method`: 请求方法
- `ctx.body`: 请求体（已解析）
- `ctx.user`: 用户信息（来自 JWT）
- `ctx.req`: 原始 Request
- `ctx.now`: 请求开始时间（毫秒）
- `ctx.ip`: 客户端 IP
- `ctx.headers`: 请求头
- `ctx.route`: url.pathname（例如 `/api/app/user/login`）
- `ctx.requestId`: 请求唯一 ID
- `ctx.corsHeaders`: CORS 响应头
- `ctx.api`: 当前命中的 API 配置（可能为空）
- `ctx.response`: 若你直接赋值为 Response，将被直接返回
- `ctx.result`: handler 的原始处理结果（Response 或 JSON）

### Hook 如何短路请求

在 `/api/*` 请求链路中，框架会先顺序执行所有 hook：

- `await hook.handler(befly, ctx)`
- 如果某个 hook 设置了 `ctx.response`，将 **立即停止后续 hook 与 API handler**，直接返回该 `Response`

因此：

- hook 中的“拦截/鉴权/校验”应通过 `ctx.response = ErrorResponse(ctx, ...)` 来短路
- hook 必须自行处理 `ctx.api` 可能为空的情况（例如接口不存在时）

## 返回值约定（Response / JSON）

`handler` 可以返回：

- `Response`
- 或可 JSON 序列化的数据（框架会包装成 Response）

推荐使用注入的工具函数：

- `befly.tool.Yes(msg, data)` → `{ code: 0, msg, data }`
- `befly.tool.No(msg, data)` → `{ code: 1, msg, data }`
- `befly.tool.Raw(ctx, data, options)` → 直接返回原始响应（自定义 status/contentType/headers）

> 注意：不要使用 `console.*`，统一用 `befly.logger.*`。

## 常见错误

1. **把 method 拼进 path**：例如 `"POST /api/app/xxx"` / `"POST/api/app/xxx"`，这会被启动期检查视为非法 path。
2. **误以为 method 参与路由**：当前实现不是；如果你想限制 method，请在 handler 里判断 `ctx.method`。
