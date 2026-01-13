# 日志（ctx.logger）

本页描述对外可用的 Logger 接口（`befly/types/logger`）与配置项（`LoggerConfig`）。

## 使用方式

框架会注入 `ctx.logger`（同时也可在插件/Hook/API handler 中通过 `befly.logger` 使用）。

常用方法：

- `info(input)`
- `warn(input)`
- `error(input)`
- `debug(input)`

约束：

- 每个方法只接收一个参数（`unknown`）
- 推荐传对象（结构化日志），例如：

```ts
ctx.logger.info({ msg: "user login", userId: 123, route: ctx.route });
```

## 配置（LoggerConfig）

配置位于 `config.logger`（见 `config.md`），常用字段：

- `debug?: 0 | 1`：是否开启 debug 输出
- `dir?: string`：日志目录
- `console?: 0 | 1`：是否输出到控制台
- `maxSize?: number`：单文件最大大小（MB）
- `excludeFields?: string[]`：脱敏字段匹配（支持通配，如 `*password*`）

以及一组“日志清洗与截断”参数（防止超大对象/循环引用/敏感字段）：

- `sanitizeDepth`
- `sanitizeNodes`
- `sanitizeObjectKeys`
- `maxStringLen`
- `maxArrayItems`

## 脱敏与清洗：实际行为（对齐实现）

### 默认会脱敏哪些字段？

Logger 内置了一组敏感字段规则（大小写不敏感），命中后值会被替换为 `"[MASKED]"`。

内置关键字（节选，完整列表以运行时为准）：

- `*password*`, `pass`, `pwd`
- `*token*`, `access_token`, `refresh_token`, `accessToken`, `refreshToken`
- `authorization`, `cookie`, `set-cookie`
- `*secret*`, `apiKey`, `api_key`, `privateKey`, `private_key`

你配置的 `excludeFields` 会在此基础上追加匹配规则。

### excludeFields 的匹配语义

匹配规则是“key 匹配”（不是 value 匹配），并且大小写不敏感：

- 不包含 `*`：按 key **精确匹配**
    - 例如：`"authorization"` 只遮蔽 key 为 `authorization` 的字段
- 包含 `*`：按 key 的 **子串包含** 匹配（会把 `*` 去掉后做 contains）
    - 例如：`"*password*"` 会遮蔽 `dbPassword` / `passwordHash` / `PASSWORD` 等

> `"*"` 这种“空规则”会被忽略（不会导致全部字段都被遮蔽）。

### 清洗/截断策略（为什么有时会变成字符串）

Logger 会对输入对象做“稳定、可控”的裁剪，避免：

- 深层结构导致巨量日志
- 循环引用导致 JSON 崩溃
- 超长字符串/超长数组撑爆日志文件

实际规则：

- 字符串会被截断到 `maxStringLen`
- 数组最多展开 `maxArrayItems` 个元素
- 普通对象最多保留 `sanitizeObjectKeys` 个 key
- 当达到 `sanitizeDepth` 或节点数达到 `sanitizeNodes` 时：该节点会降级为“字符串预览”（JSON stringify），并且预览里同样会执行敏感字段遮蔽与字符串截断
- 遇到循环引用会输出 `"[Circular]"`
- `Error` 会被转换为 `{ name, message, stack }` 并按 `maxStringLen` 截断

### 配置归一化（clamp）

为避免配置写错把日志系统拖垮，框架会对部分配置做范围收敛：

- `sanitizeDepth`: 1..10
- `sanitizeNodes`: 50..20000
- `sanitizeObjectKeys`: 10..5000
- `maxStringLen`: 20..200000
- `maxArrayItems`: 10..5000

## flush / shutdown

- `flush()`：尽快把缓冲写入 sink（不关闭句柄）
- `shutdown()`：flush 并关闭 sink（主要用于测试/Windows 句柄释放）

## 推荐实践

1. **只写结构化日志**：把关键字段（route、requestId、userId、table、sql）写入对象
2. 不要用 `console.*`
3. 错误日志推荐：

```ts
ctx.logger.error({ msg: "db error", err: error });
```
