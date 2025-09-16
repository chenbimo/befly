# SQLite 与 PostgreSQL 注意事项

## SQLite（≥ 3.50.0）

-   新增列支持：`ADD COLUMN IF NOT EXISTS ... DEFAULT ... NOT NULL`
-   修改默认值：不支持；需重建表（未来将通过 `SYNC_SQLITE_REBUILD=1` 控制）。
-   复杂列变更：不支持在线修改；必要时走“创建临时表 -> 拷贝公共列 -> 重命名”的迁移路线。
-   不支持列注释；索引使用 `CREATE INDEX IF NOT EXISTS`。

## PostgreSQL（≥ 17）

-   索引：使用 `CREATE/DROP INDEX CONCURRENTLY`；需非事务上下文。
-   列注释：通过 `COMMENT ON COLUMN` 同步。
-   兼容扩容：`varchar(n)->varchar(m>=n)`、`varchar(n)->text` 识别为兼容变更，生成最小化 ALTER。
-   收缩/不兼容：默认禁止（`SYNC_DISALLOW_SHRINK=1`）。

详情参见仓库根 `AGENTS.md` 对专用策略的阐述。
