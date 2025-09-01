# 表结构同步脚本（scripts/syncDb.js）

> 重要变更：从现在起，计划预览通过命令行参数 `--plan` 控制，不再使用环境变量 `SYNC_DRY_RUN`。

## 概述

本脚本用于将 `tables/*.json` 中定义的字段规则同步为数据库表结构（支持 sqlite / mysql / postgresql）。
它会在执行前统一校验规则文件、按需创建/修改表字段与索引，并对不同变更类型生成相应的 DDL 语句，确保增量、安全地更新结构。支持每表合并 DDL、默认值专用 ALTER、在线索引、Dry-Run 与风险护栏。

- 依赖：Bun 运行时与 Bun 内置 SQL 客户端（`import { SQL } from 'bun'`）
- 支持：表新建、字段长度/类型/注释/默认值更新、索引增删、每表合并 DDL
- 版本要求：
    - MySQL ≥ 8.0（检测到 MariaDB 或低于 8.0 将直接中止）
    - PostgreSQL ≥ 17（检测到低于 17 将直接中止）
    - SQLite ≥ 3.50.0（检测到低于 3.50.0 将直接中止；部分 ALTER 能力受方言限制，不支持的修改将跳过或走重建）

## 表定义来源与校验

1. 来源目录：
    - 内核：`core/tables/`
    - 项目：`<project-root>/tables/`
2. 同名限制：项目目录中不可与内核同名（检查器会报错并中止）
3. 校验器：`checks/table.js`（具名导出 `checkTable`）在同步前执行；规则包含 7 段（`显示名⚡类型⚡最小值⚡最大值⚡默认值⚡是否索引⚡正则约束`），详见 `docs/table.md`。
    - 重要：类型/长度/默认值等合法性完全由 `checkTable` 保证；同步脚本在运行时不再做“兜底类型映射”或“兼容性修正”。若定义非法，会在校验阶段直接失败并中止。
4. 表名生成规则：表名由“文件名（不含扩展名）的小驼峰形式”自动转换为“下划线形式（snake_case）”
    - 转换示例：
        - `users.json` → `users`
        - `testProducts.json` → `test_products`
        - `blogPosts.json` → `blog_posts`
        - `orderV2.json` → `order_v2`
    - 注意：同步脚本不会重命名已存在的数据库表；若历史表名不符合该规则，请先手工迁移或在同步前统一命名

## 连接与执行

- 连接创建：使用 `utils/index.js` 的 `createSqlClient({ max })`，内部基于 `new SQL({ url, max, bigint, ... })`
- 参数化执行：统一使用 `exec(client, sql, params)`；有参时 `client.unsafe(sql, params)`，无参时 `client.unsafe(sql)`
- 版本检查：
    - MySQL：`SELECT VERSION()`，拒绝 MariaDB；主版本 < 8 中止
    - PostgreSQL：`SELECT version()`，解析主版本号；主版本 < 17 中止
    - SQLite：`SELECT sqlite_version()`；解析为数字并在 < 3.50.0 时中止

## 同步流程

1. 规则检查：调用 `checkTable()` 进行表定义校验
2. 建立连接并检查版本
3. 扫描两个目录（内核/项目）下的所有 `*.json` 表定义文件
4. 对每个表：
    - 判断表是否存在（information_schema.TABLES）
    - 如果存在：`syncTable`
    - 如果不存在：`createTable`
5. 输出统计：总计、新建、修改
6. 关闭连接（安全关闭）

## 字段 SQL 生成（getColumnDefinition）

- 类型映射：
    - number → BIGINT
    - string → VARCHAR(n)
    - text → MEDIUMTEXT
    - array → VARCHAR(n)
- 长度：string/array 必须提供最大长度（第 4 段），用于 `VARCHAR(n)`
- 非空：所有字段统一 `NOT NULL`（包括系统字段）
- 默认值：
    - 文档规则第 5 段为 `null`：按类型提供默认值（number→0，string→""，array→"[]"；text 不设置默认值）
    - 非 `null`：
        - number → 直接拼接数值
        - 其他 → 用双引号包裹，内部引号转义
- 注释：使用第 1 段作为注释（COMMENT），内部引号转义

示例（规则：`"用户名⚡string⚡1⚡100⚡null⚡1⚡null"`）：

```
`username` VARCHAR(100) NOT NULL DEFAULT "" COMMENT "用户名"
```

## 变更检测（compareFieldDefinition）

对已存在的列，脚本会比较三类变化：

1. 长度变更：仅针对 string/array，比较 `CHARACTER_MAXIMUM_LENGTH`
2. 注释变更：比较 `COLUMN_COMMENT` 与第 1 段显示名
3. 数据类型变更：比较 `DATA_TYPE` 与期望类型（number→bigint、string→varchar、text→mediumtext、array→varchar）

返回结构：`{ hasChanges: boolean, changes: Array<{ type: 'length'|'comment'|'datatype'|'default', current, new }> }`

## DDL 生成与执行（合并 ALTER / 默认值专用 ALTER / executeDDLSafely）

- 每表合并：将多个 ADD/MODIFY 合并为一条 `ALTER TABLE ...`，附带 `ALGORITHM=INSTANT, LOCK=NONE`，失败回退到 INPLACE → 去掉附加子句
- 默认值专用：当仅默认值变化时使用 `ALTER COLUMN col SET/DROP DEFAULT`，与其它修改分开执行
- 逐级回退策略：
    1. 尝试 INSTANT
    2. 失败则改为 INPLACE
    3. 再失败去掉 ALGORITHM/LOCK（传统 DDL）
- 所有执行均通过 `exec(client, sql, params?)`

## 索引管理（在线索引）

- 统一使用 `ALTER TABLE ... ADD/DROP INDEX`，在开启开关时附带 `ALGORITHM=INPLACE, LOCK=NONE`
- 同步逻辑：
    - 若规则第 6 段为 `1` 且当前不存在索引 → 创建
    - 若规则第 6 段不为 `1` 且当前存在且仅有该字段 → 删除
- 系统默认索引：新建表时自动添加 `idx_created_at`、`idx_updated_at`、`idx_state`

## 表创建（createTable）

- 系统字段：
    - id BIGINT PRIMARY KEY（含注释）
    - created_at / updated_at / deleted_at / state：BIGINT NOT NULL DEFAULT 0（含注释）
- 自定义字段：对每个规则生成列定义，并根据第 6 段是否创建 `idx_字段名`
- 引擎与字符集：`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`

## 元数据来源（按方言）

- MySQL：
    - 列信息：`information_schema.COLUMNS`（字段名、类型、长度、是否可空、默认值、注释、完整类型）
    - 索引信息：`information_schema.STATISTICS`（排除主键）
    - 表存在性：`information_schema.TABLES`
- PostgreSQL：
    - 列信息：`information_schema.columns` + `col_description()` 获取列注释
    - 索引信息：`pg_indexes`（解析 `indexdef`）
    - 表存在性：`information_schema.tables`
- SQLite：
    - 列信息：`PRAGMA table_info("table")`
    - 索引信息：`PRAGMA index_list("table")` + `PRAGMA index_info("index")`
    - 表存在性：`sqlite_master`

## 运行方式

- 同步：

```bash
bun run scripts/syncDb.js

仅打印计划（dry-run）：

```

bun run scripts/syncDb.js --plan

```

```

- 仅检查规则：

```bash
bun run checks/table.js
```

## 注意事项与最佳实践

- 先本地运行 `checkTable` 再执行同步，降低失败概率
- 生产环境前务必备份，DDL 操作不可逆
- string/array 必须设置第 4 段最大长度
- 文档第 5 段为 `null` 时，按类型提供默认值（number→0，string→""，array→"[]"；text 不设置默认值）
- array 类型以字符串存储，应用层负责解析/校验
- 变更尽量批次化，避免频繁 DDL

## 行为开关（环境变量）

- （已废弃）SYNC_DRY_RUN：请使用命令行参数 `--plan`
- SYNC_MERGE_ALTER：是否合并每表多项 DDL（默认 1）
- SYNC_DISALLOW_SHRINK：禁止长度收缩（默认 1）
- SYNC_ALLOW_TYPE_CHANGE：允许类型变更（默认 0）
- SYNC_PG_ALLOW_COMPATIBLE_TYPE：PostgreSQL 允许“兼容/扩展”类型变更（如 varchar 扩容、varchar→text）（默认 1）

说明（索引在线化）：

- 现在索引 ADD/DROP 始终使用“在线策略”，无需也不再支持 `SYNC_ONLINE_INDEX` 开关。
    - MySQL：`ALTER TABLE ... ADD/DROP INDEX ... ALGORITHM=INPLACE, LOCK=NONE`
    - PostgreSQL：`CREATE/DROP INDEX CONCURRENTLY`
    - SQLite：不支持并发/在线索引，按常规 `CREATE/DROP INDEX` 执行
    - 注意：PG 的 CONCURRENTLY 需在非事务上下文执行，脚本已按语句逐条执行。

## 统计输出

脚本执行完成后，会打印变更维度统计：

- 字段新增（新增列数量）
- 字段名称变更（来自第 1 段显示名变动，对应 COMMENT 变化）
- 字段类型变更（如 varchar → mediumtext）
- 字段最小值变更（占位统计，当前规则不产生最小值 DDL，默认为 0）
- 字段最大值变更（长度变化，如 VARCHAR(100) → VARCHAR(200)）
- 字段默认值变更（DEFAULT 差异：SET/DROP/更新）
- 索引新增（依据第 6 段是否创建索引）
- 索引删除（依据第 6 段是否创建索引）

示例输出（无实际变更时）：

```
统计 - 创建表: 0
统计 - 字段新增: 0
统计 - 字段名称变更: 0
统计 - 字段类型变更: 0
统计 - 字段最小值变更: 0
统计 - 字段最大值变更: 0
统计 - 字段默认值变更: 0
统计 - 索引新增: 0
统计 - 索引删除: 0
```

## 错误处理

- 规则校验失败：直接中止并输出错误
- 版本不符（MariaDB 或 MySQL < 8）：中止并输出版本信息
- DDL 执行失败：按回退策略重试；若最终失败，会抛出错误并中止
- 关闭连接：最终阶段确保关闭连接，若失败记录告警
