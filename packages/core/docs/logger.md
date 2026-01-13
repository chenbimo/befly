# 日志（ctx.logger）

本页描述对外可用的 Logger 接口（`befly/types/logger`）与配置项（`LoggerConfig`）。

## 使用方式

框架会注入 `ctx.logger`（同时也可在插件/Hook/API handler 中通过 `befly.logger` 使用）。

常用方法：

-   `info(input)`
-   `warn(input)`
-   `error(input)`
-   `debug(input)`

约束：

-   每个方法只接收一个参数（`unknown`）
-   推荐传对象（结构化日志），例如：

```ts
ctx.logger.info({ msg: "user login", userId: 123, route: ctx.route });
```

## 配置（LoggerConfig）

配置位于 `config.logger`（见 `config.md`），常用字段：

-   `debug?: 0 | 1`：是否开启 debug 输出
-   `dir?: string`：日志目录
-   `console?: 0 | 1`：是否输出到控制台
-   `maxSize?: number`：单文件最大大小（MB）
-   `excludeFields?: string[]`：脱敏字段匹配（支持通配，如 `*password*`）

以及一组“日志清洗与截断”参数（防止超大对象/循环引用/敏感字段）：

-   `sanitizeDepth`
-   `sanitizeNodes`
-   `sanitizeObjectKeys`
-   `maxStringLen`
-   `maxArrayItems`

## flush / shutdown

-   `flush()`：尽快把缓冲写入 sink（不关闭句柄）
-   `shutdown()`：flush 并关闭 sink（主要用于测试/Windows 句柄释放）

## 推荐实践

1. **只写结构化日志**：把关键字段（route、requestId、userId、table、sql）写入对象
2. 不要用 `console.*`
3. 错误日志推荐：

```ts
ctx.logger.error({ msg: "db error", err: error });
```
