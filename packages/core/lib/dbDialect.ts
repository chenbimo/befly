export type DbDialectName = "mysql" | "postgresql" | "sqlite";

export type SqlTextQuery = {
    sql: string;
    params: any[];
};

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
    getTableColumnsQuery(table: string): SqlTextQuery;

    /** 从 getTableColumnsQuery 的结果中提取列名数组 */
    getTableColumnsFromResult(result: any): string[];

    /** 检查表是否存在的查询 */
    tableExistsQuery(table: string): SqlTextQuery;

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

    getTableColumnsQuery(table: string): SqlTextQuery {
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

    tableExistsQuery(table: string): SqlTextQuery {
        return {
            sql: "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            params: [table]
        };
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

    getTableColumnsQuery(table: string): SqlTextQuery {
        return {
            sql: "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position",
            params: [table]
        };
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

    tableExistsQuery(table: string): SqlTextQuery {
        return {
            sql: "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?",
            params: [table]
        };
    }
}

export class SqliteDialect implements DbDialect {
    name: DbDialectName = "sqlite";
    supportsSchema: boolean = true;

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

    getTableColumnsQuery(table: string): SqlTextQuery {
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

    tableExistsQuery(table: string): SqlTextQuery {
        return {
            sql: "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?",
            params: [table]
        };
    }
}
