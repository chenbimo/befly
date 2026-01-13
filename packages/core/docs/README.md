# Befly Core 文档（对外使用）

本目录仅保留 **对外使用** 文档：接口、插件、钩子、表定义、菜单配置、数据库操作、Redis 操作、配置、日志。

约束：

- 文档只描述**当前实现**：不提供迁移指引、不保留兼容说明、不保留旧配置/旧机制。
- 如文档与代码行为不一致：**以代码为准**，应直接修正文档。

## 推荐阅读顺序

1. [配置（configs）](./config.md)
2. [接口（API）](./api.md)
3. [表定义（tables/\*.json）](./table.md)
4. [数据库操作（ctx.db）](./database.md)
5. [Redis 操作（ctx.redis）](./redis.md)
6. [日志（ctx.logger）](./logger.md)
7. [插件（Plugin）](./plugin.md)
8. [钩子（Hook）](./hook.md)
9. [菜单配置（menus / adminViews 扫描）](./menu.md)

## 常用链接

- https://www.npmjs.com/package/befly
