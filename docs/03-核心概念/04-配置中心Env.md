# 配置中心 Env

Env 位于 `core/config/env.js`，集中读取并做基础类型转换（如 Number()）。常用键：

-   服务：`APP_HOST`、`APP_PORT`、`APP_NAME`、`LOG_*`、`TZ`
-   数据库：`DB_ENABLE`、`DB_TYPE`、`DB_HOST/PORT/USER/PASS/NAME`、`DB_POOL_MAX`、`DB_DEBUG`
-   Redis：`REDIS_ENABLE`、`REDIS_URL`、`REDIS_*`
-   JWT：`JWT_SECRET`、`JWT_EXPIRES_IN`、`JWT_ALGORITHM`
-   同步脚本：`SYNC_MERGE_ALTER`、`SYNC_DISALLOW_SHRINK`、`SYNC_ALLOW_TYPE_CHANGE`

说明：测试用例按项目约束不应直接读取环境变量（详见 08-测试章节）。生产可通过 pm2 或容器注入上述变量。
