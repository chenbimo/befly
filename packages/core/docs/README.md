# Befly Core 文档

> Befly 是基于 Bun 的高性能 API 框架

## 快速开始

- [Quickstart 快速入门](./guide/quickstart.md) - 5 分钟搭建第一个 API 服务

## 核心概念

| 文档                                     | 说明                         |
| ---------------------------------------- | ---------------------------- |
| [API 开发](./api/api.md)                 | API 定义、字段验证、权限控制 |
| [Table 表结构](./reference/table.md)     | JSON 表定义格式、字段类型    |
| [Database 数据库](./plugins/database.md) | CRUD 操作、事务、批量操作    |
| [Config 配置](./reference/config.md)     | 配置文件、环境分离           |

## 扩展开发

| 文档                                 | 说明           |
| ------------------------------------ | -------------- |
| [Plugin 插件](./plugins/plugin.md)   | 自定义插件开发 |
| [Hook 钩子](./hooks/hook.md)         | 请求处理钩子   |
| [Addon 插件包](./reference/addon.md) | 可复用功能模块 |

常用内置 Hook：

- [cors Hook](./hooks/cors.md)
- [auth Hook](./hooks/auth.md)
- [parser Hook](./hooks/parser.md)
- [rateLimit Hook](./hooks/rateLimit.md)

## 工具系统

| 文档                                       | 说明               |
| ------------------------------------------ | ------------------ |
| [Validator 验证](./reference/validator.md) | 参数验证、正则别名 |
| [Logger 日志](./reference/logger.md)       | 日志系统配置       |
| [Cipher 加密](./plugins/cipher.md)         | 哈希、签名、JWT    |
| [Redis 缓存](./infra/redis.md)             | Redis 操作         |

## 命令工具

| 文档                             | 说明                  |
| -------------------------------- | --------------------- |
| [Sync 同步](./reference/sync.md) | 数据库、API、菜单同步 |

## 实战示例

- [Examples 实战示例](./guide/examples.md) - 用户管理、文章管理、文件上传完整示例

## 文档索引

### 入门篇

1. **[Quickstart](./guide/quickstart.md)** - 环境准备、项目创建、第一个 API

### 开发篇

2. **[API](./api/api.md)** - API 路由定义、字段验证、权限控制、响应格式
3. **[Table](./reference/table.md)** - 表定义格式、字段类型、系统字段、命名规范
4. **[Database](./plugins/database.md)** - 数据库连接、CRUD 操作、事务处理、批量操作
5. **[Config](./reference/config.md)** - 配置文件结构、环境分离、运行时配置

### 扩展篇

6. **[Plugin](./plugins/plugin.md)** - 插件生命周期、依赖管理、内置插件
7. **[Hook](./hooks/hook.md)** - 钩子执行顺序、洋葱模型、内置钩子
8. **[Addon](./reference/addon.md)** - Addon 结构、创建发布、命名规范

### 工具篇

9. **[Validator](./reference/validator.md)** - 验证规则、类型转换、正则别名
10. **[Logger](./reference/logger.md)** - 日志级别、文件轮转、测试 Mock
11. **[Cipher](./plugins/cipher.md)** - 哈希算法、HMAC 签名、密码加密、JWT 令牌
12. **[Redis](./infra/redis.md)** - 缓存操作、键值存储、过期管理

### 运维篇

13. **[Sync](./reference/sync.md)** - syncTable、syncApi、syncMenu、syncDev、syncCache

## 常用链接

- [GitHub](https://github.com/chenbimo/befly)
- [npm](https://www.npmjs.com/package/befly)

## 版本信息

- Befly Core: 1.x
- 运行时: Bun >= 1.0
- 数据库: MySQL >= 8.0
- 缓存: Redis >= 6.0
