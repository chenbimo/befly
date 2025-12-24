export type DbDialectName = "mysql" | "postgresql" | "sqlite";

let DIALECT_CACHE: Map<DbDialectName, DbDialect> | null = null;

/**
 * 获取方言实例（内部缓存，避免到处 new）。
 *
 * 约束：dialect 实例应当是纯逻辑对象（无连接/无 IO/无状态副作用），可全局复用。
 */
export function getDialectByName(name: DbDialectName): DbDialect {
    if (name !== "mysql" && name !== "postgresql" && name !== "sqlite") {
        throw new Error(`未知数据库方言: ${String(name)}`);
    }

    if (!DIALECT_CACHE) {
        DIALECT_CACHE = new Map<DbDialectName, DbDialect>();
        DIALECT_CACHE.set("mysql", new MySqlDialect());
        DIALECT_CACHE.set("postgresql", new PostgresDialect());
        DIALECT_CACHE.set("sqlite", new SqliteDialect());
    }

    const dialect = DIALECT_CACHE.get(name);
    if (!dialect) {
        throw new Error(`未知数据库方言: ${String(name)}`);
    }

    return dialect;
}

export type SqlTextQuery = {
    sql: string;
    params: unknown[];
};

export type SyncTableColumnsInfoQuery = {
    columns: SqlTextQuery;
    comments?: SqlTextQuery;
};

export type SyncTableIndexesQuery = SqlTextQuery;

/**
 * syncTable 专用：获取“列元信息”查询。
 *
 * 说明：
 * - 这里仅负责 SQL + 参数构造（方言差异）；
 * - 解析为 ColumnInfo 的逻辑仍放在 syncTable.ts（保持同步算法聚合）。
 */
export function getSyncTableColumnsInfoQuery(options: { dialect: DbDialectName; table: string; dbName: string; schema?: string }): SyncTableColumnsInfoQuery {
    if (options.dialect === "mysql") {
        const columns: SqlTextQuery = {
            sql: "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
            params: [options.dbName, options.table]
        };
        return { columns: columns };
    }

    if (options.dialect === "postgresql") {
        const schema = options.schema && options.schema.trim() !== "" ? options.schema : "public";
        const columns: SqlTextQuery = {
            sql: "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
            params: [schema, options.table]
        };

        const comments: SqlTextQuery = {
            sql: "SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS column_comment FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = ? AND c.relname = ? AND a.attnum > 0",
            params: [schema, options.table]
        };

        return { columns: columns, comments: comments };
    }

    const sqlite = getDialectByName("sqlite");
    const columns = sqlite.getTableColumnsQuery(options.table);
    return { columns: columns };
}

/**
 * syncTable 专用：获取“索引元信息”查询（只负责 SQL + 参数构造）。
 *
 * 约束：
 * - 仅下沉 MySQL / PostgreSQL；SQLite 仍走 PRAGMA（需要多次查询）。
 * - 解析（比如 PG indexdef 解析列名）仍留在 syncTable.ts。
 */
export function getSyncTableIndexesQuery(options: { dialect: DbDialectName; table: string; dbName: string; schema?: string }): SyncTableIndexesQuery {
    if (options.dialect === "mysql") {
        return {
            sql: "SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME",
            params: [options.dbName, options.table]
        };
    }

    if (options.dialect === "postgresql") {
        const schema = options.schema && options.schema.trim() !== "" ? options.schema : "public";
        return {
            sql: "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = ?",
            params: [schema, options.table]
        };
    }

    throw new Error(`getSyncTableIndexesQuery 不支持方言: ${String(options.dialect)}`);
}

export interface DbDialect {
    name: DbDialectName;

    /**
     * 转义/引用 SQL 标识符（表名/字段名）。
     * 注意：仅用于单个标识符片段，不支持包含空格、点号、函数等复杂表达式。
     */
    quoteIdent(identifier: string): string;

    /**
     * 获取表字段列表的查询。
     * 约定：返回结果应能通过 getTableColumnsFromResult 提取列名。
     */
    getTableColumnsQuery(table: string, schema?: string): SqlTextQuery;

    /** 从 getTableColumnsQuery 的结果中提取列名数组 */
    getTableColumnsFromResult(result: any): string[];

    /** 检查表是否存在的查询 */
    tableExistsQuery(table: string, schema?: string): SqlTextQuery;

    /**
     * 是否支持 schema.table 形式（仅用于校验；具体 quoting 仍由 SqlBuilder 处理）。
     */
    supportsSchema: boolean;
}

export class MySqlDialect implements DbDialect {
    name: DbDialectName = "mysql";
    supportsSchema: boolean = true;

    quoteIdent(identifier: string): string {
        if (typeof identifier !== "string") {
            throw new Error(`quoteIdent 需要字符串类型标识符 (identifier: ${String(identifier)})`);
        }

        const trimmed = identifier.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            throw new Error(`无效的 SQL 标识符: ${trimmed}`);
        }

        return `\`${trimmed}\``;
    }

    getTableColumnsQuery(table: string, _schema?: string): SqlTextQuery {
        const quotedTable = this.quoteIdent(table);
        return { sql: `SHOW COLUMNS FROM ${quotedTable}`, params: [] };
    }

    getTableColumnsFromResult(result: any): string[] {
        if (!Array.isArray(result)) {
            return [];
        }

        const columnNames: string[] = [];
        for (const row of result) {
            const name = row?.Field;
            if (typeof name === "string" && name.length > 0) {
                columnNames.push(name);
            }
        }

        return columnNames;
    }

    tableExistsQuery(table: string, schema?: string): SqlTextQuery {
        if (typeof schema === "string" && schema.trim() !== "") {
            return {
                sql: "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
                params: [schema, table]
            };
        }
        return { sql: "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", params: [table] };
    }
}

export class PostgresDialect implements DbDialect {
    name: DbDialectName = "postgresql";
    supportsSchema: boolean = true;

    quoteIdent(identifier: string): string {
        if (typeof identifier !== "string") {
            throw new Error(`quoteIdent 需要字符串类型标识符 (identifier: ${String(identifier)})`);
        }

        const trimmed = identifier.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            throw new Error(`无效的 SQL 标识符: ${trimmed}`);
        }

        // PostgreSQL 使用双引号引用标识符
        return `"${trimmed}"`;
    }

    getTableColumnsQuery(table: string, schema?: string): SqlTextQuery {
        if (typeof schema === "string" && schema.trim() !== "") {
            return {
                sql: "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
                params: [schema, table]
            };
        }
        return { sql: "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position", params: [table] };
    }

    getTableColumnsFromResult(result: any): string[] {
        if (!Array.isArray(result)) {
            return [];
        }

        const columnNames: string[] = [];
        for (const row of result) {
            const name = row?.column_name;
            if (typeof name === "string" && name.length > 0) {
                columnNames.push(name);
            }
        }

        return columnNames;
    }

    tableExistsQuery(table: string, schema?: string): SqlTextQuery {
        if (typeof schema === "string" && schema.trim() !== "") {
            return {
                sql: "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                params: [schema, table]
            };
        }
        return { sql: "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?", params: [table] };
    }
}

export class SqliteDialect implements DbDialect {
    name: DbDialectName = "sqlite";
    // SQLite 的“schema”语义与 MySQL/PG 不同：常规使用下没有独立 schema；
    // 虽然存在 main/temp/attached db 的 database_name.table_name 形式，但这里
    // 统一视为不支持传统 schema.table 校验语义。
    supportsSchema: boolean = false;

    quoteIdent(identifier: string): string {
        if (typeof identifier !== "string") {
            throw new Error(`quoteIdent 需要字符串类型标识符 (identifier: ${String(identifier)})`);
        }

        const trimmed = identifier.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            throw new Error(`无效的 SQL 标识符: ${trimmed}`);
        }

        // SQLite 也支持双引号引用标识符
        return `"${trimmed}"`;
    }

    getTableColumnsQuery(table: string, _schema?: string): SqlTextQuery {
        // PRAGMA 不支持参数占位符；此处通过 quoteIdent 限制输入并安全拼接
        const quotedTable = this.quoteIdent(table);
        return { sql: `PRAGMA table_info(${quotedTable})`, params: [] };
    }

    getTableColumnsFromResult(result: any): string[] {
        if (!Array.isArray(result)) {
            return [];
        }

        const columnNames: string[] = [];
        for (const row of result) {
            const name = row?.name;
            if (typeof name === "string" && name.length > 0) {
                columnNames.push(name);
            }
        }

        return columnNames;
    }

    tableExistsQuery(table: string, _schema?: string): SqlTextQuery {
        return {
            sql: "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?",
            params: [table]
        };
    }
}
