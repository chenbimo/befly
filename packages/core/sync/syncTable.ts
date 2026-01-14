/**
 * syncTable 命令 - 同步数据库表结构（MySQL 8+ only / 单文件版）
 *
 * 说明：
 * - 历史上该能力拆分在 packages/core/sync/syncTable/* 多个模块中
 * - 现在按项目要求，将所有实现合并到本文件（目录 packages/core/sync/syncTable/ 已删除）
 * - core 仅支持 MySQL 8.0+
 */

import type { JsonValue } from "../types/common";
import type { DbResult, SqlInfo } from "../types/database";
import type { ColumnInfo, FieldChange, IndexInfo, TablePlan } from "../types/sync";
import type { FieldDefinition } from "../types/validate";
import type { ScanFileResult } from "../utils/scanFiles";

import { CacheKeys } from "../lib/cacheKeys";
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
            database?: string;
        };
    };
};

type TableExistsRow = { count: number };

type MySqlColumnInfoRow = {
    COLUMN_NAME: string;
    DATA_TYPE: string;
    COLUMN_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH: number | null;
    IS_NULLABLE: "YES" | "NO";
    COLUMN_DEFAULT: unknown;
    COLUMN_COMMENT: string | null;
};

type MySqlIndexRow = {
    INDEX_NAME: string;
    COLUMN_NAME: string;
};

type SyncRuntime = Readonly<{
    db: SqlExecutor;
    dbName: string;
}>;

type SyncRuntimeForIO = SyncRuntime;

function createRuntimeForIO(db: SqlExecutor, dbName: string): SyncRuntimeForIO {
    return {
        db: db,
        dbName: dbName
    };
}

function buildRuntimeIoError(operation: string, tableName: string, error: unknown): Error & { sqlInfo?: SqlInfo } {
    const errMsg = String((error as any)?.message || error);
    const outErr: any = new Error(`同步表：读取元信息失败，操作=${operation}，表=${tableName}，错误=${errMsg}`);
    if ((error as any)?.sqlInfo) outErr.sqlInfo = (error as any).sqlInfo;
    return outErr;
}

/* ========================================================================== */
/* 对外导出面
 *
 * 约束：本文件仅导出一个函数：syncTable。
 * - 生产代码：通过 await syncTable(ctx, items) 执行同步。
 * - 测试：通过 syncTable.TestKit 访问纯函数/常量（不再导出零散函数）。
 */
/* ========================================================================== */

type SyncTableFn = ((ctx: SyncTableContext, items: ScanFileResult[]) => Promise<void>) & {
    TestKit: typeof SYNC_TABLE_TEST_KIT;
};

/**
 * 数据库版本要求（MySQL only）
 */
const DB_VERSION_REQUIREMENTS = {
    MYSQL_MIN_MAJOR: 8
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

// MySQL 字符串约束常量统一来源：../utils/mysqlStringConstraints

type SystemFieldMeta = {
    name: "id" | "created_at" | "updated_at" | "deleted_at" | "state";
    comment: string;
    needsIndex: boolean;
    mysqlDdl: string;
};

const SYSTEM_FIELDS: ReadonlyArray<SystemFieldMeta> = [
    {
        name: "id",
        comment: "主键ID",
        needsIndex: false,
        mysqlDdl: "BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT"
    },
    {
        name: "created_at",
        comment: "创建时间",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0"
    },
    {
        name: "updated_at",
        comment: "更新时间",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0"
    },
    {
        name: "deleted_at",
        comment: "删除时间",
        needsIndex: false,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 0"
    },
    {
        name: "state",
        comment: "状态字段",
        needsIndex: true,
        mysqlDdl: "BIGINT UNSIGNED NOT NULL DEFAULT 1"
    }
];

const SYSTEM_INDEX_FIELDS: ReadonlyArray<string> = SYSTEM_FIELDS.filter((f) => f.needsIndex).map((f) => f.name);

const SYSTEM_FIELD_META_MAP: Record<string, SystemFieldMeta> = {};
for (const f of SYSTEM_FIELDS) {
    SYSTEM_FIELD_META_MAP[f.name] = f;
}

/**
 * 数据库同步命令入口（函数模式）
 */
export const syncTable = (async (ctx: SyncTableContext, items: ScanFileResult[]): Promise<void> => {
    try {
        const processedTables: string[] = [];

        if (!Array.isArray(items)) {
            throw new Error("同步表：请传入多个表定义组成的数组");
        }
        if (!ctx?.db) {
            throw new Error("同步表：ctx.db 未初始化");
        }
        if (!ctx.redis) {
            throw new Error("同步表：ctx.redis 未初始化");
        }
        if (!ctx.config) {
            throw new Error("同步表：ctx.config 未初始化");
        }

        // 约束：database 相关配置完整性由 checkConfig 统一保证（syncTable 不做重复校验）。
        const databaseName = String(ctx.config.db?.database || "");

        await ensureDbVersion(ctx.db);

        const runtime: SyncRuntime = {
            db: ctx.db,
            dbName: databaseName
        };

        for (const item of items) {
            if (!item || item.type !== "table") {
                continue;
            }

            const tableName = item.source === "addon" ? `addon_${snakeCase(item.addonName)}_${snakeCase(item.fileName)}` : snakeCase(item.fileName);
            const tableFields = item.content as Record<string, FieldDefinition>;

            // 约束：表结构合法性由 checkTable 统一保证。
            // syncTable 只做同步执行（尽量避免重复校验逻辑）。
            for (const fieldDef of Object.values(tableFields)) {
                normalizeFieldDefinitionInPlace(fieldDef);
            }

            const existsTable = await tableExistsRuntime(runtime, tableName);
            if (existsTable) {
                await modifyTableRuntime(runtime, tableName, tableFields);
            } else {
                await createTable(runtime, tableName, tableFields);
            }

            processedTables.push(tableName);
        }

        if (processedTables.length > 0) {
            const cacheKeys = processedTables.map((tableName) => CacheKeys.tableColumns(databaseName, tableName));
            await ctx.redis.delBatch(cacheKeys);
        }
    } catch (error: any) {
        Logger.error({ err: error, msg: "数据库同步失败" });
        throw error;
    }
}) as SyncTableFn;

/* ========================================================================== */
/* TestKit（仅供单测使用） */
/* ========================================================================== */

const SYNC_TABLE_TEST_KIT = {
    DB_VERSION_REQUIREMENTS: DB_VERSION_REQUIREMENTS,
    CHANGE_TYPE_LABELS: CHANGE_TYPE_LABELS,
    MYSQL_TABLE_CONFIG: MYSQL_TABLE_CONFIG,
    SYSTEM_INDEX_FIELDS: SYSTEM_INDEX_FIELDS,

    // 用 tuple-rest 包装，确保“多传参数”（历史遗留的额外参数）在 TS 侧直接报错。
    getTypeMapping: (..._args: []) => getTypeMapping(),
    quoteIdentifier: (...args: [string]) => quoteIdentifier(args[0]),
    escapeComment: (...args: [string]) => escapeComment(args[0]),
    normalizeFieldDefinitionInPlace: (...args: [FieldDefinition]) => normalizeFieldDefinitionInPlace(args[0]),
    isStringOrArrayType: (...args: [string]) => isStringOrArrayType(args[0]),
    getSqlType: (...args: [string, number | null, boolean?]) => getSqlType(args[0], args[1], args[2]),
    resolveDefaultValue: (...args: [unknown, string]) => resolveDefaultValue(args[0] as any, args[1]),
    generateDefaultSql: (...args: [unknown, string]) => generateDefaultSql(args[0] as any, args[1]),
    buildIndexSQL: (...args: [string, string, string, "create" | "drop"]) => buildIndexSQL(args[0], args[1], args[2], args[3]),
    buildSystemColumnDefs: (..._args: []) => buildSystemColumnDefs(),
    buildBusinessColumnDefs: (...args: [Record<string, FieldDefinition>]) => buildBusinessColumnDefs(args[0]),
    generateDDLClause: (...args: [string, FieldDefinition, boolean?]) => generateDDLClause(args[0], args[1], args[2]),
    isCompatibleTypeChange: (...args: [string | null | undefined, string | null | undefined]) => isCompatibleTypeChange(args[0], args[1]),
    compareFieldDefinition: (...args: [Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">, FieldDefinition]) => compareFieldDefinition(args[0], args[1]),

    tableExistsRuntime: (...args: [SyncRuntimeForIO, string]) => tableExistsRuntime(args[0], args[1]),
    getTableColumnsRuntime: (...args: [SyncRuntimeForIO, string]) => getTableColumnsRuntime(args[0], args[1]),
    getTableIndexesRuntime: (...args: [SyncRuntimeForIO, string]) => getTableIndexesRuntime(args[0], args[1]),

    createRuntime: (...args: [SqlExecutor, string]) => createRuntimeForIO(args[0], args[1])
};

syncTable.TestKit = SYNC_TABLE_TEST_KIT;
Object.defineProperty(syncTable, "TestKit", {
    value: SYNC_TABLE_TEST_KIT,
    writable: false,
    enumerable: true,
    configurable: false
});

/* ========================================================================== */
/* 通用工具与 DDL 片段生成（MySQL only） */
/* ========================================================================== */

function getTypeMapping(): Record<string, string> {
    return {
        number: "BIGINT",
        string: "VARCHAR",
        text: "MEDIUMTEXT",
        array_string: "VARCHAR",
        array_text: "MEDIUMTEXT",
        array_number_string: "VARCHAR",
        array_number_text: "MEDIUMTEXT"
    };
}

function quoteIdentifier(identifier: string): string {
    if (typeof identifier !== "string") {
        throw new Error(`quoteIdentifier 需要字符串类型标识符 (identifier: ${String(identifier)})`);
    }

    const trimmed = identifier.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        throw new Error(`无效的 SQL 标识符: ${trimmed}`);
    }

    return `\`${trimmed}\``;
}

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

function normalizeFieldDefinitionInPlace(fieldDef: FieldDefinition): void {
    const normalized = normalizeFieldDefinition(fieldDef);
    fieldDef.detail = normalized.detail;
    fieldDef.min = normalized.min;
    fieldDef.max = normalized.max;
    fieldDef.default = normalized.default;
    fieldDef.index = normalized.index;
    fieldDef.unique = normalized.unique;
    fieldDef.nullable = normalized.nullable;
    fieldDef.unsigned = normalized.unsigned;
    fieldDef.regexp = normalized.regexp;
}

function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string";
}

function getSqlType(fieldType: string, fieldMax: number | null, unsigned: boolean = false): string {
    const typeMapping = getTypeMapping();

    if (isStringOrArrayType(fieldType)) {
        // 约束由 checkTable 统一保证；这里仅做最小断言，避免生成明显无效的 SQL。
        if (typeof fieldMax !== "number") {
            throw new Error(`同步表：内部错误：${fieldType} 类型缺失 max（应由 checkTable 阻断）`);
        }
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }

    const baseType = typeMapping[fieldType] || "TEXT";
    if (fieldType === "number" && unsigned) {
        return `${baseType} UNSIGNED`;
    }
    return baseType;
}

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

function buildIndexSQL(tableName: string, indexName: string, fieldName: string, action: "create" | "drop"): string {
    const tableQuoted = quoteIdentifier(tableName);
    const indexQuoted = quoteIdentifier(indexName);
    const fieldQuoted = quoteIdentifier(fieldName);

    const parts: string[] = [];
    if (action === "create") {
        parts.push(`ADD INDEX ${indexQuoted} (${fieldQuoted})`);
    } else {
        parts.push(`DROP INDEX ${indexQuoted}`);
    }

    return `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ${parts.join(", ")}`;
}

function getSystemColumnDef(fieldName: string): string | null {
    const meta = SYSTEM_FIELD_META_MAP[fieldName];
    if (!meta) return null;

    const colQuoted = quoteIdentifier(meta.name);
    return `${colQuoted} ${meta.mysqlDdl} COMMENT "${escapeComment(meta.comment)}"`;
}

function buildSystemColumnDefs(): string[] {
    const defs: string[] = [];
    for (const f of SYSTEM_FIELDS) {
        const d = getSystemColumnDef(f.name);
        if (d) defs.push(d);
    }
    return defs;
}

function buildBusinessColumnDefs(fields: Record<string, FieldDefinition>): string[] {
    const colDefs: string[] = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const normalized = normalizeFieldDefinition(fieldDef);
        const dbFieldName = snakeCase(fieldKey);
        const colQuoted = quoteIdentifier(dbFieldName);

        const sqlType = getSqlType(normalized.type, normalized.max, normalized.unsigned);
        const actualDefault = resolveDefaultValue(normalized.default, normalized.type);
        const defaultSql = generateDefaultSql(actualDefault, normalized.type);
        const uniqueSql = normalized.unique ? " UNIQUE" : "";
        const nullableSql = normalized.nullable ? " NULL" : " NOT NULL";

        colDefs.push(`${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(normalized.name)}"`);
    }

    return colDefs;
}

function generateDDLClause(fieldKey: string, fieldDef: FieldDefinition, isAdd: boolean = false): string {
    const dbFieldName = snakeCase(fieldKey);
    const colQuoted = quoteIdentifier(dbFieldName);

    const normalized = normalizeFieldDefinition(fieldDef);
    const sqlType = getSqlType(normalized.type, normalized.max, normalized.unsigned);
    const actualDefault = resolveDefaultValue(normalized.default, normalized.type);
    const defaultSql = generateDefaultSql(actualDefault, normalized.type);
    const uniqueSql = normalized.unique ? " UNIQUE" : "";
    const nullableSql = normalized.nullable ? " NULL" : " NOT NULL";

    return `${isAdd ? "ADD COLUMN" : "MODIFY COLUMN"} ${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(normalized.name)}"`;
}

async function executeDDLSafely(db: SqlExecutor, stmt: string): Promise<boolean> {
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
        }

        throw error;
    }
}

function isCompatibleTypeChange(currentType: string | null | undefined, newType: string | null | undefined): boolean {
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

    return false;
}

function compareFieldDefinition(existingColumn: Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">, fieldDef: FieldDefinition): FieldChange[] {
    const changes: FieldChange[] = [];

    const normalized = normalizeFieldDefinition(fieldDef);

    if (isStringOrArrayType(normalized.type)) {
        const expectedMax = normalized.max;
        if (expectedMax !== null && existingColumn.max !== expectedMax) {
            changes.push({
                type: "length",
                current: existingColumn.max,
                expected: expectedMax
            });
        }
    }

    const currentComment = existingColumn.comment === null || existingColumn.comment === undefined ? "" : String(existingColumn.comment);
    if (currentComment !== normalized.name) {
        changes.push({
            type: "comment",
            current: currentComment,
            expected: normalized.name
        });
    }

    const typeMapping = getTypeMapping();
    const mapped = typeMapping[normalized.type];
    if (typeof mapped !== "string") {
        throw new Error(`同步表：未知字段类型映射（类型=${String(normalized.type)}）`);
    }
    const expectedType = mapped.toLowerCase();

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
/* runtime I/O（只读：表/列/索引/版本） */
/* ========================================================================== */

async function tableExistsRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<boolean> {
    try {
        const res = await runtime.db.unsafe<TableExistsRow[]>("SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [runtime.dbName, tableName]);
        return (res.data?.[0]?.count || 0) > 0;
    } catch (error: any) {
        throw buildRuntimeIoError("检查表是否存在", tableName, error);
    }
}

async function getTableColumnsRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<{ [key: string]: ColumnInfo }> {
    const columns: { [key: string]: ColumnInfo } = {};

    try {
        const result = await runtime.db.unsafe<MySqlColumnInfoRow[]>("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [
            runtime.dbName,
            tableName
        ]);

        for (const row of result.data) {
            const defaultValue = normalizeColumnDefaultValue(row.COLUMN_DEFAULT);

            columns[row.COLUMN_NAME] = {
                type: String(row.DATA_TYPE ?? ""),
                columnType: String(row.COLUMN_TYPE ?? ""),
                length: row.CHARACTER_MAXIMUM_LENGTH,
                max: row.CHARACTER_MAXIMUM_LENGTH,
                nullable: row.IS_NULLABLE === "YES",
                defaultValue: defaultValue,
                comment: row.COLUMN_COMMENT === null ? null : String(row.COLUMN_COMMENT)
            };
        }

        return columns;
    } catch (error: any) {
        throw buildRuntimeIoError("读取列信息", tableName, error);
    }
}

async function getTableIndexesRuntime(runtime: SyncRuntimeForIO, tableName: string): Promise<IndexInfo> {
    const indexes: IndexInfo = {};

    try {
        const result = await runtime.db.unsafe<MySqlIndexRow[]>("SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME", [runtime.dbName, tableName]);

        for (const row of result.data) {
            const indexName = row.INDEX_NAME;
            const current = indexes[indexName];
            if (Array.isArray(current)) {
                current.push(row.COLUMN_NAME);
            } else {
                indexes[indexName] = [row.COLUMN_NAME];
            }
        }

        return indexes;
    } catch (error: any) {
        throw buildRuntimeIoError("读取索引信息", tableName, error);
    }
}

async function ensureDbVersion(db: SqlExecutor): Promise<void> {
    const r = await db.unsafe<Array<{ version: string }>>("SELECT VERSION() AS version");
    if (!r.data || r.data.length === 0 || !r.data[0]?.version) {
        throw new Error("同步表：无法获取 MySQL 版本信息");
    }
    const version = r.data[0].version;
    const majorPart = String(version).split(".")[0] || "0";
    const majorVersion = parseInt(majorPart, 10);
    if (!Number.isFinite(majorVersion) || majorVersion < DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR) {
        throw new Error(`同步表：仅支持 MySQL ${DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR}.0+（当前版本：${version}）`);
    }
}

/* ========================================================================== */
/* plan/apply & 建表/改表（核心同步逻辑） */
/* ========================================================================== */

async function applyTablePlan(runtime: SyncRuntime, tableName: string, plan: TablePlan): Promise<void> {
    if (!plan || !plan.changed) return;

    // 先 drop 再 alter：避免“增大 VARCHAR 长度”时被现有索引 key length 限制卡住
    const dropIndexActions = plan.indexActions.filter((a) => a.action === "drop");
    const createIndexActions = plan.indexActions.filter((a) => a.action === "create");

    for (const act of dropIndexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        try {
            await runtime.db.unsafe(stmt);
            Logger.debug(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
        } catch (error: any) {
            Logger.error({ err: error, table: tableName, index: act.indexName, field: act.fieldName, msg: "删除索引失败" });
            throw error;
        }
    }

    const clauses = [...plan.addClauses, ...plan.modifyClauses];
    if (clauses.length > 0) {
        const tableQuoted = quoteIdentifier(tableName);
        const stmt = `ALTER TABLE ${tableQuoted} ALGORITHM=INSTANT, LOCK=NONE, ${clauses.join(", ")}`;
        await executeDDLSafely(runtime.db, stmt);
    }

    if (plan.defaultClauses.length > 0) {
        const tableQuoted = quoteIdentifier(tableName);
        const stmt = `ALTER TABLE ${tableQuoted} ALGORITHM=INSTANT, LOCK=NONE, ${plan.defaultClauses.join(", ")}`;
        await executeDDLSafely(runtime.db, stmt);
    }

    for (const act of createIndexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        try {
            await runtime.db.unsafe(stmt);
            Logger.debug(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
        } catch (error: any) {
            Logger.error({ err: error, table: tableName, index: act.indexName, field: act.fieldName, msg: "创建索引失败" });
            throw error;
        }
    }
}

async function createTable(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: ReadonlyArray<string> = SYSTEM_INDEX_FIELDS): Promise<void> {
    const colDefs = [...buildSystemColumnDefs(), ...buildBusinessColumnDefs(fields)];

    const cols = colDefs.join(",\n            ");
    const tableQuoted = quoteIdentifier(tableName);
    const { ENGINE, CHARSET, COLLATE } = MYSQL_TABLE_CONFIG;
    const createSQL = `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        ) ENGINE=${ENGINE} DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE}`;

    await runtime.db.unsafe(createSQL);

    const indexTasks: Array<Promise<unknown>> = [];
    const existingIndexes: Record<string, string[]> = {};

    for (const sysField of systemIndexFields) {
        const indexName = `idx_${sysField}`;
        if (existingIndexes[indexName]) {
            continue;
        }
        const stmt = buildIndexSQL(tableName, indexName, sysField, "create");
        indexTasks.push(runtime.db.unsafe(stmt));
    }

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        if (fieldDef.index === true && fieldDef.unique !== true) {
            const indexName = `idx_${dbFieldName}`;
            if (existingIndexes[indexName]) {
                continue;
            }
            const stmt = buildIndexSQL(tableName, indexName, dbFieldName, "create");
            indexTasks.push(runtime.db.unsafe(stmt));
        }
    }

    if (indexTasks.length > 0) {
        await Promise.all(indexTasks);
    }
}

async function modifyTableRuntime(runtime: SyncRuntime, tableName: string, fields: Record<string, FieldDefinition>): Promise<TablePlan> {
    const existingColumns = await getTableColumnsRuntime(runtime, tableName);
    const existingIndexes = await getTableIndexesRuntime(runtime, tableName);

    let changed = false;

    const addClauses: string[] = [];
    const modifyClauses: string[] = [];
    const defaultClauses: string[] = [];
    const indexActions: Array<{ action: "create" | "drop"; indexName: string; fieldName: string }> = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        if (existingColumns[dbFieldName]) {
            const comparison = compareFieldDefinition(existingColumns[dbFieldName], fieldDef);
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
                    const typeMapping = getTypeMapping();
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

                    if (v !== null && v !== "" && onlyDefaultChanged) {
                        if (fieldDef.type !== "text") {
                            const colQuoted = quoteIdentifier(dbFieldName);
                            defaultClauses.push(`ALTER COLUMN ${colQuoted} SET DEFAULT ${v}`);
                        }
                    }
                }

                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && typeof fieldDef.max === "number") {
                        const isShrink = existingColumns[dbFieldName].max! > fieldDef.max;
                        if (isShrink) skipModify = true;
                    }

                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldDef, false));
                }
                changed = true;
            }
        } else {
            addClauses.push(generateDDLClause(fieldKey, fieldDef, true));
            changed = true;
        }
    }

    const systemFieldNames = SYSTEM_FIELDS.filter((f) => f.name !== "id").map((f) => f.name) as string[];
    for (const sysFieldName of systemFieldNames) {
        if (!existingColumns[sysFieldName]) {
            const colDef = getSystemColumnDef(sysFieldName);
            if (colDef) {
                Logger.debug(`  + 新增系统字段 ${sysFieldName}`);
                addClauses.push(`ADD COLUMN ${colDef}`);
                changed = true;
            }
        }
    }

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

    changed = addClauses.length > 0 || modifyClauses.length > 0 || defaultClauses.length > 0 || indexActions.length > 0;

    const plan: TablePlan = {
        changed: changed,
        addClauses: addClauses,
        modifyClauses: modifyClauses,
        defaultClauses: defaultClauses,
        indexActions: indexActions
    };

    if (plan.changed) {
        await applyTablePlan(runtime, tableName, plan);
    }

    return plan;
}
