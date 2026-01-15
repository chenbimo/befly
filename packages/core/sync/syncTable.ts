/**
 * syncTable 命令 - 同步数据库表结构（MySQL 8+ only / 单文件版）
 *
 * 说明：
 * - 历史上该能力拆分在 packages/core/sync/syncTable/* 多个模块中
 * - 现在按项目要求，将所有实现合并到本文件（目录 packages/core/sync/syncTable/ 已删除）
 * - core 仅支持 MySQL 8.0+
 */

import type { DbResult, SqlInfo } from "../types/database";
import type { ColumnInfo, FieldChange, IndexInfo, TablePlan } from "../types/sync";
import type { FieldDefinition } from "../types/validate";
import type { ScanFileResult } from "../utils/scanFiles";

import { Logger } from "../lib/logger";
import { normalizeFieldDefinition } from "../utils/normalizeFieldDefinition";
import { escapeComment, normalizeColumnDefaultValue } from "../utils/sqlUtil";
import { snakeCase } from "../utils/util";

type SqlExecutor = {
    unsafe<T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

type SyncTableContext = {
    db: SqlExecutor;
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

type SystemFieldMeta = {
    name: "id" | "created_at" | "updated_at" | "deleted_at" | "state";
    comment: string;
    needsIndex: boolean;
    mysqlDdl: string;
};

/**
 * 数据库同步命令入口（class 模式）
 */
export class SyncTable {
    /**
     * 数据库版本要求（MySQL only）
     */
    public static DB_VERSION_REQUIREMENTS = {
        MYSQL_MIN_MAJOR: 8
    } as const;

    /**
     * MySQL 表配置
     */
    public static MYSQL_TABLE_CONFIG = {
        ENGINE: "InnoDB",
        CHARSET: "utf8mb4",
        COLLATE: "utf8mb4_0900_ai_ci"
    } as const;

    public static SYSTEM_FIELDS: ReadonlyArray<SystemFieldMeta> = [
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

    public static SYSTEM_INDEX_FIELDS: ReadonlyArray<string> = ["created_at", "updated_at", "state"];

    private static TEXT_FAMILY = new Set(["tinytext", "text", "mediumtext", "longtext"]);
    private static INT_TYPES = new Set(["tinyint", "smallint", "mediumint", "int", "integer", "bigint"]);

    private db: SqlExecutor;
    private dbName: string;

    public constructor(ctx: SyncTableContext) {
        if (!ctx?.db) {
            throw new Error("同步表：ctx.db 未初始化");
        }
        if (!ctx.config) {
            throw new Error("同步表：ctx.config 未初始化");
        }

        // 约束：database 相关配置完整性由 checkConfig 统一保证（syncTable 不做重复校验）。
        this.dbName = String(ctx.config.db?.database || "");
        this.db = ctx.db;
    }

    public async run(items: ScanFileResult[]): Promise<void> {
        try {
            if (!Array.isArray(items)) {
                throw new Error("同步表：请传入多个表定义组成的数组");
            }

            await SyncTable.ensureDbVersion(this.db);

            for (const item of items) {
                if (!item || item.type !== "table") {
                    continue;
                }

                const tableName = item.source === "addon" ? `addon_${snakeCase(item.addonName)}_${snakeCase(item.fileName)}` : snakeCase(item.fileName);
                const tableFields = item.content as Record<string, FieldDefinition>;

                // 约束：表结构合法性由 checkTable 统一保证。
                // SyncTable 只做同步执行（尽量避免重复校验逻辑）。
                for (const fieldDef of Object.values(tableFields)) {
                    SyncTable.normalizeFieldDefinitionInPlace(fieldDef);
                }

                const existsTable = await SyncTable.tableExists(this.db, this.dbName, tableName);
                try {
                    if (existsTable) {
                        await SyncTable.modifyTable(this.db, this.dbName, tableName, tableFields);
                    } else {
                        await SyncTable.createTable(this.db, tableName, tableFields);
                    }
                } catch (error: any) {
                    const errMsg = String(error?.message || error);
                    const sqlInfo = (error as any)?.sqlInfo as SqlInfo | undefined;

                    // 失败时输出更“可定位”的上下文信息：
                    // - 具体表名/来源/操作（create/modify）
                    // - error.message（包含 executeDDLSafely 的原始 SQL/降级链路/明细）
                    // - sqlInfo（若底层 driver 提供）
                    // 注意：这里仍是“一次 Logger.error 调用”，不会影响“每表仅一条变更汇总日志”的约束。
                    Logger.error({
                        msg: "数据库同步失败（表级）",
                        dbName: this.dbName,
                        table: tableName,
                        operation: existsTable ? "modifyTable" : "createTable",
                        source: item.source,
                        sourceName: item.sourceName,
                        addonName: item.addonName,
                        fileName: item.fileName,
                        filePath: item.filePath,
                        errorMessage: errMsg,
                        sqlInfo: sqlInfo ? { sql: sqlInfo.sql, params: sqlInfo.params, duration: sqlInfo.duration } : null,
                        err: error
                    });

                    (error as any).__syncTableLogged = true;
                    throw error;
                }
            }
        } catch (error: any) {
            // 若已在表级 catch 打印过更详细上下文，则这里避免重复打印。
            if ((error as any)?.__syncTableLogged === true) {
                throw error;
            }

            const errMsg = String(error?.message || error);
            const sqlInfo = (error as any)?.sqlInfo as SqlInfo | undefined;

            Logger.error({
                msg: "数据库同步失败",
                dbName: this.dbName,
                errorMessage: errMsg,
                sqlInfo: sqlInfo ? { sql: sqlInfo.sql, params: sqlInfo.params, duration: sqlInfo.duration } : null,
                err: error
            });
            throw error;
        }
    }

    /* ====================================================================== */
    /* 内部工具（所有函数都挂在一个 class 上） */
    /* ====================================================================== */

    /* ---------------------------------------------------------------------- */
    /* 错误封装（runtime IO 失败时补充上下文信息） */
    /* ---------------------------------------------------------------------- */

    public static buildRuntimeIoError(operation: string, tableName: string, error: unknown): Error & { sqlInfo?: SqlInfo } {
        const errMsg = String((error as any)?.message || error);
        const outErr: any = new Error(`同步表：读取元信息失败，操作=${operation}，表=${tableName}，错误=${errMsg}`);
        if ((error as any)?.sqlInfo) outErr.sqlInfo = (error as any).sqlInfo;
        return outErr;
    }

    /* ---------------------------------------------------------------------- */
    /* 类型映射（field type -> mysql type） */
    /* ---------------------------------------------------------------------- */

    public static getTypeMapping(): Record<string, string> {
        return {
            number: "BIGINT",
            string: "VARCHAR",
            datetime: "DATETIME",
            text: "MEDIUMTEXT",
            array_string: "VARCHAR",
            array_text: "MEDIUMTEXT",
            array_number_string: "VARCHAR",
            array_number_text: "MEDIUMTEXT"
        };
    }

    /* ---------------------------------------------------------------------- */
    /* 默认值 & 字段定义规范化（与 checkTable 的“合法性 gate”配合） */
    /* ---------------------------------------------------------------------- */

    public static normalizeFieldDefinitionInPlace(fieldDef: FieldDefinition): void {
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

    public static isStringOrArrayType(fieldType: string): boolean {
        return fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string";
    }

    /**
     * MySQL 标识符安全包裹：仅允许 [a-zA-Z_][a-zA-Z0-9_]*，并用反引号包裹。
     *
     * 说明：
     * - 这是 syncTable 内部用于拼接 DDL 的安全阀
     * - 若未来需要支持更复杂的标识符（如关键字/点号/反引号转义），应在此处统一扩展并补测试
     */
    public static quoteIdentifier(identifier: string): string {
        if (typeof identifier !== "string") {
            throw new Error(`quoteIdentifier 需要字符串类型标识符 (identifier: ${String(identifier)})`);
        }

        const trimmed = identifier.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            throw new Error(`无效的 SQL 标识符: ${trimmed}`);
        }

        return `\`${trimmed}\``;
    }

    public static getSqlType(fieldType: string, fieldMax: number | null, unsigned: boolean = false): string {
        const typeMapping = SyncTable.getTypeMapping();

        if (SyncTable.isStringOrArrayType(fieldType)) {
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

    public static resolveDefaultValue(fieldDefault: any, fieldType: string): any {
        if (fieldDefault !== null && fieldDefault !== "null") {
            return fieldDefault;
        }

        switch (fieldType) {
            case "number":
                return 0;
            case "string":
                return "";
            case "datetime":
                // datetime 默认不生成 DEFAULT；用 "null" 作为 sentinel（与 TEXT 类似）
                return "null";
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

    public static generateDefaultSql(actualDefault: any, fieldType: string): string {
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

        if (fieldType === "datetime") {
            // datetime：默认值仅支持字符串（到秒）或 CURRENT_TIMESTAMP 表达式。
            // 注意：checkTable 默认要求 default 为 null；这里仍做 DDL 生成兜底，便于测试/内部调用。
            if (typeof actualDefault === "string") {
                const trimmed = actualDefault.trim();
                if (/^current_timestamp(\(\s*\d+\s*\)|\(\s*\))?$/i.test(trimmed)) {
                    const normalized = trimmed.toUpperCase().replace(/\(\s*\)/g, "");
                    return ` DEFAULT ${normalized}`;
                }
                const escaped = trimmed.replace(/'/g, "''");
                return ` DEFAULT '${escaped}'`;
            }
            return "";
        }

        return "";
    }

    /* ---------------------------------------------------------------------- */
    /* DDL 片段生成（列/索引/ALTER clause） */
    /* ---------------------------------------------------------------------- */

    public static buildIndexClause(indexName: string, fieldName: string, action: "create" | "drop"): string {
        const indexQuoted = SyncTable.quoteIdentifier(indexName);

        if (action === "create") {
            const fieldQuoted = SyncTable.quoteIdentifier(fieldName);
            return `ADD INDEX ${indexQuoted} (${fieldQuoted})`;
        }

        return `DROP INDEX ${indexQuoted}`;
    }

    public static getSystemColumnDef(fieldName: string): string | null {
        let meta: SystemFieldMeta | null = null;
        for (const f of SyncTable.SYSTEM_FIELDS) {
            if (f.name === fieldName) {
                meta = f;
                break;
            }
        }
        if (!meta) return null;

        const colQuoted = SyncTable.quoteIdentifier(meta.name);
        return `${colQuoted} ${meta.mysqlDdl} COMMENT "${escapeComment(meta.comment)}"`;
    }

    public static buildSystemColumnDefs(): string[] {
        const defs: string[] = [];
        for (const f of SyncTable.SYSTEM_FIELDS) {
            const d = SyncTable.getSystemColumnDef(f.name);
            if (d) defs.push(d);
        }
        return defs;
    }

    private static getSystemFieldNames(): string[] {
        return SyncTable.SYSTEM_FIELDS.filter((f) => f.name !== "id").map((f) => f.name) as string[];
    }

    private static async runIndexBatch(db: SqlExecutor, tableName: string, clauses: string[], errorMsg: string): Promise<void> {
        if (clauses.length === 0) return;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const stmt = `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ${clauses.join(", ")}`;
        try {
            await SyncTable.executeDDLSafely(db, stmt);
        } catch (error: any) {
            Logger.error({ err: error, table: tableName, msg: errorMsg });
            throw error;
        }
    }

    public static buildBusinessColumnDefs(fields: Record<string, FieldDefinition>): string[] {
        const colDefs: string[] = [];

        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            colDefs.push(SyncTable.buildColumnSql(fieldKey, fieldDef));
        }

        return colDefs;
    }

    private static buildColumnSql(fieldKey: string, fieldDef: FieldDefinition): string {
        const normalized = normalizeFieldDefinition(fieldDef);
        const dbFieldName = snakeCase(fieldKey);
        const colQuoted = SyncTable.quoteIdentifier(dbFieldName);

        const sqlType = SyncTable.getSqlType(normalized.type, normalized.max, normalized.unsigned);
        const actualDefault = SyncTable.resolveDefaultValue(normalized.default, normalized.type);
        const defaultSql = SyncTable.generateDefaultSql(actualDefault, normalized.type);
        const uniqueSql = normalized.unique ? " UNIQUE" : "";
        const nullableSql = normalized.nullable ? " NULL" : " NOT NULL";

        return `${colQuoted} ${sqlType}${uniqueSql}${nullableSql}${defaultSql} COMMENT "${escapeComment(normalized.name)}"`;
    }

    public static generateDDLClause(fieldKey: string, fieldDef: FieldDefinition, isAdd: boolean = false): string {
        return `${isAdd ? "ADD COLUMN" : "MODIFY COLUMN"} ${SyncTable.buildColumnSql(fieldKey, fieldDef)}`;
    }

    private static buildTablePlan(options: { tableName: string; fields: Record<string, FieldDefinition>; existingColumns: { [key: string]: ColumnInfo }; existingIndexes: IndexInfo }): {
        plan: TablePlan;
        summary: { addedBusiness: number; addedSystem: number; modified: number; indexChanges: number };
    } {
        const systemFieldNames = SyncTable.getSystemFieldNames();
        const alterClauses: string[] = [];

        let addedBusiness = 0;
        let addedSystem = 0;
        let modified = 0;

        for (const [fieldKey, fieldDef] of Object.entries(options.fields)) {
            const dbFieldName = snakeCase(fieldKey);

            if (options.existingColumns[dbFieldName]) {
                const comparison = SyncTable.compareFieldDefinition(options.existingColumns[dbFieldName], fieldDef);
                if (comparison.length > 0) {
                    modified = modified + 1;

                    const hasTypeChange = comparison.some((c) => c.type === "datatype");
                    if (hasTypeChange) {
                        const typeChange = comparison.find((c) => c.type === "datatype");
                        const currentType = String(typeChange?.current || "").toLowerCase();
                        const expectedType = SyncTable.getSqlType(fieldDef.type, fieldDef.max ?? null, fieldDef.unsigned ?? false).toLowerCase();

                        const currentBase = currentType
                            .replace(/\s*unsigned/gi, "")
                            .replace(/\([^)]*\)/g, "")
                            .trim();
                        const expectedBase = expectedType
                            .replace(/\s*unsigned/gi, "")
                            .replace(/\([^)]*\)/g, "")
                            .trim();

                        if (currentBase !== expectedBase && !SyncTable.isCompatibleTypeChange(currentType, expectedType))
                            throw new Error(
                                [
                                    `禁止字段类型变更: ${options.tableName}.${dbFieldName}`,
                                    `当前类型: ${typeChange?.current}`,
                                    `目标类型: ${typeChange?.expected}`,
                                    "说明: 仅允许宽化型变更（如 INT->BIGINT, VARCHAR->TEXT），以及 CHAR/VARCHAR 互转；DATETIME 与 BIGINT 不允许互转（需要手动迁移数据）"
                                ].join("\n")
                            );
                    }

                    // 简化实现：无论变更类型（含仅默认值变更），统一走 MODIFY COLUMN。
                    alterClauses.push(SyncTable.generateDDLClause(fieldKey, fieldDef, false));
                }
            } else {
                addedBusiness = addedBusiness + 1;
                alterClauses.push(SyncTable.generateDDLClause(fieldKey, fieldDef, true));
            }
        }

        for (const sysFieldName of systemFieldNames) {
            if (!options.existingColumns[sysFieldName]) {
                const colDef = SyncTable.getSystemColumnDef(sysFieldName);
                if (colDef) {
                    addedSystem = addedSystem + 1;
                    alterClauses.push(`ADD COLUMN ${colDef}`);
                }
            }
        }

        const desiredIndexMap: Record<string, string> = {};
        for (const sysField of SyncTable.SYSTEM_INDEX_FIELDS) {
            const fieldWillExist = options.existingColumns[sysField] || systemFieldNames.includes(sysField);
            if (fieldWillExist) {
                desiredIndexMap[`idx_${sysField}`] = sysField;
            }
        }
        for (const [fieldKey, fieldDef] of Object.entries(options.fields)) {
            const dbFieldName = snakeCase(fieldKey);
            if (fieldDef.index && !fieldDef.unique) {
                desiredIndexMap[`idx_${dbFieldName}`] = dbFieldName;
            }
        }

        const indexActions: Array<{ action: "create" | "drop"; indexName: string; fieldName: string }> = [
            ...Object.entries(desiredIndexMap)
                .filter(([indexName]) => !options.existingIndexes[indexName])
                .map(([indexName, fieldName]) => ({ action: "create" as const, indexName: indexName, fieldName: fieldName })),
            ...Object.entries(options.existingIndexes)
                .filter(([indexName, columns]) => !desiredIndexMap[indexName] && indexName.startsWith("idx_") && Array.isArray(columns) && columns.length === 1 && !SyncTable.SYSTEM_INDEX_FIELDS.includes(columns[0] as string))
                .map(([indexName, columns]) => ({ action: "drop" as const, indexName: indexName, fieldName: (columns as string[])[0] as string }))
        ];

        const plan: TablePlan = {
            changed: alterClauses.length > 0 || indexActions.length > 0,
            alterClauses: alterClauses,
            indexActions: indexActions
        };

        return {
            plan: plan,
            summary: {
                addedBusiness: addedBusiness,
                addedSystem: addedSystem,
                modified: modified,
                indexChanges: indexActions.length
            }
        };
    }

    /* ---------------------------------------------------------------------- */
    /* DDL 执行（失败时降级 algorithm/lock） */
    /* ---------------------------------------------------------------------- */

    private static truncateForLog(input: string, maxLen: number): string {
        const s = String(input);
        if (maxLen <= 0) return "";
        if (s.length <= maxLen) return s;

        // 头尾截断：方便复现时仍保留关键信息，同时避免消息过大。
        const headLen = Math.max(0, Math.floor(maxLen * 0.6));
        const tailLen = Math.max(0, maxLen - headLen);
        const head = s.slice(0, headLen);
        const tail = s.slice(Math.max(0, s.length - tailLen));
        return `${head} …(truncated, total=${s.length})… ${tail}`;
    }

    public static stripAlgorithmAndLock(stmt: string): string {
        let sql = String(stmt);

        sql = sql.replace(/\bALGORITHM\s*=\s*(INPLACE|INSTANT|COPY)\b\s*,?\s*/gi, "").replace(/\bLOCK\s*=\s*(NONE|SHARED|EXCLUSIVE)\b\s*,?\s*/gi, "");

        // 移除 ALGORITHM/LOCK 后可能出现：`ALTER TABLE t , ADD ...` 这种语法（表名后多了一个逗号）
        // 这里做一次专门清理，确保 fallback candidates 是合法 SQL。
        sql = sql.replace(/^\s*(ALTER\s+TABLE\s+(?:`[^`]+`|[a-zA-Z_][a-zA-Z0-9_]*))\s*,\s*/i, "$1 ");

        sql = sql
            .replace(/,\s*,/g, ", ")
            .replace(/,\s*$/g, "")
            .replace(/\s{2,}/g, " ")
            .trim();

        return sql;
    }

    public static buildDdlFallbackCandidates(stmt: string): Array<{ stmt: string; reason: string }> {
        const original = String(stmt);
        const attempted: Array<{ stmt: string; reason: string }> = [];

        // 1) COPY（保持 LOCK 原样）
        if (/\bALGORITHM\s*=\s*(INPLACE|INSTANT)\b/i.test(original)) {
            attempted.push({
                stmt: original.replace(/\bALGORITHM\s*=\s*(INPLACE|INSTANT)\b/gi, "ALGORITHM=COPY"),
                reason: "ALGORITHM → COPY"
            });
        }

        // 2) 去掉 ALGORITHM/LOCK：让 MySQL 自行选择（可能 COPY）
        const stripped = SyncTable.stripAlgorithmAndLock(original);
        if (stripped !== original) {
            attempted.push({ stmt: stripped, reason: "移除 ALGORITHM/LOCK" });
        }

        // 去重（保持顺序）
        const out: Array<{ stmt: string; reason: string }> = [];
        for (const item of attempted) {
            if (!item.stmt || item.stmt.trim() === "") continue;
            if (item.stmt === original) continue;
            if (out.some((x) => x.stmt === item.stmt)) continue;
            out.push(item);
        }

        return out;
    }

    public static async executeDDLSafely(db: SqlExecutor, stmt: string): Promise<boolean> {
        try {
            await db.unsafe(stmt);
            return true;
        } catch (error: any) {
            const candidates = SyncTable.buildDdlFallbackCandidates(stmt);
            const failureSummaries: string[] = [];
            let lastAttemptedError: unknown = error;
            for (const candidate of candidates) {
                try {
                    await db.unsafe(candidate.stmt);

                    // 仅在确实发生降级且成功时记录一条 debug，便于排查线上 DDL 算法/锁不兼容问题。
                    // 注意：不带“[表 xxx]”前缀，避免破坏“每表仅一条汇总日志”的约束测试。
                    Logger.debug(`[DDL降级] ${candidate.reason}（已成功）`);
                    return true;
                } catch (candidateError: any) {
                    lastAttemptedError = candidateError;
                    const errMsg = String(candidateError?.message || candidateError);
                    failureSummaries.push(`${candidate.reason}: ${errMsg}`);
                    // continue
                }
            }

            // 降级也失败时：抛出“更可诊断”的错误信息（包含降级链路与原始 SQL）。
            // 注意：这里不打印日志，只扩充错误 message，避免污染“每表仅一条汇总日志”的约束。
            const originalMsg = String(error?.message || error);
            const sqlLine = SyncTable.truncateForLog(String(stmt), 2000);
            const downgradeLine = failureSummaries.length > 0 ? failureSummaries.join(" | ") : "(无)";
            const outErr: any = new Error(`SQL执行失败: ${originalMsg}\nSQL: ${sqlLine}\n降级: ${downgradeLine}`);
            // 尽量透传 sqlInfo，便于上层记录具体 SQL（如有）。
            if (error?.sqlInfo) outErr.sqlInfo = error.sqlInfo;
            if (!outErr.sqlInfo && (lastAttemptedError as any)?.sqlInfo) outErr.sqlInfo = (lastAttemptedError as any).sqlInfo;

            throw outErr;
        }
    }

    /* ---------------------------------------------------------------------- */
    /* 对比/规则：判断字段是否需要变更，以及哪些变更是“兼容允许”的 */
    /* ---------------------------------------------------------------------- */

    public static isCompatibleTypeChange(currentType: string | null | undefined, newType: string | null | undefined): boolean {
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

        // TEXT 家族：允许互相转换（包含收缩），交由数据库自身约束（可能截断/报错）。
        // 目的：兼容历史库里已有的 TEXT / MEDIUMTEXT / LONGTEXT 等差异。
        if (SyncTable.TEXT_FAMILY.has(cBase) && SyncTable.TEXT_FAMILY.has(nBase)) {
            return true;
        }

        if (SyncTable.INT_TYPES.has(cBase) && SyncTable.INT_TYPES.has(nBase)) {
            const order = ["tinyint", "smallint", "mediumint", "int", "integer", "bigint"];
            const cIntIdx = order.indexOf(cBase);
            const nIntIdx = order.indexOf(nBase);
            if (nIntIdx > cIntIdx) return true;
        }

        if (cBase === "varchar" && (nBase === "text" || nBase === "mediumtext" || nBase === "longtext")) return true;

        // CHAR <-> VARCHAR：允许互转。
        // 说明：
        // - 该变更通常属于“等价/轻微变更”（尤其是相同长度时），但仍可能受字符集/排序规则/长度等影响。
        // - 是否会截断、是否会填充空格等，交由 MySQL 自身规则处理（可能成功，也可能失败）。
        if ((cBase === "char" && nBase === "varchar") || (cBase === "varchar" && nBase === "char")) {
            return true;
        }

        // 明确阻止：DATETIME <-> BIGINT
        // 说明：这类变更通常代表“时间表示法迁移”（字符串/时间列 vs 时间戳整数），需要数据搬迁脚本配合，不能由同步直接自动处理。
        if ((cBase === "datetime" && nBase === "bigint") || (cBase === "bigint" && nBase === "datetime")) {
            return false;
        }

        return false;
    }

    public static compareFieldDefinition(existingColumn: Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">, fieldDef: FieldDefinition): FieldChange[] {
        const changes: FieldChange[] = [];

        const normalized = normalizeFieldDefinition(fieldDef);

        const expectedType = SyncTable.getSqlType(normalized.type, normalized.max, normalized.unsigned).toLowerCase().replace(/\s+/g, " ").trim();

        const currentType = (
            typeof existingColumn.columnType === "string" && existingColumn.columnType.trim() !== ""
                ? existingColumn.columnType
                : typeof existingColumn.type === "string" && existingColumn.type.trim() !== ""
                  ? SyncTable.isStringOrArrayType(normalized.type) && typeof existingColumn.max === "number"
                      ? `${existingColumn.type.trim()}(${existingColumn.max})`
                      : existingColumn.type.trim()
                  : String((existingColumn as any).type ?? "")
        )
            .toLowerCase()
            .replace(/\s+/g, " ")
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

        const expectedDefault = SyncTable.resolveDefaultValue(normalized.default, normalized.type);
        if (String(existingColumn.defaultValue) !== String(expectedDefault)) {
            changes.push({
                type: "default",
                current: existingColumn.defaultValue,
                expected: expectedDefault
            });
        }

        return changes;
    }

    /* ---------------------------------------------------------------------- */
    /* information_schema 查询：读取表/列/索引元信息 */
    /* ---------------------------------------------------------------------- */

    /**
     * 只读查询 information_schema.TABLES，用于判断表是否存在。
     * - 该方法不会执行 DDL，不会修改数据库结构
     * - 失败时会包装错误信息（含 tableName / operation）以便排查
     */
    public static async tableExists(db: SqlExecutor, dbName: string, tableName: string): Promise<boolean> {
        try {
            const res = await db.unsafe<TableExistsRow[]>("SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [dbName, tableName]);
            return (res.data?.[0]?.count || 0) > 0;
        } catch (error: any) {
            throw SyncTable.buildRuntimeIoError("检查表是否存在", tableName, error);
        }
    }

    /**
     * 只读查询 information_schema.COLUMNS，读取列元信息。
     * - 该方法不会执行 DDL，不会修改数据库结构
     * - 返回结构用于与字段定义做对比（compareFieldDefinition）
     */
    public static async getTableColumns(db: SqlExecutor, dbName: string, tableName: string): Promise<{ [key: string]: ColumnInfo }> {
        const columns: { [key: string]: ColumnInfo } = {};

        try {
            const result = await db.unsafe<MySqlColumnInfoRow[]>("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [
                dbName,
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
            throw SyncTable.buildRuntimeIoError("读取列信息", tableName, error);
        }
    }

    /**
     * 只读查询 information_schema.STATISTICS，读取（非主键）索引元信息。
     * - 该方法不会执行 DDL，不会修改数据库结构
     * - 仅返回 PRIMARY 之外的索引（PRIMARY 会被同步逻辑视为系统约束）
     */
    public static async getTableIndexes(db: SqlExecutor, dbName: string, tableName: string): Promise<IndexInfo> {
        const indexes: IndexInfo = {};

        try {
            const result = await db.unsafe<MySqlIndexRow[]>("SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME", [dbName, tableName]);

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
            throw SyncTable.buildRuntimeIoError("读取索引信息", tableName, error);
        }
    }

    public static async ensureDbVersion(db: SqlExecutor): Promise<void> {
        const r = await db.unsafe<Array<{ version: string }>>("SELECT VERSION() AS version");
        if (!r.data || r.data.length === 0 || !r.data[0]?.version) {
            throw new Error("同步表：无法获取 MySQL 版本信息");
        }
        const version = r.data[0].version;
        const majorPart = String(version).split(".")[0] || "0";
        const majorVersion = parseInt(majorPart, 10);
        if (!Number.isFinite(majorVersion) || majorVersion < SyncTable.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR) {
            throw new Error(`同步表：仅支持 MySQL ${SyncTable.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR}.0+（当前版本：${version}）`);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* 同步计划应用：先 drop index -> alter columns -> create index */
    /* ---------------------------------------------------------------------- */

    public static async applyTablePlan(db: SqlExecutor, tableName: string, plan: TablePlan): Promise<void> {
        if (!plan || !plan.changed) return;

        // 先 drop 再 alter 再 create：避免“增大 VARCHAR 长度”时被现有索引 key length 限制卡住
        const batches = [
            { action: "drop" as const, errorMsg: "批量删除索引失败" },
            { action: "create" as const, errorMsg: "批量创建索引失败" }
        ];

        for (const batch of batches) {
            const actions = plan.indexActions.filter((a) => a.action === batch.action);
            if (actions.length > 0) {
                const clauses = actions.map((act) => SyncTable.buildIndexClause(act.indexName, act.fieldName, batch.action));
                await SyncTable.runIndexBatch(db, tableName, clauses, batch.errorMsg);
            }

            if (batch.action === "drop" && plan.alterClauses.length > 0) {
                const tableQuoted = SyncTable.quoteIdentifier(tableName);
                // 兼容性优先：INSTANT 在 MySQL 8 里并非所有 ALTER 都支持（即使版本满足 8.0+）。
                // 这里默认用 INPLACE + LOCK=NONE（尽量在线），失败时再走 executeDDLSafely 的降级链路（COPY / strip）。
                const stmt = `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ${plan.alterClauses.join(", ")}`;
                await SyncTable.executeDDLSafely(db, stmt);
            }
        }
    }

    /* ---------------------------------------------------------------------- */
    /* 建表 & 改表（核心同步流程，假设 checkTable 已保证合法性） */
    /* ---------------------------------------------------------------------- */

    public static async createTable(db: SqlExecutor, tableName: string, fields: Record<string, FieldDefinition>, systemIndexFields: ReadonlyArray<string> = SyncTable.SYSTEM_INDEX_FIELDS): Promise<void> {
        const colDefs = [...SyncTable.buildSystemColumnDefs(), ...SyncTable.buildBusinessColumnDefs(fields)];

        const cols = colDefs.join(",\n            ");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const { ENGINE, CHARSET, COLLATE } = SyncTable.MYSQL_TABLE_CONFIG;
        const createSQL = `CREATE TABLE ${tableQuoted} (\n            ${cols}\n        ) ENGINE=${ENGINE} DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATE}`;

        await db.unsafe(createSQL);

        Logger.debug(`[表 ${tableName}] + 创建表（系统字段 + 业务字段）`);

        const indexClauses: string[] = [];

        for (const sysField of systemIndexFields) {
            const indexName = `idx_${sysField}`;
            indexClauses.push(SyncTable.buildIndexClause(indexName, sysField, "create"));
        }

        for (const [fieldKey, fieldDef] of Object.entries(fields)) {
            const dbFieldName = snakeCase(fieldKey);
            if (fieldDef.index === true && fieldDef.unique !== true) {
                const indexName = `idx_${dbFieldName}`;
                indexClauses.push(SyncTable.buildIndexClause(indexName, dbFieldName, "create"));
            }
        }

        await SyncTable.runIndexBatch(db, tableName, indexClauses, "批量创建索引失败");
    }

    public static async modifyTable(db: SqlExecutor, dbName: string, tableName: string, fields: Record<string, FieldDefinition>): Promise<TablePlan> {
        const existingColumns = await SyncTable.getTableColumns(db, dbName, tableName);
        const existingIndexes = await SyncTable.getTableIndexes(db, dbName, tableName);

        const { plan, summary } = SyncTable.buildTablePlan({
            tableName: tableName,
            fields: fields,
            existingColumns: existingColumns,
            existingIndexes: existingIndexes
        });

        if (plan.changed) {
            // 在执行 DDL 前输出“单条汇总日志”（每张表最多一条），避免刷屏且仍保证表名明确。
            const msg = `[表 ${tableName}] 变更汇总，新增字段=${summary.addedBusiness}，新增系统字段=${summary.addedSystem}，修改字段=${summary.modified}，索引变更=${summary.indexChanges}`;
            Logger.debug(msg);

            await SyncTable.applyTablePlan(db, tableName, plan);
        }

        return plan;
    }
}
