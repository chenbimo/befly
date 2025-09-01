# Befly Framework - AI Coding Agent Instructions

## 项目概述

Befly 是专为 Bun 运行时设计的 API 框架，采用插件化架构，提供数据库操作、身份验证、日志记录等核心功能。 \- 仓库布局：`core/` 为 API 框架源码目录；`tpl/` 为示例/模板项目目录，会以依赖方式引用 `core/` 框架。

## 项目结构

### 框架核心（core/）

-   **core/** 目录: Befly 框架的核心代码，包含插件系统、工具函数、CLI 等
-   **发布包**: 作为 npm 包发布，供其他项目（如 `tpl/`）作为依赖使用

### 示例项目（tpl/ 目录）

-   **tpl/** 目录: 实际的项目模板/示例代码目录，作为独立项目引用 `core/` 框架作为依赖
-   **用途**: 展示如何使用 Befly 框架构建真实项目
-   **结构**: 包含 APIs、表定义、配置文件等用户项目代码
-   **运行**: 在 `tpl/` 目录中执行 `bun run dev` 启动项目

### API 路由定义

-   **位置**: `apis/` 目录按功能模块组织

### 数据验证系统

-   **保留字段**: 避免使用 `id`, `created_at`, `updated_at`, `deleted_at`, `state`
-   **验证器**: `utils/validate.js` 处理参数验证逻辑
-   **枚举支持**: 使用正则表达式实现枚举，如 `^(active|inactive|pending)$`

### 运行时要求

-   **使用 Bun**: 优先使用 `bun` 进行安装、测试等操作，避免使用 `node`/`npm`/`npx`
-   **临时文件清理**: 临时测试文件测试完毕后必须立即删除
-   **代码复用**: 尽可能复用现有代码，保持逻辑高效且简洁

### 命令行工具

-   **CLI**: `befly <script-name>` 执行框架脚本
-   **优先级**: 检测 Bun 环境，回退到 Node.js
-   **脚本位置**: `scripts/` 目录
-   **在 tpl 中使用**: 进入 `tpl/` 目录使用 `bunx befly`
    -   无参数：打印所有可用脚本
    -   执行：`bunx befly syncDb`
    -   dry-run：`bunx befly syncDev --dry-run`
    -   参数透传：脚本名后的参数会原样传递给目标脚本（例如 `bunx befly syncDb --dry-run`）

### 版本发布

```bash
bun run ra  # 主版本 (major)
```

### 测试运行

```

### 测试约束（重要）
-   测试中不使用任何环境变量读取（包括 `process.env`）。如需配置，请：
    -   在测试中写死常量（仅用于测试场景），或
    -   通过依赖注入/桩（mock）将配置传入被测单元。

## 项目特定约定

### 路径管理

-   **系统路径**: `system.js` 定义框架和项目路径常量
-   **使用模式**: 导入 `__dirroot`, `__dirscript` 等预定义路径

### 数据库操作

-   **查询构造器**: `utils/sqlBuilder.js` 的 `SqlBuilder` 类
-   **字段转义**: 自动处理 MySQL 字段名转义（反引号）

### 环境配置

-   **配置中心**: `config/env.js` 统一管理环境变量
-   **类型转换**: 自动处理数字类型配置项
-   **功能开关**: `DB_ENABLE`, `REDIS_ENABLE` 等开关配置
### 日志记录

-   **工具类**: `utils/logger.js` 提供结构化日志
-   **字段过滤**: 支持敏感字段排除记录
-   **多输出**: 控制台和文件双重输出

## 关键集成点
### 数据库连接

-   **Bun SQL**: 使用 Bun 内置 SQL 客户端（`import { SQL } from 'bun'`），无需额外 `mariadb` 依赖
-   **连接池**: 通过 `new SQL({ url, max, bigint, ... })` 配置池大小、数值类型等

### Redis 缓存

-   **健康检查**: `apis/health/info.js` 包含连接状态检测

### 系统检查
-   **启动检查**: `checks/` 目录包含系统自检脚本
-   **表定义检查**: 验证表结构定义合规性
-   **性能监控**: 记录检查执行时间


-   使用 `RYes(message, data)` 返回成功响应
-   使用 `RNo(message, error)` 返回失败响应
-   统一错误日志记录格式

-   插件通过 `onInit` 钩子注册功能
-   支持异步初始化和依赖注入
-   统一的生命周期管理

### 配置驱动

-   功能模块通过环境变量控制启用/禁用
-   支持开发和生产环境差异化配置
-   动态功能加载避免不必要的依赖

## 变更说明与迁移指南（DB\_\* 环境变量）

更新时间：2025-08-31

本项目的数据库环境变量已统一为 DB\_\* 方案，替代历史上的 MYSQL_URL/MYSQL_DB 形式，以同时支持 sqlite、mysql、postgresql。变更属于向前演进的配置统一，不影响框架 API 使用。

-   DB_TYPE：数据库类型（sqlite | mysql | postgresql）
-   DB_HOST：主机（sqlite 可忽略）
-   DB_PORT：端口（sqlite 可忽略）
-   DB_USER：用户名（sqlite 可忽略）
-   DB_POOL_MAX：连接池最大连接数
## SQLite 专项说明（≥ 3.50.0）

最低版本要求为 3.50.0；脚本启动时通过 `SELECT sqlite_version()` 检查，低于该版本将中止。

已实现能力与策略：

- 新增列：使用 `ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "col" TYPE NOT NULL [DEFAULT ...]`
- 默认值：仅在新增列时设置；SQLite 不支持修改列默认值，若变更默认值且启用 `SYNC_SQLITE_REBUILD=1`，将采用重建表策略。
- 修改列/类型/长度：SQLite 原生不支持在线修改列定义；若检测到变更且开启重建，将执行“创建临时表 -> 拷贝公共列数据 -> 删除旧表 -> 重命名”的迁移流程。
- 索引：使用 `CREATE INDEX IF NOT EXISTS` / `DROP INDEX IF EXISTS`。

限制：

- 不支持列注释（会在 MySQL/PG 同步，SQLite 跳过）。
- 复杂约束、唯一/复合索引的全量差异同步尚未覆盖，需要人工处理或在后续增强。
-   DB_DEBUG：SQL 调试开关

### 废弃与兼容

-   废弃：MYSQL_URL、MYSQL_DB（不再读取）。
-   历史粒度变量（MYSQL_HOST/PORT/USER/PASSWORD/DB）已移除，不再使用。
-   代码层已全部改为从 Env.DB\_\* 读取，并通过 buildDatabaseUrl() 组合最终连接串。

### URL 组装规范（内部行为说明）

-   sqlite：sqlite:<DB_NAME>（文件路径或 :memory:）
-   postgresql：postgres://[user:pass@]host:port/DB_NAME
-   mysql：mysql://[user:pass@]host:port/DB_NAME

并在首次连接时执行类型化的健康检查：

-   sqlite：SELECT sqlite_version()
-   postgresql：SELECT version()
-   mysql：SELECT VERSION()

### 影响面与已知限制

-   插件与工具：createSqlClient/buildDatabaseUrl/getMysqlSchemaFromEnv 已适配 DB\_\*。
-   同步脚本：core/scripts/syncDb.js 与 syncDev.js 仍基于 MySQL information_schema，暂不支持多数据库差异。DB_NAME 仍用于指示目标 schema。
-   文档：面向用户的配置章节展示当前 DB\_\* 最终形态；变更记录集中在本文件，不写入 README。

### 迁移步骤（tpl/.env.development 与 tpl/pm2.config.cjs）

1. 删除 MYSQL*URL、MYSQL_DB（以及历史粒度 MYSQL*\*）
2. 添加以下键值（示例为 MySQL）：
    - DB_TYPE=mysql
    - DB_HOST=127.0.0.1
    - DB_PORT=3306
    - DB_USER=root
    - DB_PASS=root
    - DB_NAME=demo
3. 保留或按需调整：
    - DB_ENABLE=1
    - DB_POOL_MAX=10
    - DB_DEBUG=0

SQLite 示例：

-   DB_TYPE=sqlite
-   DB_NAME=/absolute/path/to/demo.sqlite（或 :memory:）

PostgreSQL 示例：

-   DB_TYPE=postgresql
-   DB_HOST=127.0.0.1
-   DB_PORT=5432
-   DB_USER=user
-   DB_PASS=pass
-   DB_NAME=demo

### 校验与回归

-   在仓库根目录运行：bun test（需 Bun）
-   core/tests 已更新断言到 DB\_\* 命名；当前全量用例通过

### 问答

-   是否还能使用 MYSQL*URL/MYSQL_DB？不支持，已废弃；请切换到 DB*\*。
-   生产灰度如何做？建议在 pm2 的 env 中统一使用 DB\_\*，包括 DB_ENABLE/DB_POOL_MAX/DB_DEBUG。

## PostgreSQL 专项说明（v17+ Online 策略与限制）

本节总结 PostgreSQL（最低 v17）场景下由 `core/scripts/syncDb.js` 实现的能力、策略与限制，帮助你“尽可能对齐 MySQL”的同时，遵守 PG 的约束以降低锁表与停机风险。

### 已实现能力

-   在线并发索引（默认启用）

    -   创建/删除索引时在 PostgreSQL 使用 `CONCURRENTLY`（`CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY`）。
    -   MySQL 使用 `ALGORITHM=INPLACE, LOCK=NONE` 以尽量减少锁表影响。
    -   适用于普通与系统索引（如 `created_at`、`updated_at`、`state`）。
    -   注意：并发索引在 PG 中要求非事务上下文，脚本会按语句拆分执行。

-   列注释同步

    -   自动发现与比对列注释差异，通过 `COMMENT ON COLUMN` 应用变更。
    -   新建表会基于表定义中的“显示名”写入列注释。

    -   新增列（默认值/非空）：直接使用单条 `ADD COLUMN IF NOT EXISTS ... DEFAULT ... NOT NULL`，依赖 v11+ 快速默认值，v17 下更稳；不再走多步回填路径。

-   兼容性类型/长度的“无锁”识别与最小化变更
    -   受 `SYNC_PG_ALLOW_COMPATIBLE_TYPE=1` 控制，当前支持：
        -   `varchar(n)` 扩容为更大的 `varchar(m)`（m >= n）
        -   `varchar(n)` 迁移为 `text`
    -   这两类变更按“兼容/可扩展”处理，生成最小化 `ALTER TABLE ... ALTER COLUMN ... TYPE ...`，尽量避免重写整表。

### 重要限制与注意事项

-   收缩/不兼容变更默认禁止

    -   若目标类型更小或不兼容（例如 `text -> varchar(100)` 或 缩短 `varchar` 长度），会被策略拒绝。可通过 `SYNC_DISALLOW_SHRINK` 控制（默认禁止）。
    -   完全不兼容的类型变更（需要数据转换、可能重写整表）未内置自动迁移路径，建议使用“影子列 + 回填 + 切换”人工方案。

-   事务边界与并发索引

    -   `CREATE/DROP INDEX CONCURRENTLY` 不允许在事务内执行；脚本会分离执行。但在 CI/CD 或外层自定义事务中需确保不包装这些语句。

-   约束、唯一/复合索引

    -   目前仅覆盖普通/单列索引的同步；唯一索引与复合索引的全量同步仍待增强（计划：识别差异、`CREATE UNIQUE INDEX [CONCURRENTLY]`）。

-   SET NOT NULL 渐进式校验（计划项）
    -   进一步优化路线（如 `CHECK NOT VALID` -> `VALIDATE CONSTRAINT` -> `SET NOT NULL`）尚未内置，将作为后续增强以减少长事务窗口。

### 常用环境开关（与 PG 相关）

-   `SYNC_PG_ALLOW_COMPATIBLE_TYPE=1`：允许“兼容/扩展”类型变更（如 varchar 扩容、varchar->text）。
-   `SYNC_DISALLOW_SHRINK=1`：禁止收缩类变更（推荐开启）。

这些开关由 `core/config/env.js` 暴露，默认值以当前代码为准，可在运行 `bunx befly syncDb` 时通过进程环境注入覆盖。

### Schema 与命名约定

-   数据库：使用 `DB_NAME` 指定；Schema 默认使用 `public`。无需另设 `MYSQL_NAME`。
-   标识符引用：内部使用双引号 `"name"` 进行引用，避免大小写/关键字冲突。

### 示例：新增非空列并设默认值

表定义新增字段（示例）

```

"status": "状态 ⚡varchar⚡0⚡32⚡active"

```

生成执行语句（单条）：

`ALTER TABLE "table" ADD COLUMN IF NOT EXISTS "status" character varying(32) NOT NULL DEFAULT 'active';`

### 示例：兼容扩容与类型放宽

-   `varchar(64)` -> `varchar(128)`：识别为扩容，生成 `ALTER COLUMN ... TYPE character varying(128)`。
-   `varchar(64)` -> `text`：识别为放宽，生成 `ALTER COLUMN ... TYPE text`。

若为不兼容/收缩变更（如 `text` -> `varchar(64)` 或 `varchar(128)` -> `varchar(64)`），默认拒绝，避免大范围重写与风险。

### 故障处理建议（PG）

-   报错涉及事务与 CONCURRENTLY：确保外层未包裹成单一事务。
-   锁等待时间过长：在业务低峰执行；或分批次对大表应用变更。
-   需要复杂的类型转换：采用“影子列 + 回填数据 + 读写切换 + 清理旧列”的迁移蓝图。
```
