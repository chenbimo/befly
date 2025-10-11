# logger 与字段过滤

Befly 提供结构化日志工具 `utils/logger.js`，并在请求处理时输出统一访问日志。

## 过滤敏感字段

-   通过 `Env.LOG_EXCLUDE_FIELDS` 配置（如 `password,token`），日志输出会自动剔除这些字段。

## 输出位置

-   控制台与文件双输；文件路径由 `Env.LOG_DIR` 指定，大小由 `Env.LOG_MAX_SIZE` 控制。

## 最佳实践

-   为接口请求体裁剪字段，避免敏感数据进入日志。
-   使用合适的日志等级与文件大小，配合轮转策略。
