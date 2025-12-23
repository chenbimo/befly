/**
 * SyncTable 命令 - 同步数据库表结构（单文件版）
 *
 * 说明：
 * - 历史上该能力拆分在 packages/core/sync/syncTable/* 多个模块中
 * - 现在按项目要求，将所有实现合并到本文件（目录 packages/core/sync/syncTable/ 已删除）
 */

import type { BeflyContext } from "../types/befly.js";
import type { ColumnInfo, FieldChange, IndexInfo, TablePlan } from "../types/sync.js";
import type { FieldDefinition } from "../types/validate.js";

import { snakeCase } from "es-toolkit/string";

import { CacheKeys } from "../lib/cacheKeys.js";
import { Logger } from "../lib/logger.js";

type SqlExecutor = {
    unsafe(sqlStr: string, params?: any[]): Promise<any>;
};

/* ========================================================================== */
/* 版本/常量/运行时方言状态 */
/* ========================================================================== */

/**
 * 数据库版本要求
 */
export const DB_VERSION_REQUIREMENTS = {
    MYSQL_MIN_MAJOR: 8,
    POSTGRES_MIN_MAJOR: 17,
    SQLITE_MIN_VERSION: "3.50.0",
    SQLITE_MIN_VERSION_NUM: 35000 // 3 * 10000 + 50 * 100
} as const;

/**
 * 需要创建索引的系统字段
 */
export const SYSTEM_INDEX_FIELDS = ["created_at", "updated_at", "state"] as const;

/**
 * 字段变更类型的中文标签映射
 */
export const CHANGE_TYPE_LABELS = {
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
export const MYSQL_TABLE_CONFIG = {
    ENGINE: "InnoDB",
    CHARSET: "utf8mb4",
    COLLATE: "utf8mb4_0900_ai_ci"
} as const;

// 数据库类型（运行时设置，默认 mysql）
let _dbType: string = "mysql";

/**
 * 设置数据库类型（由 syncTable 调用）
 */
export function setDbType(dbType: string): void {
    _dbType = (dbType || "mysql").toLowerCase();
}

/**
 * 获取当前数据库类型
 */
export function getDbType(): string {
    return _dbType;
}

export function isMySQL(): boolean {
    return _dbType === "mysql";
}

export function isPG(): boolean {
    return _dbType === "postgresql" || _dbType === "postgres";
}

export function isSQLite(): boolean {
    return _dbType === "sqlite";
}

// 兼容旧代码的静态别名（通过 getter 实现动态获取）
export const DB_TYPE = {
    get current(): string {
        return _dbType;
    },
    get IS_MYSQL(): boolean {
        return isMySQL();
    },
    get IS_PG(): boolean {
        return isPG();
    },
    get IS_SQLITE(): boolean {
        return isSQLite();
    }
};

/**
 * 获取字段类型映射（根据当前数据库类型）
 */
export function getTypeMapping(): Record<string, string> {
    const isSqlite = isSQLite();
    const isPg = isPG();
    const isMysql = isMySQL();

    return {
        number: isSqlite ? "INTEGER" : isPg ? "BIGINT" : "BIGINT",
        string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
        text: isMysql ? "MEDIUMTEXT" : "TEXT",
        array_string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
        array_text: isMysql ? "MEDIUMTEXT" : "TEXT",
        array_number_string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
        array_number_text: isMysql ? "MEDIUMTEXT" : "TEXT"
    };
}

/* ========================================================================== */
/* 通用工具与 DDL 片段生成 */
/* ========================================================================== */

/**
 * 根据数据库类型引用标识符
 */
export function quoteIdentifier(identifier: string): string {
    if (isMySQL()) return `\`${identifier}\``;
    if (isPG()) return `"${identifier}"`;
    return identifier; // SQLite 无需引用
}

/**
 * 转义 SQL 注释中的双引号
 */
export function escapeComment(str: string): string {
    return String(str).replace(/"/g, '\\"');
}

/**
 * 记录字段变更信息（紧凑格式）
 */
export function logFieldChange(tableName: string, fieldName: string, changeType: string, oldValue: any, newValue: any, changeLabel: string): void {
    Logger.debug(`  ~ 修改 ${fieldName} ${changeLabel}: ${oldValue} -> ${newValue}`);
}

/**
 * 格式化字段列表为可读字符串
 */
export function formatFieldList(fields: string[]): string {
    return fields.map((f) => quoteIdentifier(f)).join(", ");
}

/**
 * 为字段定义应用默认值
 */
export function applyFieldDefaults(fieldDef: any): void {
    fieldDef.detail = fieldDef.detail ?? "";
    fieldDef.min = fieldDef.min ?? 0;
    fieldDef.max = fieldDef.max ?? (fieldDef.type === "number" ? Number.MAX_SAFE_INTEGER : 100);
    fieldDef.default = fieldDef.default ?? null;
    fieldDef.index = fieldDef.index ?? false;
    fieldDef.unique = fieldDef.unique ?? false;
    fieldDef.nullable = fieldDef.nullable ?? false;
    fieldDef.unsigned = fieldDef.unsigned ?? true;
    fieldDef.regexp = fieldDef.regexp ?? null;
}

/**
 * 判断是否为字符串或数组类型（需要长度参数）
 */
export function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string";
}

/**
 * 获取 SQL 数据类型
 */
export function getSqlType(fieldType: string, fieldMax: number | null, unsigned: boolean = false): string {
    const typeMapping = getTypeMapping();
    if (isStringOrArrayType(fieldType)) {
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }
    const baseType = typeMapping[fieldType] || "TEXT";
    if (isMySQL() && fieldType === "number" && unsigned) {
        return `${baseType} UNSIGNED`;
    }
    return baseType;
}

/**
 * 处理默认值：将 null 或 'null' 字符串转换为对应类型的默认值
 */
export function resolveDefaultValue(fieldDefault: any, fieldType: string): any {
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
export function generateDefaultSql(actualDefault: any, fieldType: string): string {
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
export function buildIndexSQL(tableName: string, indexName: string, fieldName: string, action: "create" | "drop"): string {
    const tableQuoted = quoteIdentifier(tableName);
    const indexQuoted = quoteIdentifier(indexName);
    const fieldQuoted = quoteIdentifier(fieldName);

    if (isMySQL()) {
        const parts: string[] = [];
        if (action === "create") {
            parts.push(`ADD INDEX ${indexQuoted} (${fieldQuoted})`);
        } else {
            parts.push(`DROP INDEX ${indexQuoted}`);
        }
        return `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ${parts.join(", ")}`;
    }

    if (isPG()) {
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
export function getSystemColumnDef(fieldName: string): string | null {
    const mysqlDefs: Record<string, string> = {
        id: '`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT "主键ID"',
        created_at: '`created_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "创建时间"',
        updated_at: '`updated_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "更新时间"',
        deleted_at: '`deleted_at` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT "删除时间"',
        state: '`state` BIGINT UNSIGNED NOT NULL DEFAULT 1 COMMENT "状态字段"'
    };
    const pgDefs: Record<string, string> = {
        id: '"id" INTEGER PRIMARY KEY',
        created_at: '"created_at" INTEGER NOT NULL DEFAULT 0',
        updated_at: '"updated_at" INTEGER NOT NULL DEFAULT 0',
        deleted_at: '"deleted_at" INTEGER NOT NULL DEFAULT 0',
        state: '"state" INTEGER NOT NULL DEFAULT 1'
    };

    const defs = isMySQL() ? mysqlDefs : pgDefs;
    return defs[fieldName] || null;
}

/**
 * 构建系统字段列定义
 */
export function buildSystemColumnDefs(): string[] {
    return [getSystemColumnDef("id")!, getSystemColumnDef("created_at")!, getSystemColumnDef("updated_at")!, getSystemColumnDef("deleted_at")!, getSystemColumnDef("state")!];
}

/**
 * 构建业务字段列定义
 */
export function buildBusinessColumnDefs(fields: Record<string, FieldDefinition>): string[] {
    const colDefs: string[] = [];

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        const sqlType = getSqlType(fieldDef.type, fieldDef.max, fieldDef.unsigned);

        const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);
        const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);

        const uniqueSql = fieldDef.unique ? " UNIQUE" : "";
        const nullableSql = fieldDef.nullable ? " NULL" : " NOT NULL";

        if (isMySQL()) {
            colDefs.push(`\`${dbFieldName}\` ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(fieldDef.name)}"`);
        } else {
            colDefs.push(`"${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`);
        }
    }

    return colDefs;
}

/**
 * 生成字段 DDL 子句（不含 ALTER TABLE 前缀）
 */
export function generateDDLClause(fieldKey: string, fieldDef: FieldDefinition, isAdd: boolean = false): string {
    const dbFieldName = snakeCase(fieldKey);

    const sqlType = getSqlType(fieldDef.type, fieldDef.max, fieldDef.unsigned);

    const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);
    const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);

    const uniqueSql = fieldDef.unique ? " UNIQUE" : "";
    const nullableSql = fieldDef.nullable ? " NULL" : " NOT NULL";

    if (isMySQL()) {
        return `${isAdd ? "ADD COLUMN" : "MODIFY COLUMN"} \`${dbFieldName}\` ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(fieldDef.name)}"`;
    }
    if (isPG()) {
        if (isAdd) return `ADD COLUMN IF NOT EXISTS "${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
        return `ALTER COLUMN "${dbFieldName}" TYPE ${sqlType}`;
    }
    if (isAdd) return `ADD COLUMN IF NOT EXISTS "${dbFieldName}" ${sqlType}${uniqueSql}${nullableSql}${defaultSql}`;
    return "";
}

/**
 * 安全执行 DDL 语句（MySQL 降级策略）
 */
export async function executeDDLSafely(db: SqlExecutor, stmt: string): Promise<boolean> {
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
export function isCompatibleTypeChange(currentType: string, newType: string): boolean {
    const c = String(currentType || "").toLowerCase();
    const n = String(newType || "").toLowerCase();

    if (c === n) return false;

    const extractBaseType = (t: string): string => {
        return t
            .replace(/\s*unsigned/gi, "")
            .replace(/\([^)]*\)/g, "")
            .trim();
    };

    const cBase = extractBaseType(c);
    const nBase = extractBaseType(n);

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

/**
 * 判断表是否存在（返回布尔值）
 */
export async function tableExists(db: SqlExecutor, tableName: string, dbName: string): Promise<boolean> {
    if (!db) throw new Error("SQL 执行器未初始化");

    try {
        if (isMySQL()) {
            const res = await db.unsafe("SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [dbName, tableName]);
            return (res[0]?.count || 0) > 0;
        }

        if (isPG()) {
            const res = await db.unsafe("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?", [tableName]);
            return (res[0]?.count || 0) > 0;
        }

        if (isSQLite()) {
            const res = await db.unsafe("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [tableName]);
            return res.length > 0;
        }

        return false;
    } catch (error: any) {
        throw new Error(`查询表是否存在失败 [${tableName}]: ${error.message}`);
    }
}

/**
 * 获取表的现有列信息（按方言）
 */
export async function getTableColumns(db: SqlExecutor, tableName: string, dbName: string): Promise<{ [key: string]: ColumnInfo }> {
    const columns: { [key: string]: ColumnInfo } = {};

    try {
        if (isMySQL()) {
            const result = await db.unsafe("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [dbName, tableName]);
            for (const row of result) {
                const defaultValue = row.COLUMN_DEFAULT;

                columns[row.COLUMN_NAME] = {
                    type: row.DATA_TYPE,
                    columnType: row.COLUMN_TYPE,
                    length: row.CHARACTER_MAXIMUM_LENGTH,
                    max: row.CHARACTER_MAXIMUM_LENGTH,
                    nullable: row.IS_NULLABLE === "YES",
                    defaultValue: defaultValue,
                    comment: row.COLUMN_COMMENT
                };
            }
        } else if (isPG()) {
            const result = await db.unsafe("SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position", [tableName]);
            const comments = await db.unsafe(
                "SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS column_comment FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname = ? AND a.attnum > 0",
                [tableName]
            );
            const commentMap: { [key: string]: string } = {};
            for (const r of comments) commentMap[r.column_name] = r.column_comment;

            for (const row of result) {
                columns[row.column_name] = {
                    type: row.data_type,
                    columnType: row.data_type,
                    length: row.character_maximum_length,
                    max: row.character_maximum_length,
                    nullable: String(row.is_nullable).toUpperCase() === "YES",
                    defaultValue: row.column_default,
                    comment: commentMap[row.column_name] ?? null
                };
            }
        } else if (isSQLite()) {
            const result = await db.unsafe(`PRAGMA table_info("${tableName}")`);
            for (const row of result) {
                let baseType = String(row.type || "").toUpperCase();
                let max = null;
                const m = /^(\w+)\s*\((\d+)\)/.exec(baseType);
                if (m) {
                    baseType = m[1];
                    max = Number(m[2]);
                }
                columns[row.name] = {
                    type: baseType.toLowerCase(),
                    columnType: baseType.toLowerCase(),
                    length: max,
                    max: max,
                    nullable: row.notnull === 0,
                    defaultValue: row.dflt_value,
                    comment: null
                };
            }
        }

        return columns;
    } catch (error: any) {
        throw new Error(`获取表列信息失败 [${tableName}]: ${error.message}`);
    }
}

/**
 * 获取表的现有索引信息（单列索引）
 */
export async function getTableIndexes(db: SqlExecutor, tableName: string, dbName: string): Promise<IndexInfo> {
    const indexes: IndexInfo = {};

    try {
        if (isMySQL()) {
            const result = await db.unsafe("SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME", [dbName, tableName]);
            for (const row of result) {
                if (!indexes[row.INDEX_NAME]) indexes[row.INDEX_NAME] = [];
                indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
            }
        } else if (isPG()) {
            const result = await db.unsafe("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ?", [tableName]);
            for (const row of result) {
                const m = /\(([^)]+)\)/.exec(row.indexdef);
                if (m) {
                    const col = m[1].replace(/"/g, "").trim();
                    indexes[row.indexname] = [col];
                }
            }
        } else if (isSQLite()) {
            const list = await db.unsafe(`PRAGMA index_list("${tableName}")`);
            for (const idx of list) {
                const info = await db.unsafe(`PRAGMA index_info("${idx.name}")`);
                const cols = info.map((r: any) => r.name);
                if (cols.length === 1) indexes[idx.name] = cols;
            }
        }

        return indexes;
    } catch (error: any) {
        throw new Error(`获取表索引信息失败 [${tableName}]: ${error.message}`);
    }
}

/**
 * 数据库版本检查（按方言）
 */
export async function ensureDbVersion(db: SqlExecutor): Promise<void> {
    if (!db) throw new Error("SQL 执行器未初始化");

    if (isMySQL()) {
        const r = await db.unsafe("SELECT VERSION() AS version");
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 MySQL 版本信息");
        }
        const version = r[0].version;
        const majorVersion = parseInt(String(version).split(".")[0], 10);
        if (!Number.isFinite(majorVersion) || majorVersion < DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR) {
            throw new Error(`此脚本仅支持 MySQL ${DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR}.0+，当前版本: ${version}`);
        }
        return;
    }

    if (isPG()) {
        const r = await db.unsafe("SELECT version() AS version");
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 PostgreSQL 版本信息");
        }
        const versionText = r[0].version;
        const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
        const major = m ? parseInt(m[1], 10) : NaN;
        if (!Number.isFinite(major) || major < DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR) {
            throw new Error(`此脚本要求 PostgreSQL >= ${DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR}，当前: ${versionText}`);
        }
        return;
    }

    if (isSQLite()) {
        const r = await db.unsafe("SELECT sqlite_version() AS version");
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 SQLite 版本信息");
        }
        const version = r[0].version;
        const [maj, min, patch] = String(version)
            .split(".")
            .map((v) => parseInt(v, 10) || 0);
        const vnum = maj * 10000 + min * 100 + patch;
        if (!Number.isFinite(vnum) || vnum < DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION_NUM) {
            throw new Error(`此脚本要求 SQLite >= ${DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION}，当前: ${version}`);
        }
        return;
    }
}

function buildAlterTableSQL(tableName: string, clauses: string[]): string {
    if (isMySQL()) {
        // MySQL 8.0+：ALGORITHM/LOCK 作为 alter options，两种位置都合法；此处放在表名后，保持拼接形态一致
        return `ALTER TABLE \`${tableName}\` ALGORITHM=INSTANT, LOCK=NONE, ${clauses.join(", ")}`;
    }
    return `ALTER TABLE "${tableName}" ${clauses.join(", ")}`;
}

/**
 * 比较字段定义变化
 */
export function compareFieldDefinition(existingColumn: ColumnInfo, fieldDef: FieldDefinition): FieldChange[] {
    const changes: FieldChange[] = [];

    if (!isSQLite() && isStringOrArrayType(fieldDef.type)) {
        if (existingColumn.max !== fieldDef.max) {
            changes.push({
                type: "length",
                current: existingColumn.max,
                expected: fieldDef.max
            });
        }
    }

    if (!isSQLite()) {
        const currentComment = existingColumn.comment || "";
        if (currentComment !== fieldDef.name) {
            changes.push({
                type: "comment",
                current: currentComment,
                expected: fieldDef.name
            });
        }
    }

    const typeMapping = getTypeMapping();
    const expectedType = typeMapping[fieldDef.type].toLowerCase();
    const currentType = existingColumn.type.toLowerCase();

    if (currentType !== expectedType) {
        changes.push({
            type: "datatype",
            current: currentType,
            expected: expectedType
        });
    }

    const expectedNullable = fieldDef.nullable;
    if (existingColumn.nullable !== expectedNullable) {
        changes.push({
            type: "nullable",
            current: existingColumn.nullable,
            expected: expectedNullable
        });
    }

    const expectedDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);
    if (String(existingColumn.defaultValue) !== String(expectedDefault)) {
        changes.push({
            type: "default",
            current: existingColumn.defaultValue,
            expected: expectedDefault
        });
    }

    return changes;
}

/**
 * SQLite 重建表迁移（简化版）
 */
export async function rebuildSqliteTable(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>): Promise<void> {
    const info = await db.unsafe(`PRAGMA table_info("${tableName}")`);
    const existingCols = info.map((r: any) => r.name);
    const businessCols = Object.keys(fields).map((k) => snakeCase(k));
    const targetCols = ["id", "created_at", "updated_at", "deleted_at", "state", ...businessCols];
    const tmpTable = `${tableName}__tmp__${Date.now()}`;

    await createTable(db, tmpTable, fields);

    const commonCols = targetCols.filter((c) => existingCols.includes(c));
    if (commonCols.length > 0) {
        const colsSql = commonCols.map((c) => `"${c}"`).join(", ");
        await db.unsafe(`INSERT INTO "${tmpTable}" (${colsSql}) SELECT ${colsSql} FROM "${tableName}"`);
    }

    await db.unsafe(`DROP TABLE "${tableName}"`);
    await db.unsafe(`ALTER TABLE "${tmpTable}" RENAME TO "${tableName}"`);
}

/**
 * 将表结构计划应用到数据库
 */
export async function applyTablePlan(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>, plan: TablePlan): Promise<void> {
    if (!plan || !plan.changed) return;

    if (isSQLite()) {
        if (plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) {
            await rebuildSqliteTable(db, tableName, fields);
        } else {
            for (const c of plan.addClauses) {
                const stmt = `ALTER TABLE "${tableName}" ${c}`;
                await db.unsafe(stmt);
            }
        }
    } else {
        const clauses = [...plan.addClauses, ...plan.modifyClauses];
        if (clauses.length > 0) {
            const stmt = buildAlterTableSQL(tableName, clauses);
            if (isMySQL()) await executeDDLSafely(db, stmt);
            else await db.unsafe(stmt);
        }
    }

    if (plan.defaultClauses.length > 0) {
        if (isSQLite()) {
            Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
        } else {
            const stmt = buildAlterTableSQL(tableName, plan.defaultClauses);
            if (isMySQL()) await executeDDLSafely(db, stmt);
            else await db.unsafe(stmt);
        }
    }

    for (const act of plan.indexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        try {
            await db.unsafe(stmt);
            if (act.action === "create") {
                Logger.debug(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
            } else {
                Logger.debug(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
            }
        } catch (error: any) {
            Logger.error({ err: error, table: tableName, index: act.indexName, field: act.fieldName }, `${act.action === "create" ? "创建" : "删除"}索引失败`);
            throw error;
        }
    }

    if (isPG() && plan.commentActions && plan.commentActions.length > 0) {
        for (const stmt of plan.commentActions) {
            await db.unsafe(stmt);
        }
    }
}

async function addPostgresComments(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>): Promise<void> {
    const systemComments = [
        ["id", "主键ID"],
        ["created_at", "创建时间"],
        ["updated_at", "更新时间"],
        ["deleted_at", "删除时间"],
        ["state", "状态字段"]
    ];

    for (const [name, comment] of systemComments) {
        const escaped = String(comment).replace(/'/g, "''");
        const stmt = `COMMENT ON COLUMN "${tableName}"."${name}" IS '${escaped}'`;
        await db.unsafe(stmt);
    }

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        const fieldName = fieldDef.name && fieldDef.name !== "null" ? String(fieldDef.name) : "";
        const escaped = fieldName.replace(/'/g, "''");
        const valueSql = fieldName ? `'${escaped}'` : "NULL";
        const stmt = `COMMENT ON COLUMN "${tableName}"."${dbFieldName}" IS ${valueSql}`;
        await db.unsafe(stmt);
    }
}

async function createTableIndexes(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: string[], dbName?: string): Promise<void> {
    const indexTasks: Promise<void>[] = [];

    let existingIndexes: Record<string, string[]> = {};
    if (isMySQL()) {
        existingIndexes = await getTableIndexes(db, tableName, dbName || "");
    }

    for (const sysField of systemIndexFields) {
        const indexName = `idx_${sysField}`;
        if (isMySQL() && existingIndexes[indexName]) {
            continue;
        }
        const stmt = buildIndexSQL(tableName, indexName, sysField, "create");
        indexTasks.push(db.unsafe(stmt));
    }

    for (const [fieldKey, fieldDef] of Object.entries(fields)) {
        const dbFieldName = snakeCase(fieldKey);

        if (fieldDef.index === true) {
            const indexName = `idx_${dbFieldName}`;
            if (isMySQL() && existingIndexes[indexName]) {
                continue;
            }
            const stmt = buildIndexSQL(tableName, indexName, dbFieldName, "create");
            indexTasks.push(db.unsafe(stmt));
        }
    }

    if (indexTasks.length > 0) {
        await Promise.all(indexTasks);
    }
}

/**
 * 创建表（包含系统字段和业务字段）
 */
export async function createTable(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: string[] = ["created_at", "updated_at", "state"], dbName?: string): Promise<void> {
    const colDefs = [...buildSystemColumnDefs(), ...buildBusinessColumnDefs(fields)];

    const cols = colDefs.join(",\n            ");
    const tableQuoted = quoteIdentifier(tableName);
    const { ENGINE, CHARSET, COLLATE } = MYSQL_TABLE_CONFIG;
    const createSQL = isMySQL() ? `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        ) ENGINE=${ENGINE} DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE}` : `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        )`;

    await db.unsafe(createSQL);

    if (isPG()) await addPostgresComments(db, tableName, fields);

    await createTableIndexes(db, tableName, fields, systemIndexFields, dbName);
}

/**
 * 同步表结构（对比和应用变更）
 */
export async function modifyTable(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>, dbName?: string): Promise<TablePlan> {
    const existingColumns = await getTableColumns(db, tableName, dbName || "");
    const existingIndexes = await getTableIndexes(db, tableName, dbName || "");
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
                    logFieldChange(tableName, dbFieldName, c.type, c.current, c.expected, changeLabel);
                }

                if (isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && fieldDef.max !== null) {
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
                    const actualDefault = resolveDefaultValue(fieldDef.default, fieldDef.type);

                    let v: string | null = null;
                    if (actualDefault !== "null") {
                        const defaultSql = generateDefaultSql(actualDefault, fieldDef.type);
                        v = defaultSql.trim().replace(/^DEFAULT\s+/, "");
                    }

                    if (v !== null && v !== "") {
                        if (isPG()) {
                            defaultClauses.push(`ALTER COLUMN "${dbFieldName}" SET DEFAULT ${v}`);
                        } else if (isMySQL() && onlyDefaultChanged) {
                            if (fieldDef.type !== "text") {
                                defaultClauses.push(`ALTER COLUMN \`${dbFieldName}\` SET DEFAULT ${v}`);
                            }
                        }
                    }
                }

                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && isStringOrArrayType(fieldDef.type) && existingColumns[dbFieldName].max && fieldDef.max !== null) {
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

    const systemFieldNames = ["created_at", "updated_at", "deleted_at", "state"];
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

    const commentActions: string[] = [];
    if (isPG()) {
        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            const dbFieldName = snakeCase(fieldKey);

            if (existingColumns[dbFieldName]) {
                const curr = existingColumns[dbFieldName].comment || "";
                const want = fieldDef.name && fieldDef.name !== "null" ? String(fieldDef.name) : "";
                if (want !== curr) {
                    const escapedWant = want.replace(/'/g, "''");
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${dbFieldName}" IS ${want ? `'${escapedWant}'` : "NULL"}`);
                    changed = true;
                }
            }
        }
    }

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
        await applyTablePlan(db, tableName, fields, plan);
    }

    return plan;
}

type SyncTableSource = "app" | "addon" | "core";

export type SyncTableInputItem = {
    source: SyncTableSource;
    type: "table";
    fileName: string;
    addonName?: string;
    tables: Record<string, any>;
};

// 记录处理过的表名（用于清理缓存）
const processedTables: string[] = [];

/**
 * syncTable - 数据库同步命令入口
 *
 * 流程：
 * 1. 复用 ctx.db 的连接并检查版本
 * 2. 消费传入的表定义数据（来自 scanSources 的 tables）
 * 3. 对比并应用表结构变更
 */
export async function syncTable(ctx: BeflyContext, tables: SyncTableInputItem[]): Promise<void> {
    try {
        // 清空处理记录
        processedTables.length = 0;

        if (!Array.isArray(tables)) {
            throw new Error("syncTable(items) 参数必须是数组");
        }

        if (!ctx) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx");
        }
        if (!ctx.db) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.db");
        }
        if (!ctx.redis) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.redis");
        }
        if (!ctx.config) {
            throw new Error("syncTable(ctx, tables) 缺少 ctx.config");
        }

        // 设置数据库类型（从 ctx.config 获取）
        const dbType = ctx.config.db?.type || "mysql";
        setDbType(dbType);

        // 检查数据库版本（复用 ctx.db 的现有连接/事务）
        await ensureDbVersion(ctx.db);

        // 处理传入的 tables 数据（来自 scanSources）
        for (const item of tables) {
            if (!item || item.type !== "table") {
                continue;
            }

            if (item.source !== "app" && item.source !== "addon" && item.source !== "core") {
                Logger.warn(`syncTable 跳过未知来源表定义: source=${String(item.source)} fileName=${String(item.fileName)}`);
                continue;
            }

            // 确定表名：
            // - addon 表：addon_{addonName}_{表名}
            // - 项目表/core 表：{表名}
            let tableName = snakeCase(item.fileName);
            if (item.source === "addon") {
                if (!item.addonName || String(item.addonName).trim() === "") {
                    throw new Error(`syncTable addon 表缺少 addonName: fileName=${String(item.fileName)}`);
                }
                tableName = `addon_${snakeCase(item.addonName)}_${tableName}`;
            }

            const tableDefinition = item.tables;
            if (!tableDefinition || typeof tableDefinition !== "object") {
                throw new Error(`syncTable 表定义无效: table=${tableName}`);
            }

            // 为字段属性设置默认值
            for (const fieldDef of Object.values(tableDefinition)) {
                applyFieldDefaults(fieldDef);
            }

            const dbName = ctx.config.db?.database || "";
            const existsTable = await tableExists(ctx.db, tableName, dbName);

            if (existsTable) {
                await modifyTable(ctx.db, tableName, tableDefinition as any, dbName);
            } else {
                await createTable(ctx.db, tableName, tableDefinition as any, ["created_at", "updated_at", "state"], dbName);
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
        Logger.error({ err: error }, "数据库同步失败");
        throw error;
    }
}
