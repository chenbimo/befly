# 配置（configs）

本页仅描述 **对外可配置项与加载规则**。如文档与行为不一致，以代码为准。

## 配置文件位置与环境选择

Befly 启动时会从工作目录（`process.cwd()`）读取：

-   `configs/befly.common.json`
-   `configs/befly.development.json` 或 `configs/befly.production.json`

环境由 `Befly.start(env)` 的入参决定：

-   `env["NODE_ENV"] === "development" | "production"`

并且最终的 `config.nodeEnv` 会被强制设置为该环境值（不依赖 `process.env.NODE_ENV`）。

### 合并规则（非常重要）

合并顺序：

1. 内置默认配置
2. `befly.common.json`
3. `befly.<env>.json`

合并语义：

-   plain object：深合并
-   array：**concat（拼接，不是覆盖）**
-   `undefined`：忽略

## 最小可用配置示例

`configs/befly.development.json`（示例，仅列出最常用字段）：

```json
{
    "appName": "Befly App",
    "appHost": "127.0.0.1",
    "appPort": 3000,
    "db": {
        "dialect": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "username": "root",
        "password": "root",
        "database": "befly_demo",
        "poolMax": 10
    },
    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "db": 0,
        "prefix": "befly_demo"
    }
}
```

启动方式（示例）：

```ts
import { Befly } from "befly";

const befly = new Befly();
await befly.start({ NODE_ENV: "development" });
```

## 核心配置字段（BeflyOptions）

### nodeEnv

-   类型：`string`
-   实际允许值：`"development" | "production"`
-   说明：由 `Befly.start({ NODE_ENV })` 选择，配置文件里写了也会被覆盖。

### appName / appHost / appPort

-   `appName`: 应用名称
-   `appHost`: 监听地址
-   `appPort`: 监听端口

### bodyLimit

-   类型：`number`
-   说明：请求体大小上限（字节）。

### tz

-   类型：`string`
-   说明：时区字符串（例如 `Asia/Shanghai`）。

## 数据库配置（db）

字段来自 `DatabaseConfig`：

-   `dialect`：`"mysql" | "postgresql" | "sqlite" | "postgres"`
    -   注意：`postgres` 会在运行时归一化为 `postgresql`
-   `host` / `port` / `username` / `password` / `database`
-   `poolMax`：连接池最大连接数

### 配置校验（启动期强校验）

启动阶段会对配置做强校验（错误直接阻断启动）：

-   `db.dialect` 必须在白名单内
-   当 `dialect === "sqlite"`：必须配置非空 `db.database`
-   当 `dialect !== "sqlite"`：必须配置 host/port/username/database（password 允许空字符串，但必须是 string）

> 这类校验属于“对外契约”：你只要按规则写配置即可，不需要了解内部实现。

## Redis 配置（redis）

字段来自 `RedisConfig`：

-   `host` / `port` / `username` / `password` / `db`
-   `prefix`：Redis Key 前缀

### prefix 规则（强约束）

`redis.prefix` **不允许包含 `:`**。

原因（对外表现）：RedisHelper 会统一拼接分隔符 `:`，如果你自己写了冒号，最终 key 结构会出现空段或多段分隔，影响管理。

推荐：

-   ✅ `"prefix": "befly_demo"`
-   ❌ `"prefix": "befly_demo:"`

## 禁用菜单规则（disableMenus）

-   类型：`string[]`
-   用途：用于菜单同步时过滤（见 `menu.md`）
-   匹配方式：Bun.Glob glob pattern

示例：

```json
{
    "disableMenus": ["**/login", "/addon/admin/**"]
}
```

## 日志配置（logger）

详见 `logger.md`。
