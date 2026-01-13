/**
 * syncTable 命令 - 同步数据库表结构（单文件版）
 *
 * 说明：
 * - 历史上该能力拆分在 packages/core/sync/syncTable/* 多个模块中
 * - 现在按项目要求，将所有实现合并到本文件（目录 packages/core/sync/syncTable/ 已删除）
 */

import type { DbDialectName } from "../lib/dbDialect";
import type { JsonValue } from "../types/common";
import type { DbResult, SqlInfo } from "../types/database";
import type { ColumnInfo, FieldChange, IndexInfo, TablePlan } from "../types/sync";
import type { FieldDefinition } from "../types/validate";
import type { ScanFileResult } from "../utils/scanFiles";

import { CacheKeys } from "../lib/cacheKeys";
import { getDialectByName, getSyncTableColumnsInfoQuery, getSyncTableIndexesQuery } from "../lib/dbDialect";
import { Logger } from "../lib/logger";
import { normalizeFieldDefinition } from "../utils/normalizeFieldDefinition";
import { snakeCase } from "../utils/util";

type SqlExecutor = {
    unsafe<T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

type SyncTableContext = {
    db: SqlExecutor;
    redis: {
        delBatch(keys: string[]): Promise<unknown>;
    };
    config: {
        db?: {
            dialect?: DbDialectName;
            database?: string;
        };
    };
};

type MySqlTableExistsRow = { count: number };
type MySqlColumnInfoRow = {
    COLUMN_NAME: string;
    DATA_TYPE: string;
    COLUMN_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH: number | null;
    IS_NULLABLE: "YES" | "NO";
    COLUMN_DEFAULT: unknown;
    COLUMN_COMMENT: string | null;
};

type PgTableExistsRow = { count: number };
type PgColumnInfoRow = {
    column_name: string;
    data_type: string;
    character_maximum_length: number | null;
    is_nullable: string;
    column_default: unknown;
};
type PgColumnCommentRow = {
    column_name: string;
    column_comment: string;
};

type MySqlIndexRow = {
    INDEX_NAME: string;
    COLUMN_NAME: string;
};

type PgIndexRow = {
    indexname: string;
    indexdef: string;
};

type SqliteTableInfoRow = {
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
};

type SqliteIndexListRow = { name: string };
type SqliteIndexInfoRow = { name: string };

type DbDialect = DbDialectName;

/* ========================================================================== */
/* 对外导出面
 *
 * 约束：本文件仅导出一个函数：syncTable。
 * - 生产代码：通过 await 同步表： 执行同步。
 * - 测试：通过 syncTable.TestKit 访问纯函数/常量（不再导出零散函数）。
 */
/* ========================================================================== */

/**
 * 文件导航（推荐阅读顺序）
 * 1) 同步表： 入口（本段下方）
 * 2) 版本/常量/方言判断（DB_VERSION_REQUIREMENTS 等）
 * 3) 通用 DDL 工具（quote/type/default/ddl/index SQL）
 * 4) Runtime I/O（只读元信息：表/列/索引/版本）
 * 5) plan/apply（写变更：建表/改表/SQLite 重建）
 */

type SyncTableFn = ((ctx: SyncTableContext, items: ScanFileResult[]) => Promise<void>) & {
    TestKit: typeof SYNC_TABLE_TEST_KIT;
};

/**
 * 数据库同步命令入口（函数模式）
 */
export const syncTable = (async (ctx: SyncTableContext, items: ScanFileResult[]): Promise<void> => {
    try {
        // 记录处理过的表名（用于清理缓存）
        const processedTables: string[] = [];

        if (!Array.isArray(items)) {
            throw new Error("同步表：请传入多个表定义组成的数组");
        }

        if (!ctx?.db) {
            throw new Error("同步表： 缺少 ctx.db");
        }
        if (!ctx.redis) {
            throw new Error("同步表： 缺少 ctx.redis");
        }
        if (!ctx.config) {
            throw new Error("同步表： 缺少 ctx.config");
        }

        if (!ctx.config.db?.dialect) {
            throw new Error("同步表： 缺少 ctx.config.db.dialect");
        }

        // DbDialect（按项目约定：正常启动时会先通过 checkConfig，因此这里直接使用配置值）
        const dbDialect: DbDialect = ctx.config.db.dialect;

        // 检查数据库版本（复用 ctx.db 的现有连接/事务）
        await ensureDbVersion(dbDialect, ctx.db);

        const databaseName = ctx.config.db?.database || "";
        const runtime: SyncRuntime = {
            dbDialect: dbDialect,
            db: ctx.db,
            dbName: databaseName
        };

        // 处理传入的 tables 数据（来自 scanSources）
        for (const item of items) {
            if (!item || item.type !== "table") {
                continue;
            }

            if (item.source !== "app" && item.source !== "addon" && item.source !== "core") {
                Logger.warn(`syncTable 跳过未知来源表定义: source=${String(item.source)} fileName=${String(item.fileName)}`);
                continue;
            }

            // 确定表名：
            // - addon 表：addon_{addonName}_{fileName}
            // - app/core 表：{fileName}
            const baseTableName = snakeCase(item.fileName);

            let tableName = baseTableName;
            if (item.source === "addon") {
                if (!item.addonName || String(item.addonName).trim() === "") {
                    throw new Error(`syncTable addon 表缺少 addonName: fileName=${String(item.fileName)}`);
                }
                tableName = `addon_${snakeCase(item.addonName)}_${baseTableName}`;
            }

            const tableDefinition = item.content;
            if (!tableDefinition || typeof tableDefinition !== "object") {
                throw new Error(`syncTable 表定义无效: table=${tableName}`);
            }

            // 为字段属性设置默认值：表定义来自 JSON/扫描结果，字段可能缺省。
            // 缺省会让 diff/DDL 生成出现 undefined vs null 等差异，导致错误的变更判断。
            for (const fieldDef of Object.values(tableDefinition)) {
                applyFieldDefaults(fieldDef);
            }

            const existsTable = await tableExistsRuntime(runtime, tableName);

            const tableFields = tableDefinition as Record<string, FieldDefinition>;

            if (existsTable) {
                await modifyTableRuntime(runtime, tableName, tableFields);
            } else {
                await createTable(runtime, tableName, tableFields);
            }

            // 记录处理过的表名（用于清理缓存）
            processedTables.push(tableName);
        }

        // 清理 Redis 缓存（如果有表被处理）
        if (processedTables.length > 0) {
            const cacheKeys = processedTables.map((tableName) => CacheKeys.tableColumns(tableName));
            await ctx.redis.delBatch(cacheKeys);
        }
    } catch (error: any) {
        Logger.error({ err: error, msg: "数据库同步失败" });
        throw error;
    }
}) as SyncTableFn;

/* ========================================================================== */
/* 版本/常量/运行时方言状态 */
/* ========================================================================== */

/**
 * 数据库版本要求
 */
const DB_VERSION_REQUIREMENTS = {
    MYSQL_MIN_MAJOR: 8,
    POSTGRES_MIN_MAJOR: 17,
    SQLITE_MIN_VERSION: "3.50.0",
    SQLITE_MIN_VERSION_NUM: 35000 // 3 * 10000 + 50 * 100
} as const;

/**
 * 字段变更类型的中文标签映射
 */
const CHANGE_TYPE_LABELS = {
    length: "长度",
    datatype: "类型",
    comment: "注释",
    default: "默认值",
    nullable: "可空约束",
    unique: "唯一约束"
} as const;

/**
 * MySQL 表配置
 */
const MYSQL_TABLE_CONFIG = {
    ENGINE: "InnoDB",
    CHARSET: "utf8mb4",
    COLLATE: "utf8mb4_0900_ai_ci"
} as const;

type SystemFieldMeta = {
    name: "id" | "created_at" | "updated_at" | "deleted_at" | "state";
    comment: string;
    needsIndex: boolean;
    mysqlDdl: string;
    pgDdl: string;
    sqliteDdl: string;
};

/**
 * 系统字段定义：三处会用到
 * - createTable：建表时追加系统字段列定义
 * - modifyTable：对已存在的表补齐缺失的系统字段
 * - SYSTEM_INDEX_FIELDS：从 needsIndex 派生默认系统索引集合
 */
const SYSTEM_FIELDS: ReadonlyArray<SystemFieldMeta> = [
    {
        name: "id",
        comment: "主键ID",
        needsIndex: false,
        mysqlDdl: "BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT",
        pgDdl: "BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY",
        sqliteDdl: "INTEGER PRIMARY KEY"
    },
    {
        name: "created_at",
        comment: "创建时间",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0",
        pgDdl: "BIGINT NOT NULL DEFAULT 0",
        sqliteDdl: "INTEGER NOT NULL DEFAULT 0"
    },
    {
        name: "updated_at",
        comment: "更新时间",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0",
        pgDdl: "BIGINT NOT NULL DEFAULT 0",
        sqliteDdl: "INTEGER NOT NULL DEFAULT 0"
    },
    {
        name: "deleted_at",
        comment: "删除时间",
        needsIndex: false,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0",
        pgDdl: "BIGINT NOT NULL DEFAULT 0",
        sqliteDdl: "INTEGER NOT NULL DEFAULT 0"
    },
    {
        name: "state",
        comment: "状态字段",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 1",
        pgDdl: "BIGINT NOT NULL DEFAULT 1",
        sqliteDdl: "INTEGER NOT NULL DEFAULT 1"
    }
];

/**
 * 需要创建索引的系统字段
 */
const SYSTEM_INDEX_FIELDS: ReadonlyArray<string> = SYSTEM_FIELDS.filter((f) => f.needsIndex).map((f) => f.name);

const SYSTEM_FIELD_META_MAP: Record<string, SystemFieldMeta> = {};
for (const f of SYSTEM_FIELDS) {
    SYSTEM_FIELD_META_MAP[f.name] = f;
}

const SYNC_TABLE_TEST_KIT = {
    DB_VERSION_REQUIREMENTS: DB_VERSION_REQUIREMENTS,
    CHANGE_TYPE_LABELS: CHANGE_TYPE_LABELS,
    MYSQL_TABLE_CONFIG: MYSQL_TABLE_CONFIG,
    SYSTEM_INDEX_FIELDS: SYSTEM_INDEX_FIELDS,

    getTypeMapping: getTypeMapping,
    quoteIdentifier: quoteIdentifier,
    escapeComment: escapeComment,
    applyFieldDefaults: applyFieldDefaults,
    isStringOrArrayType: isStringOrArrayType,
    getSqlType: getSqlType,
    resolveDefaultValue: resolveDefaultValue,
    generateDefaultSql: generateDefaultSql,
    buildIndexSQL: buildIndexSQL,
    buildSystemColumnDefs: buildSystemColumnDefs,
    buildBusinessColumnDefs: buildBusinessColumnDefs,
    generateDDLClause: generateDDLClause,
    isCompatibleTypeChange: isCompatibleTypeChange,
    compareFieldDefinition: compareFieldDefinition,

    tableExistsRuntime: tableExistsRuntime,
    getTableColumnsRuntime: getTableColumnsRuntime,
    getTableIndexesRuntime: getTableIndexesRuntime,

    createRuntime: (dbDialect: DbDialect, db: SqlExecutor | null, dbName: string = ""): SyncRuntimeForIO => {
        return {
            dbDialect: dbDialect,
            db: db,
            dbName: dbName
        };
    }
};

// 测试能力挂载（避免导出零散函数，同时确保运行时存在）
syncTable.TestKit = SYNC_TABLE_TEST_KIT;

// 防御性：避免运行时被误覆盖（只读），但仍保持可枚举/可访问。
Object.defineProperty(syncTable, "TestKit", {
    value: SYNC_TABLE_TEST_KIT,
    writable: false,
    enumerable: true,
    configurable: false
});

/**
 * 获取字段类型映射（根据当前数据库类型）
 */
function getTypeMapping(dbDialect: DbDialect): Record<string, string> {
    return {
        number: dbDialect === "sqlite" ? "INTEGER" : dbDialect === "postgresql" ? "BIGINT" : "BIGINT",
        string: dbDialect === "sqlite" ? "TEXT" : dbDialect === "postgresql" ? "character varying" : "VARCHAR",
        text: dbDialect === "mysql" ? "MEDIUMTEXT" : "TEXT",
        array_string: dbDialect === "sqlite" ? "TEXT" : dbDialect === "postgresql" ? "character varying" : "VARCHAR",
        array_text: dbDialect === "mysql" ? "MEDIUMTEXT" : "TEXT",
        array_number_string: dbDialect === "sqlite" ? "TEXT" : dbDialect === "postgresql" ? "character varying" : "VARCHAR",
        array_number_text: dbDialect === "mysql" ? "MEDIUMTEXT" : "TEXT"
    };
}

/* ========================================================================== */
/* 通用工具与 DDL 片段生成 */
/* ========================================================================== */

/**
 * 根据数据库类型引用标识符
 */
function quoteIdentifier(dbDialect: DbDialect, identifier: string): string {
    return getDialectByName(dbDialect).quoteIdent(identifier);
}

/**
 * 转义 SQL 注释中的双引号
 */
function escapeComment(str: string): string {
    return String(str).replace(/"/g, '\\"');
}

function normalizeColumnDefaultValue(value: unknown): JsonValue {
    if (value === null) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        const items: JsonValue[] = [];
        for (const v of value) {
            items.push(normalizeColumnDefaultValue(v));
        }
        return items;
    }
    return String(value);
}

// 注意：这里刻意不封装“logFieldChange/formatFieldList”之类的一次性工具函数，
// 以减少抽象层级（按项目要求：能直写就直写）。

/**
 * 为字段定义应用默认值
 */
function isJsonValue(value: unknown): value is JsonValue {
    if (value === null) return true;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;

    if (Array.isArray(value)) {
        return value.every((v) => isJsonValue(v));
    }

    if (typeof value === "object") {
        for (const v of Object.values(value as Record<string, unknown>)) {
            if (v === undefined) continue;
            if (!isJsonValue(v)) return false;
        }
        return true;
    }

    return false;
}

function applyFieldDefaults(fieldDef: unknown): void {
    if (!fieldDef || typeof fieldDef !== "object") return;
    const record = fieldDef as Record<string, unknown>;

    const name = record["name"];
    const type = record["type"];
    if (typeof name !== "string" || typeof type !== "string") return;

    const minRaw = record["min"];
    const maxRaw = record["max"];
    const defaultRaw = record["default"];
    const detailRaw = record["detail"];
    const indexRaw = record["index"];
    const uniqueRaw = record["unique"];
    const nullableRaw = record["nullable"];
    const unsignedRaw = record["unsigned"];
    const regexpRaw = record["regexp"];

    const input: FieldDefinition = {
        name: name,
        type: type
    };

    if (typeof detailRaw === "string") {
        input.detail = detailRaw;
    }

    if (typeof minRaw === "number" || minRaw === null) {
        input.min = minRaw;
    }

    if (typeof maxRaw === "number" || maxRaw === null) {
        input.max = maxRaw;
    }

    if (defaultRaw === null) {
        input.default = null;
    } else if (isJsonValue(defaultRaw)) {
        input.default = defaultRaw;
    }

    if (typeof indexRaw === "boolean") {
        input.index = indexRaw;
    }

    if (typeof uniqueRaw === "boolean") {
        input.unique = uniqueRaw;
    }

    if (typeof nullableRaw === "boolean") {
        input.nullable = nullableRaw;
    }

    if (typeof unsignedRaw === "boolean") {
        input.unsigned = unsignedRaw;
    }

    if (typeof regexpRaw === "string" || regexpRaw === null) {
        input.regexp = regexpRaw;
    }

    const normalized = normalizeFieldDefinition(input);
    record["detail"] = normalized.detail;
    record["min"] = normalized.min;
    record["max"] = normalized.max;
    record["default"] = normalized.default;
    record["index"] = normalized.index;
    record["unique"] = normalized.unique;
    record["nullable"] = normalized.nullable;
    record["unsigned"] = normalized.unsigned;
    record["regexp"] = normalized.regexp;
}

/**
 * 判断是否为字符串或数组类型（需要长度参数）
 */
function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string";
}

/**
 * 获取 SQL 数据类型
 */
function getSqlType(dbDialect: DbDialect, fieldType: string, fieldMax: number | null, unsigned: boolean = false): string {
    const typeMapping = getTypeMapping(dbDialect);
    if (isStringOrArrayType(fieldType)) {
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }
    const baseType = typeMapping[fieldType] || "TEXT";
    if (dbDialect === "mysql" && fieldType === "number" && unsigned) {
        return `${baseType} UNSIGNED`;
    }
    return baseType;
}

/**
 * 处理默认值：将 null 或 'null' 字符串转换为对应类型的默认值
 */
function resolveDefaultValue(fieldDefault: any, fieldType: string): any {
    if (fieldDefault !== null && fieldDefault !== "null") {
        return fieldDefault;
    }

    switch (fieldType) {
        case "number":
            return 0;
        case "string":
            return "";
        case "array_string":
        case "array_number_string":
            return "[]";
        case "text":
        case "array_text":
        case "array_number_text":
            return "null";
        default:
            return fieldDefault;
    }
}

/**
 * 生成 SQL DEFAULT 子句
 */
function generateDefaultSql(actualDefault: any, fieldType: string): string {
    if (fieldType === "text" || fieldType === "array_text" || actualDefault === "null") {
        return "";
    }

    if (fieldType === "number" || fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string") {
        if (typeof actualDefault === "number" && !Number.isNaN(actualDefault)) {
            return ` DEFAULT ${actualDefault}`;
        } else {
            const escaped = String(actualDefault).replace(/'/g, "''");
            return ` DEFAULT '${escaped}'`;
        }
    }

    return "";
}

/**
 * 构建索引操作 SQL（统一使用在线策略）
 */
function buildIndexSQL(dbDialect: DbDialect, tableName: string, indexName: string, fieldName: string, action: "create" | "drop"): string {
    // 说明（策略取舍）：
    // - MySQL：通过 ALTER TABLE 在线添加/删除索引；配合 ALGORITHM/LOCK 以降低阻塞。
    // - PostgreSQL：CREATE/DROP INDEX CONCURRENTLY 尽量减少锁表（代价是执行更慢/有并发限制）。
    // - SQLite：DDL 能力有限，使用 IF NOT EXISTS/IF EXISTS 尽量做到幂等。
    const tableQuoted = quoteIdentifier(dbDialect, tableName);
    const indexQuoted = quoteIdentifier(dbDialect, indexName);
    const fieldQuoted = quoteIdentifier(dbDialect, fieldName);

    if (dbDialect === "mysql") {
        const parts: string[] = [];
        if (action === "create") {
            parts.push(`ADD INDEX ${indexQuoted} (${fieldQuoted})`);
        } else {
            parts.push(`DROP INDEX ${indexQuoted}`);
        }
        return `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ${parts.join(", ")}`;
    }

    if (dbDialect === "postgresql") {
        if (action === "create") {
            return `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexQuoted} ON ${tableQuoted}(${fieldQuoted})`;
        }
        return `DROP INDEX CONCURRENTLY IF EXISTS ${indexQuoted}`;
    }

    if (action === "create") {
        return `CREATE INDEX IF NOT EXISTS ${indexQuoted} ON ${tableQuoted}(${fieldQuoted})`;
    }
    return `DROP INDEX IF EXISTS ${indexQuoted}`;
}

/**
 * 获取单个系统字段的列定义（用于 ADD COLUMN 或 CREATE TABLE）
 */
function getSystemColumnDef(dbDialect: DbDialect, fieldName: string): string | null {
    const meta = SYSTEM_FIELD_META_MAP[fieldName];
    if (!meta) return null;

    const colQuoted = quoteIdentifier(dbDialect, meta.name);
    if (dbDialect === "mysql") {
        return `${colQuoted} ${meta.mysqlDdl} COMMENT "${escapeComment(meta.comment)}"`;
    }

    if (dbDialect === "postgresql") {
        return `${colQuoted} ${meta.pgDdl}`;
    }

    return `${colQuoted} ${meta.sqliteDdl}`;
}

/**
 * 构建系统字段列定义
 */
function buildSystemColumnDefs(dbDialect: DbDialect): string[] {
    const defs: string[] = [];
    for (const f of SYSTEM_FIELDS) {
        const d = getSystemColumnDef(dbDialect, f.name);
        if (d) defs.push(d);
    }
    return defs;
}

/**
 * 构建业务字段列定义
 */
function buildBusinessColumnDefs(dbDialect: DbDialect, fields: Record<string, FieldDefinition>): string[] {
    const colDefs: string[] = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const normalized = normalizeFieldDefinition(fieldDef);
        const dbFieldName = snakeCase(fieldKey);
        const colQuoted = quoteIdentifier(dbDialect, dbFieldName);

        const sqlType = getSqlType(dbDialect, normalized.type, normalized.max, normalized.unsigned);

        const actualDefault = resolveDefaultValue(normalized.default, normalized.type);
        const defaultSql = generateDefaultSql(actualDefault, normalized.type);

        const uniqueSql = normalized.unique ? " UNIQUE" : "";
        const nullableSql = normalized.nullable ? " NULL" : " NOT NULL";

        if (dbDialect === "mysql") {
            colDefs.push(`${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(normalized.name)}"`);
        } else {
            colDefs.push(`${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`);
        }
    }

    return colDefs;
}

/**
 * 生成字段 DDL 子句（不含 ALTER TABLE 前缀）
 */
function generateDDLClause(dbDialect: DbDialect, fieldKey: string, fieldDef: FieldDefinition, isAdd: boolean = false): string {
    // 说明（策略取舍）：
    // - MySQL：ADD/MODIFY 一条子句内可同时表达类型/可空/默认值/注释（同步成本低）。
    // - PostgreSQL：modify 场景这里仅生成 TYPE 变更；默认值/注释等由其他子句或 commentActions 处理。
    // - SQLite：不支持标准化的 MODIFY COLUMN，这里仅提供 ADD COLUMN；复杂变更通过 rebuildSqliteTable 完成。
    const dbFieldName = snakeCase(fieldKey);
    const colQuoted = quoteIdentifier(dbDialect, dbFieldName);

    const normalized = normalizeFieldDefinition(fieldDef);

    const sqlType = getSqlType(dbDialect, normalized.type, normalized.max, normalized.unsigned);

    const actualDefault = resolveDefaultValue(normalized.default, normalized.type);
    const defaultSql = generateDefaultSql(actualDefault, normalized.type);

    const uniqueSql = normalized.unique ? " UNIQUE" : "";
    const nullableSql = normalized.nullable ? " NULL" : " NOT NULL";

    if (dbDialect === "mysql") {
        return `${isAdd ? "ADD COLUMN" : "MODIFY COLUMN"} ${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(normalized.name)}"`;
    }
    if (dbDialect === "postgresql") {
        if (isAdd) return `ADD COLUMN IF NOT EXISTS ${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
        return `ALTER COLUMN ${colQuoted} TYPE ${sqlType}`;
    }
    if (isAdd) return `ADD COLUMN IF NOT EXISTS ${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
    return "";
}

/**
 * 安全执行 DDL 语句（MySQL 降级策略）
 */
async function executeDDLSafely(db: SqlExecutor, stmt: string): Promise<boolean> {
    // MySQL DDL 兼容性/可用性兜底：
    // - 优先执行原语句（通常含 ALGORITHM=INSTANT）。
    // - 若 INSTANT 不可用（版本/表结构限制），降级为 INPLACE 再试。
    // - 若仍失败，去掉 ALGORITHM/LOCK 提示字段，以最大兼容性执行传统 ALTER。
    try {
        await db.unsafe(stmt);
        return true;
    } catch (error: any) {
        if (stmt.includes("ALGORITHM=INSTANT")) {
            const inplaceSql = stmt.replace(/ALGORITHM=INSTANT/g, "ALGORITHM=INPLACE");
            try {
                await db.unsafe(inplaceSql);
                return true;
            } catch {
                let traditionSql = stmt;
                traditionSql = traditionSql.replace(/\bALGORITHM\s*=\s*(INPLACE|INSTANT)\b\s*,?\s*/g, "").replace(/\bLOCK\s*=\s*(NONE|SHARED|EXCLUSIVE)\b\s*,?\s*/g, "");

                traditionSql = traditionSql
                    .replace(/,\s*,/g, ", ")
                    .replace(/,\s*$/g, "")
                    .replace(/\s{2,}/g, " ")
                    .trim();
                await db.unsafe(traditionSql);
                return true;
            }
        } else {
            throw error;
        }
    }
}

/**
 * 判断是否为兼容的类型变更（宽化型变更，无数据丢失风险）
 */
function isCompatibleTypeChange(currentType: string | null | undefined, newType: string | null | undefined): boolean {
    // 说明：该函数用于“自动同步”里的安全阈值判断。
    // - 允许：宽化型变更（不收缩、不改变语义大类），例如：
    //   - INT -> BIGINT（或 tinyint/smallint/mediumint -> 更宽的整型）
    //   - VARCHAR -> TEXT/MEDIUMTEXT/LONGTEXT
    //   - character varying -> text（PG 常见）
    // - 禁止：收缩型变更（BIGINT -> INT、TEXT -> VARCHAR）以及跨大类变更（需人工评估/迁移）。
    const c = String(currentType || "").toLowerCase();
    const n = String(newType || "").toLowerCase();

    if (c === n) return false;

    const cBase = c
        .replace(/\s*unsigned/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

    const nBase = n
        .replace(/\s*unsigned/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

    const intTypes = ["tinyint", "smallint", "mediumint", "int", "integer", "bigint"];
    const cIntIdx = intTypes.indexOf(cBase);
    const nIntIdx = intTypes.indexOf(nBase);
    if (cIntIdx !== -1 && nIntIdx !== -1 && nIntIdx > cIntIdx) {
        return true;
    }

    if (cBase === "varchar" && (nBase === "text" || nBase === "mediumtext" || nBase === "longtext")) return true;
    if (cBase === "character varying" && nBase === "text") return true;

    return false;
}

type SyncRuntime = {
    /**
     * 当前数据库方言（mysql/postgresql/sqlite），决定 SQL 片段与元信息查询方式。
     * 约束：必须与 ctx.config.db.dialect 一致（经归一化）。
     */
    dbDialect: DbDialect;
    /**
     * SQL 执行器：必须复用 ctx.db。
     * 约束：syncTable 内部禁止新建 DB 连接/事务；runtime 仅保存引用，不拥有生命周期。
     */
    db: SqlExecutor;
    /**
     * 数据库名：主要用于 MySQL information_schema 查询。
     * 约束：PG/SQLite 可以传空字符串；不要在非 MySQL 方言依赖该值。
     */
    dbName: string;
};

type SyncRuntimeForIO = {
    dbDialect: DbDialect;
    db: SqlExecutor | null;
    dbName: string;
};

/* ========================================================================== */
/* runtime I/O（只读：读库/元信息查询）
 *
 * 说明：
 * - 本区块只负责“查询元信息”（表/列/索引/版本）。
 * - 写变更（DDL 执行）统一在下方 plan/apply 区块中完成。
 * - 对外不再保留 dbDialect/db/dbName 形式的 wrapper；统一使用 runtime 形态（更直写）。
 */
/* ========================================================================== */

// ---------------------------------------------------------------------------
// 读：表是否存在
// ---------------------------------------------------------------------------

async function tableExistsRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<boolean> {
    const db = runtime.db;
    if (!db) throw new Error("SQL 执行器未初始化");
    try {
        // 统一交由方言层构造 SQL；syncTable 仅决定“要查哪个 schema/db”。
        // - MySQL：传 runtime.dbName（information_schema.table_schema）
        // - PostgreSQL：固定 public（项目约定）
        // - SQLite：忽略 schema
        let schema: string | undefined = undefined;
        if (runtime.dbDialect === "mysql") {
            schema = runtime.dbName;
        } else if (runtime.dbDialect === "postgresql") {
            schema = "public";
        }

        const q = getDialectByName(runtime.dbDialect).tableExistsQuery(tableName, schema);
        const res = await db.unsafe<MySqlTableExistsRow[] | PgTableExistsRow[]>(q.sql, q.params);
        return (res.data?.[0]?.count || 0) > 0;
    } catch (error: any) {
        const errMsg = String(error?.message || error);
        const outErr: any = new Error(`runtime I/O 失败: op=tableExists table=${tableName} err=${errMsg}`);
        if (error?.sqlInfo) outErr.sqlInfo = error.sqlInfo;
        throw outErr;
    }
}

// ---------------------------------------------------------------------------
// 读：列信息
// ---------------------------------------------------------------------------

async function getTableColumnsRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<{ [key: string]: ColumnInfo }> {
    // 返回的列数据示例
    // [{
    //   is_system: {
    //     type: "bigint",
    //     columnType: "bigint unsigned",
    //     length: null,
    //     max: null,
    //     nullable: false,
    //     defaultValue: "0",
    //     comment: '',
    // },
    // description: {
    //     type: "varchar",
    //     columnType: "varchar(500)",
    //     length: 500,
    //     max: 500,
    //     nullable: false,
    //     defaultValue: "",
    //     comment: '',
    // }]

    const columns: { [key: string]: ColumnInfo } = {};

    const db = runtime.db;
    if (!db) throw new Error("SQL 执行器未初始化");

    try {
        // 方言差异说明：
        // - MySQL：information_schema.columns 最完整，包含 COLUMN_TYPE 与 COLUMN_COMMENT。
        // - PostgreSQL：information_schema.columns 给基础列信息；注释需额外从 pg_class/pg_attribute 获取。
        // - SQLite：PRAGMA table_info 仅提供 type/notnull/default 等有限信息，无列注释。
        if (runtime.dbDialect === "mysql") {
            const q = getSyncTableColumnsInfoQuery({ dialect: "mysql", table: tableName, dbName: runtime.dbName });
            const result = await db.unsafe<MySqlColumnInfoRow[]>(q.columns.sql, q.columns.params);
            for (const row of result.data) {
                const defaultValue = normalizeColumnDefaultValue(row.COLUMN_DEFAULT);

                columns[row.COLUMN_NAME] = {
                    // 防御性：某些 driver/编码设置可能导致字符串字段不是 string（如 Buffer/number/null）。
                    type: String(row.DATA_TYPE ?? ""),
                    columnType: String(row.COLUMN_TYPE ?? ""),
                    length: row.CHARACTER_MAXIMUM_LENGTH,
                    max: row.CHARACTER_MAXIMUM_LENGTH,
                    nullable: row.IS_NULLABLE === "YES",
                    defaultValue: defaultValue,
                    comment: row.COLUMN_COMMENT
                };
            }
        } else if (runtime.dbDialect === "postgresql") {
            const q = getSyncTableColumnsInfoQuery({ dialect: "postgresql", table: tableName, dbName: runtime.dbName });
            const result = await db.unsafe<PgColumnInfoRow[]>(q.columns.sql, q.columns.params);
            const comments = q.comments ? (await db.unsafe<PgColumnCommentRow[]>(q.comments.sql, q.comments.params)).data : [];
            const commentMap: { [key: string]: string } = {};
            for (const r of comments) commentMap[r.column_name] = r.column_comment;

            for (const row of result.data) {
                columns[row.column_name] = {
                    type: String(row.data_type ?? ""),
                    columnType: String(row.data_type ?? ""),
                    length: row.character_maximum_length,
                    max: row.character_maximum_length,
                    nullable: String(row.is_nullable).toUpperCase() === "YES",
                    defaultValue: normalizeColumnDefaultValue(row.column_default),
                    comment: commentMap[row.column_name] ?? null
                };
            }
        } else if (runtime.dbDialect === "sqlite") {
            const q = getSyncTableColumnsInfoQuery({ dialect: "sqlite", table: tableName, dbName: runtime.dbName });
            const result = await db.unsafe<SqliteTableInfoRow[]>(q.columns.sql, q.columns.params);
            for (const row of result.data) {
                let baseType = String(row.type || "").toUpperCase();
                let max = null;
                const m = /^(\w+)\s*\((\d+)\)/.exec(baseType);
                if (m) {
                    const base = m[1];
                    const maxText = m[2];
                    if (typeof base === "string") {
                        baseType = base;
                    }
                    if (typeof maxText === "string") {
                        max = Number(maxText);
                    }
                }
                columns[row.name] = {
                    type: String(baseType).toLowerCase(),
                    columnType: String(baseType).toLowerCase(),
                    length: max,
                    max: max,
                    nullable: row.notnull === 0,
                    defaultValue: normalizeColumnDefaultValue(row.dflt_value),
                    comment: null
                };
            }
        }

        return columns;
    } catch (error: any) {
        const errMsg = String(error?.message || error);
        const outErr: any = new Error(`runtime I/O 失败: op=getTableColumns table=${tableName} err=${errMsg}`);
        if (error?.sqlInfo) outErr.sqlInfo = error.sqlInfo;
        throw outErr;
    }
}

// ---------------------------------------------------------------------------
// 读：索引信息（单列索引）
// ---------------------------------------------------------------------------

async function getTableIndexesRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<IndexInfo> {
    //  索引返回示例
    //  {
    //     code: [ "code" ],
    //     idx_created_at: [ "created_at" ],
    //     idx_group: [ "group" ],
    //     idx_state: [ "state" ],
    //     idx_updated_at: [ "updated_at" ],
    // }

    const indexes: IndexInfo = {};

    const db = runtime.db;
    if (!db) throw new Error("SQL 执行器未初始化");

    try {
        // 方言差异说明：
        // - MySQL：information_schema.statistics 直接给出 index -> column 映射。
        // - PostgreSQL：pg_indexes 只有 indexdef，需要从定义里解析列名（这里仅取单列索引）。
        // - SQLite：PRAGMA index_list + index_info；同样仅收集单列索引，避免多列索引误判。
        if (runtime.dbDialect === "mysql") {
            const q = getSyncTableIndexesQuery({ dialect: "mysql", table: tableName, dbName: runtime.dbName });
            const result = await db.unsafe<MySqlIndexRow[]>(q.sql, q.params);
            for (const row of result.data) {
                const indexName = row.INDEX_NAME;
                const current = indexes[indexName];
                if (Array.isArray(current)) {
                    current.push(row.COLUMN_NAME);
                } else {
                    indexes[indexName] = [row.COLUMN_NAME];
                }
            }
        } else if (runtime.dbDialect === "postgresql") {
            const q = getSyncTableIndexesQuery({ dialect: "postgresql", table: tableName, dbName: runtime.dbName });
            const result = await db.unsafe<PgIndexRow[]>(q.sql, q.params);
            for (const row of result.data) {
                const m = /\(([^)]+)\)/.exec(row.indexdef);
                if (m) {
                    const colPart = m[1];
                    const col = typeof colPart === "string" ? colPart.replace(/"/g, "").trim() : "";
                    indexes[row.indexname] = [col];
                }
            }
        } else if (runtime.dbDialect === "sqlite") {
            const quotedTable = quoteIdentifier("sqlite", tableName);
            const list = await db.unsafe<SqliteIndexListRow[]>(`PRAGMA index_list(${quotedTable})`);
            for (const idx of list.data) {
                const quotedIndex = quoteIdentifier("sqlite", idx.name);
                const info = await db.unsafe<SqliteIndexInfoRow[]>(`PRAGMA index_info(${quotedIndex})`);
                const cols = info.data.map((r) => r.name);
                if (cols.length === 1) indexes[idx.name] = cols;
            }
        }

        return indexes;
    } catch (error: any) {
        const errMsg = String(error?.message || error);
        const outErr: any = new Error(`runtime I/O 失败: op=getTableIndexes table=${tableName} err=${errMsg}`);
        if (error?.sqlInfo) outErr.sqlInfo = error.sqlInfo;
        throw outErr;
    }
}

// ---------------------------------------------------------------------------
// 读：数据库版本
// ---------------------------------------------------------------------------

/**
 * 数据库版本检查（按方言）
 */
async function ensureDbVersion(dbDialect: DbDialect, db: SqlExecutor): Promise<void> {
    if (!db) throw new Error("SQL 执行器未初始化");

    if (dbDialect === "mysql") {
        const r = await db.unsafe<Array<{ version: string }>>("SELECT VERSION() AS version");
        if (!r.data || r.data.length === 0 || !r.data[0]?.version) {
            throw new Error("无法获取 MySQL 版本信息");
        }
        const version = r.data[0].version;
        const majorPart = String(version).split(".")[0] || "0";
        const majorVersion = parseInt(majorPart, 10);
        if (!Number.isFinite(majorVersion) || majorVersion < DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR) {
            throw new Error(`此脚本仅支持 MySQL ${DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR}.0+，当前版本: ${version}`);
        }
        return;
    }

    if (dbDialect === "postgresql") {
        const r = await db.unsafe<Array<{ version: string }>>("SELECT version() AS version");
        if (!r.data || r.data.length === 0 || !r.data[0]?.version) {
            throw new Error("无法获取 PostgreSQL 版本信息");
        }
        const versionText = r.data[0].version;
        const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
        const majorText = m ? m[1] : undefined;
        const major = typeof majorText === "string" ? parseInt(majorText, 10) : NaN;
        if (!Number.isFinite(major) || major < DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR) {
            throw new Error(`此脚本要求 PostgreSQL >= ${DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR}，当前: ${versionText}`);
        }
        return;
    }

    if (dbDialect === "sqlite") {
        const r = await db.unsafe<Array<{ version: string }>>("SELECT sqlite_version() AS version");
        if (!r.data || r.data.length === 0 || !r.data[0]?.version) {
            throw new Error("无法获取 SQLite 版本信息");
        }
        const version = r.data[0].version;
        const parts = String(version)
            .split(".")
            .map((v) => parseInt(v, 10) || 0);
        const maj = parts[0] ?? 0;
        const min = parts[1] ?? 0;
        const patch = parts[2] ?? 0;
        const vnum = maj * 10000 + min * 100 + patch;
        if (!Number.isFinite(vnum) || vnum < DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION_NUM) {
            throw new Error(`此脚本要求 SQLite >= ${DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION}，当前: ${version}`);
        }
        return;
    }
}

/**
 * 比较字段定义变化
 */
function compareFieldDefinition(dbDialect: DbDialect, existingColumn: Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">, fieldDef: FieldDefinition): FieldChange[] {
    const changes: FieldChange[] = [];

    const normalized = normalizeFieldDefinition(fieldDef);

    // SQLite 元信息能力较弱：
    // - 列注释：sqlite 无 information_schema 注释，PRAGMA table_info 也不提供 comment
    // - 字符串长度：sqlite 类型系统宽松，长度/类型信息不稳定（易产生误报）
    // 因此在 sqlite 下跳过 comment/length 的 diff，仅保留更可靠的对比项。
    if (dbDialect !== "sqlite" && isStringOrArrayType(normalized.type)) {
        const expectedMax = normalized.max;
        if (expectedMax !== null && existingColumn.max !== expectedMax) {
            changes.push({
                type: "length",
                current: existingColumn.max,
                expected: expectedMax
            });
        }
    }

    if (dbDialect !== "sqlite") {
        const currentComment = existingColumn.comment || "";
        if (currentComment !== normalized.name) {
            changes.push({
                type: "comment",
                current: currentComment,
                expected: normalized.name
            });
        }
    }

    const typeMapping = getTypeMapping(dbDialect);
    const mapped = typeMapping[normalized.type];
    if (typeof mapped !== "string") {
        throw new Error(`未知字段类型映射：dialect=${dbDialect} type=${String(normalized.type)}`);
    }
    const expectedType = mapped.toLowerCase();

    // 防御性：理论上 ColumnInfo.type/columnType 都应为 string，但线上偶发出现 number/null/Buffer 等导致崩溃。
    // 同时：columnType 可能包含长度/unsigned（如 varchar(255), bigint unsigned），这里归一化为“基础类型”再比较。
    let rawType: string = "";
    if (typeof existingColumn.type === "string" && existingColumn.type.trim() !== "") {
        rawType = existingColumn.type;
    } else if (typeof existingColumn.columnType === "string" && existingColumn.columnType.trim() !== "") {
        rawType = existingColumn.columnType;
    } else {
        rawType = String((existingColumn as any).type ?? "");
    }

    const currentType = rawType
        .toLowerCase()
        .replace(/\s*unsigned/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

    if (currentType !== expectedType) {
        changes.push({
            type: "datatype",
            current: currentType,
            expected: expectedType
        });
    }

    const expectedNullable = normalized.nullable;
    if (existingColumn.nullable !== expectedNullable) {
        changes.push({
            type: "nullable",
            current: existingColumn.nullable,
            expected: expectedNullable
        });
    }

    const expectedDefault = resolveDefaultValue(normalized.default, normalized.type);
    if (String(existingColumn.defaultValue) !== String(expectedDefault)) {
        changes.push({
            type: "default",
            current: existingColumn.defaultValue,
            expected: expectedDefault
        });
    }

    return changes;
}

/* ========================================================================== */
/* plan/apply & 建表/改表（核心同步逻辑） */
/* ========================================================================== */

/**
 * SQLite 重建表迁移（简化版）
 */
async function rebuildSqliteTable(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>): Promise<void> {
    // 说明：SQLite ALTER TABLE 能力有限（尤其是修改列类型/默认值/约束）。
    // 策略：创建临时表 -> 复制“交集列”数据 -> 删除旧表 -> 临时表改名。
    // - 只复制 targetCols 与 existingCols 的交集，避免因新增列/删除列导致 INSERT 失败。
    // - 不做额外的数据转换/回填：保持迁移路径尽量“纯结构同步”。
    if (runtime.dbDialect !== "sqlite") {
        throw new Error(`rebuildSqliteTable 仅支持 sqlite 方言，当前: ${String(runtime.dbDialect)}`);
    }

    const quotedSourceTable = quoteIdentifier("sqlite", tableName);
    const info = await runtime.db.unsafe<SqliteTableInfoRow[]>(`PRAGMA table_info(${quotedSourceTable})`);
    const existingCols = info.data.map((r) => r.name);
    const businessCols = Object.keys(fields).map((k) => snakeCase(k));
    const targetCols = ["id", "created_at", "updated_at", "deleted_at", "state", ...businessCols];
    const tmpTable = `${tableName}__tmp__${Date.now()}`;

    await createTable(runtime, tmpTable, fields);

    const commonCols = targetCols.filter((c) => existingCols.includes(c));
    if (commonCols.length > 0) {
        const colsSql = commonCols.map((c) => quoteIdentifier("sqlite", c)).join(", ");
        const quotedTmpTable = quoteIdentifier("sqlite", tmpTable);
        await runtime.db.unsafe(`INSERT INTO ${quotedTmpTable} (${colsSql}) SELECT ${colsSql} FROM ${quotedSourceTable}`);
    }

    await runtime.db.unsafe(`DROP TABLE ${quotedSourceTable}`);
    const quotedTmpTable = quoteIdentifier("sqlite", tmpTable);
    await runtime.db.unsafe(`ALTER TABLE ${quotedTmpTable} RENAME TO ${quotedSourceTable}`);
}

/**
 * 将表结构计划应用到数据库
 */
async function applyTablePlan(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>, plan: TablePlan): Promise<void> {
    if (!plan || !plan.changed) return;

    // A) 结构变更（ADD/MODIFY）：SQLite 走重建表；其余方言走 ALTER TABLE
    if (runtime.dbDialect === "sqlite") {
        if (plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) {
            await rebuildSqliteTable(runtime, tableName, fields);
        } else {
            for (const c of plan.addClauses) {
                const stmt = `ALTER TABLE ${quoteIdentifier(runtime.dbDialect, tableName)} ${c}`;
                await runtime.db.unsafe(stmt);
            }
        }
    } else {
        const clauses = [...plan.addClauses, ...plan.modifyClauses];
        if (clauses.length > 0) {
            const tableQuoted = quoteIdentifier(runtime.dbDialect, tableName);
            const stmt = runtime.dbDialect === "mysql" ? `ALTER TABLE ${tableQuoted} ALGORITHM=INSTANT, LOCK=NONE, ${clauses.join(", ")}` : `ALTER TABLE ${tableQuoted} ${clauses.join(", ")}`;
            if (runtime.dbDialect === "mysql") await executeDDLSafely(runtime.db, stmt);
            else await runtime.db.unsafe(stmt);
        }
    }

    // B) 默认值变更：SQLite 不支持在线修改默认值（需要重建表），其余方言按子句执行
    if (plan.defaultClauses.length > 0) {
        if (runtime.dbDialect === "sqlite") {
            Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
        } else {
            const tableQuoted = quoteIdentifier(runtime.dbDialect, tableName);
            const stmt = runtime.dbDialect === "mysql" ? `ALTER TABLE ${tableQuoted} ALGORITHM=INSTANT, LOCK=NONE, ${plan.defaultClauses.join(", ")}` : `ALTER TABLE ${tableQuoted} ${plan.defaultClauses.join(", ")}`;
            if (runtime.dbDialect === "mysql") await executeDDLSafely(runtime.db, stmt);
            else await runtime.db.unsafe(stmt);
        }
    }

    // C) 索引动作：不同方言的 DDL 策略由 buildIndexSQL 统一生成
    for (const act of plan.indexActions) {
        const stmt = buildIndexSQL(runtime.dbDialect, tableName, act.indexName, act.fieldName, act.action);
        try {
            await runtime.db.unsafe(stmt);
            if (act.action === "create") {
                Logger.debug(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
            } else {
                Logger.debug(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
            }
        } catch (error: any) {
            Logger.error({ err: error, table: tableName, index: act.indexName, field: act.fieldName, msg: `${act.action === "create" ? "创建" : "删除"}索引失败` });
            throw error;
        }
    }

    // D) PG 列注释：独立 SQL 执行（COMMENT ON COLUMN）
    if (runtime.dbDialect === "postgresql" && plan.commentActions && plan.commentActions.length > 0) {
        for (const stmt of plan.commentActions) {
            await runtime.db.unsafe(stmt);
        }
    }
}

/**
 * 创建表（包含系统字段和业务字段）
 */
async function createTable(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: ReadonlyArray<string> = SYSTEM_INDEX_FIELDS): Promise<void> {
    const colDefs = [...buildSystemColumnDefs(runtime.dbDialect), ...buildBusinessColumnDefs(runtime.dbDialect, fields)];

    const cols = colDefs.join(",\n            ");
    const tableQuoted = quoteIdentifier(runtime.dbDialect, tableName);
    const { ENGINE, CHARSET, COLLATE } = MYSQL_TABLE_CONFIG;
    const createSQL = runtime.dbDialect === "mysql" ? `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        ) ENGINE=${ENGINE} DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE}` : `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        )`;

    await runtime.db.unsafe(createSQL);

    if (runtime.dbDialect === "postgresql") {
        for (const f of SYSTEM_FIELDS) {
            const escaped = String(f.comment).replace(/'/g, "''");
            const colQuoted = quoteIdentifier(runtime.dbDialect, f.name);
            const stmt = `COMMENT ON COLUMN ${tableQuoted}.${colQuoted} IS '${escaped}'`;
            await runtime.db.unsafe(stmt);
        }

        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            const dbFieldName = snakeCase(fieldKey);
            const colQuoted = quoteIdentifier(runtime.dbDialect, dbFieldName);

            const fieldName = fieldDef.name && fieldDef.name !== "null" ? String(fieldDef.name) : "";
            const escaped = fieldName.replace(/'/g, "''");
            const valueSql = fieldName ? `'${escaped}'` : "NULL";
            const stmt = `COMMENT ON COLUMN ${tableQuoted}.${colQuoted} IS ${valueSql}`;
            await runtime.db.unsafe(stmt);
        }
    }

    const indexTasks: Array<Promise<unknown>> = [];

    let existingIndexes: Record<string, string[]> = {};
    if (runtime.dbDialect === "mysql") {
        existingIndexes = await getTableIndexesRuntime(runtime, tableName);
    }

    for (const sysField of systemIndexFields) {
        const indexName = `idx_${sysField}`;
        if (runtime.dbDialect === "mysql" && existingIndexes[indexName]) {
            continue;
        }
        const stmt = buildIndexSQL(runtime.dbDialect, tableName, indexName, sysField, "create");
        indexTasks.push(runtime.db.unsafe(stmt));
    }

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        if (fieldDef.index === true && fieldDef.unique !== true) {
            const indexName = `idx_${dbFieldName}`;
            if (runtime.dbDialect === "mysql" && existingIndexes[indexName]) {
                continue;
            }
            const stmt = buildIndexSQL(runtime.dbDialect, tableName, indexName, dbFieldName, "create");
            indexTasks.push(runtime.db.unsafe(stmt));
        }
    }

    if (indexTasks.length > 0) {
        await Promise.all(indexTasks);
    }
}

async function modifyTableRuntime(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>): Promise<TablePlan> {
    // 1) 读取现有元信息（列/索引）
    const existingColumns = await getTableColumnsRuntime(runtime, tableName);
    const existingIndexes = await getTableIndexesRuntime(runtime, tableName);

    // 2) 规划变更（先 plan，后统一 apply）
    let changed = false;

    const addClauses: string[] = [];
    const modifyClauses: string[] = [];
    const defaultClauses: string[] = [];
    const indexActions: Array<{ action: "create" | "drop"; indexName: string; fieldName: string }> = [];

    // 3) 对比业务字段：新增/变更（类型/长度/可空/默认值/注释）
    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        if (existingColumns[dbFieldName]) {
            const comparison = compareFieldDefinition(runtime.dbDialect, existingColumns[dbFieldName], fieldDef);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    const changeLabel = CHANGE_TYPE_LABELS[c.type as keyof typeof CHANGE_TYPE_LABELS] || "未知";
                    Logger.debug(`  ~ 修改 ${dbFieldName} ${changeLabel}: ${c.current} -> ${c.expected}`);
                }

                if (isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && typeof fieldDef.max === "number") {
                    if (existingColumns[dbFieldName].max! > fieldDef.max) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${dbFieldName} 长度收缩 ${existingColumns[dbFieldName].max} -> ${fieldDef.max} 已被跳过（需手动处理）`);
                    }
                }

                const hasTypeChange = comparison.some((c) => c.type === "datatype");
                const hasLengthChange = comparison.some((c) => c.type === "length");
                const onlyDefaultChanged = comparison.every((c) => c.type === "default");
                const defaultChanged = comparison.some((c) => c.type === "default");

                if (hasTypeChange) {
                    const typeChange = comparison.find((c) => c.type === "datatype");
                    const currentType = String(typeChange?.current || "").toLowerCase();
                    const typeMapping = getTypeMapping(runtime.dbDialect);
                    const expectedType = typeMapping[fieldDef.type]?.toLowerCase() || "";

                    if (!isCompatibleTypeChange(currentType, expectedType)) {
                        const errorMsg = [`禁止字段类型变更: ${tableName}.${dbFieldName}`, `当前类型: ${typeChange?.current}`, `目标类型: ${typeChange?.expected}`, "说明: 仅允许宽化型变更（如 INT->BIGINT, VARCHAR->TEXT），其他类型变更需要手动处理"].join("\n");
                        throw new Error(errorMsg);
                    }
                    Logger.debug(`[兼容类型变更] ${tableName}.${dbFieldName} ${currentType} -> ${expectedType}`);
                }

                if (defaultChanged) {
                    const actualDefault = resolveDefaultValue(fieldDef.default ?? null, fieldDef.type);

                    let v: string | null = null;
                    if (actualDefault !== "null") {
                        const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);
                        v = defaultSql.trim().replace(/^DEFAULT\s+/, "");
                    }

                    if (v !== null && v !== "") {
                        if (runtime.dbDialect === "postgresql") {
                            const colQuoted = quoteIdentifier(runtime.dbDialect, dbFieldName);
                            defaultClauses.push(`ALTER COLUMN ${colQuoted} SET DEFAULT ${v}`);
                        } else if (runtime.dbDialect === "mysql" && onlyDefaultChanged) {
                            if (fieldDef.type !== "text") {
                                const colQuoted = quoteIdentifier(runtime.dbDialect, dbFieldName);
                                defaultClauses.push(`ALTER COLUMN ${colQuoted} SET DEFAULT ${v}`);
                            }
                        }
                    }
                }

                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && typeof fieldDef.max === "number") {
                        const isShrink = existingColumns[dbFieldName].max! > fieldDef.max;
                        if (isShrink) skipModify = true;
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(runtime.dbDialect, fieldKey, fieldDef, false));
                }
                changed = true;
            }
        } else {
            addClauses.push(generateDDLClause(runtime.dbDialect, fieldKey, fieldDef, true));
            changed = true;
        }
    }

    // 4) 补齐系统字段（除 id 外）
    const systemFieldNames = SYSTEM_FIELDS.filter((f) => f.name !== "id").map((f) => f.name) as string[];
    for (const sysFieldName of systemFieldNames) {
        if (!existingColumns[sysFieldName]) {
            const colDef = getSystemColumnDef(runtime.dbDialect, sysFieldName);
            if (colDef) {
                Logger.debug(`  + 新增系统字段 ${sysFieldName}`);
                addClauses.push(`ADD COLUMN ${colDef}`);
                changed = true;
            }
        }
    }

    // 5) 索引动作：系统字段索引 + 业务字段单列索引
    for (const sysField of SYSTEM_INDEX_FIELDS) {
        const idxName = `idx_${sysField}`;
        const fieldWillExist = existingColumns[sysField] || systemFieldNames.includes(sysField);
        if (fieldWillExist && !existingIndexes[idxName]) {
            indexActions.push({ action: "create", indexName: idxName, fieldName: sysField });
            changed = true;
        }
    }

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        const indexName = `idx_${dbFieldName}`;
        if (fieldDef.index && !fieldDef.unique && !existingIndexes[indexName]) {
            indexActions.push({ action: "create", indexName: indexName, fieldName: dbFieldName });
            changed = true;
        } else if (!fieldDef.index && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: "drop", indexName: indexName, fieldName: dbFieldName });
            changed = true;
        }
    }

    // 6) PG 注释动作（MySQL 在列定义里带 COMMENT；SQLite 无列注释）
    const commentActions: string[] = [];
    if (runtime.dbDialect === "postgresql") {
        const tableQuoted = quoteIdentifier(runtime.dbDialect, tableName);
        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            const dbFieldName = snakeCase(fieldKey);
            const colQuoted = quoteIdentifier(runtime.dbDialect, dbFieldName);

            if (existingColumns[dbFieldName]) {
                const curr = existingColumns[dbFieldName].comment || "";
                const want = fieldDef.name && fieldDef.name !== "null" ? String(fieldDef.name) : "";
                if (want !== curr) {
                    const escapedWant = want.replace(/'/g, "''");
                    commentActions.push(`COMMENT ON COLUMN ${tableQuoted}.${colQuoted} IS ${want ? `'${escapedWant}'` : "NULL"}`);
                    changed = true;
                }
            }
        }
    }

    // 7) 汇总计划并应用
    changed = addClauses.length > 0 || modifyClauses.length > 0 || defaultClauses.length > 0 || indexActions.length > 0 || commentActions.length > 0;

    const plan: TablePlan = {
        changed: changed,
        addClauses: addClauses,
        modifyClauses: modifyClauses,
        defaultClauses: defaultClauses,
        indexActions: indexActions,
        commentActions: commentActions
    };

    if (plan.changed) {
        await applyTablePlan(runtime, tableName, fields, plan);
    }

    return plan;
}
