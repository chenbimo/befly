# 插件（Plugin）

本页只描述插件的**定义与使用**（如何被扫描、如何命名、如何注入到 ctx）。

## 文件放哪里（扫描规则）

插件扫描目录：

-   项目：`<appDir>/plugins/*.{ts,js}`
-   addon：`<addonRoot>/plugins/*.{ts,js}`

core 内置插件不从目录扫描，而是静态注册。

固定过滤：

-   忽略 `.d.ts`
-   忽略任何以下划线 `_` 开头的文件或目录

## moduleName（运行时挂载 key）如何生成

插件最终会挂载到 `ctx[moduleName]` 上，依赖排序（deps）也使用 `moduleName`。

生成规则：

-   core：`moduleName = fileName`（不做驼峰转换）
-   app：`moduleName = "app_" + camelCase(fileName)`
-   addon：`moduleName = "addon_" + camelCase(addonName) + "_" + camelCase(fileName)`

示例：

-   项目插件 `plugins/sms.ts` → `ctx["app_sms"]`
-   addon `admin` 的 `plugins/email.ts` → `ctx["addon_admin_email"]`
-   core 插件：`logger`, `redis`, `db`, `cache`, `tool`, `cipher`, `jwt`, `config`

## export default 允许的字段（强约束）

插件文件的 `export default` 只能包含以下字段：

-   `enable: boolean`（可省略，缺省会被补为 `true`）
-   `deps?: string[]`（可省略，缺省会被补为 `[]`）
-   `handler: (ctx) => any`（必填）
-   `name?: string`（通常不需要写；core 内置插件必须显式写且与 moduleName 一致）

> 不允许额外字段：多写任何 key 都会在启动检查阶段报错并阻断启动。

## 基本示例

`plugins/sms.ts`：

```ts
import type { Plugin } from "befly/types/plugin";

const smsPlugin: Plugin = {
    enable: true,
    deps: ["logger"],
    handler: async (ctx) => {
        // ctx 是 BeflyContext（包含 logger/db/redis/cache/tool...）
        ctx.logger.info({ msg: "sms plugin init" });

        const api = {
            async sendCode(phone: string, code: string) {
                ctx.logger.info({ msg: "send sms", phone: phone, code: code });
                return true;
            },
        };

        return api;
    },
};

export default smsPlugin;
```

运行时使用：

-   `ctx["app_sms"].sendCode(...)`

## 禁用插件

将 `enable` 设为 `false` 即可禁用：

```ts
export default {
    enable: false,
    deps: [],
    handler: () => {
        return null;
    },
} as Plugin;
```

> 当前代码以 `enable === false` 为唯一禁用方式；不要依赖历史文档里的 `disablePlugins` 列表。

## deps（依赖排序）

-   `deps` 数组填写依赖的 **moduleName**
-   依赖排序失败会阻断启动

推荐：

-   依赖 core 内置插件时直接写：`"logger"`, `"redis"`, `"db"`
-   依赖项目插件写：`"app_xxx"`
-   依赖 addon 插件写：`"addon_<addonName>_xxx"`
