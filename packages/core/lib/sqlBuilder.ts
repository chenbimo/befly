/**
 * SQL 构造器 - TypeScript 版本
 * 提供链式 API 构建 SQL 查询
 */

import type { WhereConditions, WhereOperator, OrderDirection, SqlQuery, InsertData, UpdateData, SqlValue } from "../types/common.js";

/**
 * SQL 构建器类
 */
export class SqlBuilder {
    private _select: string[] = [];
    private _from: string = "";
    private _where: string[] = [];
    private _joins: string[] = [];
    private _orderBy: string[] = [];
    private _groupBy: string[] = [];
    private _having: string[] = [];
    private _limit: number | null = null;
    private _offset: number | null = null;
    private _params: SqlValue[] = [];
    private _quoteIdent: (identifier: string) => string;

    constructor(options?: { quoteIdent?: (identifier: string) => string }) {
        if (options && options.quoteIdent) {
            this._quoteIdent = options.quoteIdent;
        } else {
            this._quoteIdent = (identifier: string) => {
                if (typeof identifier !== "string") {
                    throw new Error(`quoteIdent 需要字符串类型标识符 (identifier: ${String(identifier)})`);
                }

                const trimmed = identifier.trim();
                if (!trimmed) {
                    throw new Error("SQL 标识符不能为空");
                }

                // 默认行为（MySQL 风格）：允许特殊字符，但对反引号进行转义
                const escaped = trimmed.replace(/`/g, "``");
                return `\`${escaped}\``;
            };
        }
    }

    private _isQuotedIdent(value: string): boolean {
        const trimmed = value.trim();
        if (trimmed.length < 2) return false;

        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];

        if (first === "`" && last === "`") return true;
        if (first === '"' && last === '"') return true;

        return false;
    }

    private _startsWithQuote(value: string): boolean {
        const trimmed = value.trim();
        return trimmed.startsWith("`") || trimmed.startsWith('"');
    }

    /**
     * 重置构建器状态
     */
    reset(): this {
        this._select = [];
        this._from = "";
        this._where = [];
        this._joins = [];
        this._orderBy = [];
        this._groupBy = [];
        this._having = [];
        this._limit = null;
        this._offset = null;
        this._params = [];
        return this;
    }

    /**
     * 转义字段名
     */
    private _escapeField(field: string): string {
        if (typeof field !== "string") {
            return field;
        }

        field = field.trim();

        // 防止不完整引用被误认为“已安全引用”
        if (this._startsWithQuote(field) && !this._isQuotedIdent(field)) {
            throw new Error(`字段标识符引用不完整，请使用成对的 \`...\` 或 "..." (field: ${field})`);
        }

        // 如果是 * 或已经被引用，直接返回
        if (field === "*" || this._isQuotedIdent(field)) {
            return field;
        }

        // 收紧：包含函数/表达式（括号）不允许走自动转义路径
        // 这类表达式应显式使用 selectRaw/whereRaw 以避免误拼接和注入风险
        if (field.includes("(") || field.includes(")")) {
            throw new Error(`字段包含函数/表达式，请使用 selectRaw/whereRaw (field: ${field})`);
        }

        // 处理别名（AS关键字）
        if (field.toUpperCase().includes(" AS ")) {
            const parts = field.split(/\s+AS\s+/i);
            const fieldPart = parts[0].trim();
            const aliasPart = parts[1].trim();
            // alias 仅允许安全标识符或已被引用
            if (!this._isQuotedIdent(aliasPart) && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(aliasPart)) {
                throw new Error(`无效的字段别名: ${aliasPart}`);
            }
            return `${this._escapeField(fieldPart)} AS ${aliasPart}`;
        }

        // 处理表名.字段名的情况（多表联查）
        if (field.includes(".")) {
            const parts = field.split(".");
            return parts
                .map((part) => {
                    part = part.trim();
                    if (part === "*" || this._isQuotedIdent(part)) {
                        return part;
                    }

                    if (this._startsWithQuote(part) && !this._isQuotedIdent(part)) {
                        throw new Error(`字段标识符引用不完整，请使用成对的 \`...\` 或 "..." (field: ${field})`);
                    }
                    return this._quoteIdent(part);
                })
                .join(".");
        }

        // 处理单个字段名
        return this._quoteIdent(field);
    }

    private _validateIdentifierPart(part: string, kind: "table" | "schema" | "alias" | "field"): void {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
            throw new Error(`无效的 ${kind} 标识符: ${part}`);
        }
    }

    /**
     * 转义表名
     */
    private _escapeTable(table: string): string {
        if (typeof table !== "string") {
            return table;
        }

        table = table.trim();

        // 防止不完整引用被误认为“已安全引用”
        if (this._startsWithQuote(table) && !this._isQuotedIdent(table)) {
            // 注意：这里可能是 `table` alias 的形式，整体不成对，但 namePart 可能成对。
            // 因此这里只做“整体是单段引用”的判断，具体在后续 namePart 分支里校验。
        }

        if (this._isQuotedIdent(table)) {
            return table;
        }

        const parts = table.split(/\s+/).filter((p) => p.length > 0);
        if (parts.length === 0) {
            throw new Error("FROM 表名不能为空");
        }

        if (parts.length > 2) {
            throw new Error(`不支持的表引用格式（包含过多片段）。请使用 fromRaw 显式传入复杂表达式 (table: ${table})`);
        }

        const namePart = parts[0].trim();
        const aliasPart = parts.length === 2 ? parts[1].trim() : null;

        const nameSegments = namePart.split(".");
        if (nameSegments.length > 2) {
            throw new Error(`不支持的表引用格式（schema 层级过深）。请使用 fromRaw (table: ${table})`);
        }

        let escapedName = "";
        if (nameSegments.length === 2) {
            const schema = nameSegments[0].trim();
            const tableName = nameSegments[1].trim();

            const escapedSchema = this._isQuotedIdent(schema)
                ? schema
                : (() => {
                      if (this._startsWithQuote(schema) && !this._isQuotedIdent(schema)) {
                          throw new Error(`schema 标识符引用不完整，请使用成对的 \`...\` 或 "..." (schema: ${schema})`);
                      }
                      this._validateIdentifierPart(schema, "schema");
                      return this._quoteIdent(schema);
                  })();

            const escapedTableName = this._isQuotedIdent(tableName)
                ? tableName
                : (() => {
                      if (this._startsWithQuote(tableName) && !this._isQuotedIdent(tableName)) {
                          throw new Error(`table 标识符引用不完整，请使用成对的 \`...\` 或 "..." (table: ${tableName})`);
                      }
                      this._validateIdentifierPart(tableName, "table");
                      return this._quoteIdent(tableName);
                  })();

            escapedName = `${escapedSchema}.${escapedTableName}`;
        } else {
            const tableName = nameSegments[0].trim();

            if (this._isQuotedIdent(tableName)) {
                escapedName = tableName;
            } else {
                if (this._startsWithQuote(tableName) && !this._isQuotedIdent(tableName)) {
                    throw new Error(`table 标识符引用不完整，请使用成对的 \`...\` 或 "..." (table: ${tableName})`);
                }
                this._validateIdentifierPart(tableName, "table");
                escapedName = this._quoteIdent(tableName);
            }
        }

        if (aliasPart) {
            this._validateIdentifierPart(aliasPart, "alias");
            return `${escapedName} ${aliasPart}`;
        }

        return escapedName;
    }

    /**
     * 验证参数
     */
    private _validateParam(value: any): void {
        if (value === undefined) {
            throw new Error(`参数值不能为 undefined`);
        }
    }

    /**
     * 处理单个操作符条件
     */
    private _applyOperator(fieldName: string, operator: WhereOperator, value: any): void {
        const escapedField = this._escapeField(fieldName);

        switch (operator) {
            case "$ne":
            case "$not":
                this._validateParam(value);
                this._where.push(`${escapedField} != ?`);
                this._params.push(value);
                break;

            case "$in":
                if (!Array.isArray(value)) {
                    throw new Error(`$in 操作符的值必须是数组 (operator: ${operator})`);
                }
                if (value.length === 0) {
                    throw new Error(`$in 操作符的数组不能为空。提示：空数组会导致查询永远不匹配任何记录，这通常不是预期行为。请检查查询条件或移除该字段。`);
                }
                const placeholders = value.map(() => "?").join(",");
                this._where.push(`${escapedField} IN (${placeholders})`);
                this._params.push(...value);
                break;

            case "$nin":
            case "$notIn":
                if (!Array.isArray(value)) {
                    throw new Error(`$nin/$notIn 操作符的值必须是数组 (operator: ${operator})`);
                }
                if (value.length === 0) {
                    throw new Error(`$nin/$notIn 操作符的数组不能为空。提示：空数组会导致查询匹配所有记录，这通常不是预期行为。请检查查询条件或移除该字段。`);
                }
                const placeholders2 = value.map(() => "?").join(",");
                this._where.push(`${escapedField} NOT IN (${placeholders2})`);
                this._params.push(...value);
                break;

            case "$like":
                this._validateParam(value);
                this._where.push(`${escapedField} LIKE ?`);
                this._params.push(value);
                break;

            case "$notLike":
                this._validateParam(value);
                this._where.push(`${escapedField} NOT LIKE ?`);
                this._params.push(value);
                break;

            case "$gt":
                this._validateParam(value);
                this._where.push(`${escapedField} > ?`);
                this._params.push(value);
                break;

            case "$gte":
                this._validateParam(value);
                this._where.push(`${escapedField} >= ?`);
                this._params.push(value);
                break;

            case "$lt":
                this._validateParam(value);
                this._where.push(`${escapedField} < ?`);
                this._params.push(value);
                break;

            case "$lte":
                this._validateParam(value);
                this._where.push(`${escapedField} <= ?`);
                this._params.push(value);
                break;

            case "$between":
                if (Array.isArray(value) && value.length === 2) {
                    this._validateParam(value[0]);
                    this._validateParam(value[1]);
                    this._where.push(`${escapedField} BETWEEN ? AND ?`);
                    this._params.push(value[0], value[1]);
                }
                break;

            case "$notBetween":
                if (Array.isArray(value) && value.length === 2) {
                    this._validateParam(value[0]);
                    this._validateParam(value[1]);
                    this._where.push(`${escapedField} NOT BETWEEN ? AND ?`);
                    this._params.push(value[0], value[1]);
                }
                break;

            case "$null":
                if (value === true) {
                    this._where.push(`${escapedField} IS NULL`);
                }
                break;

            case "$notNull":
                if (value === true) {
                    this._where.push(`${escapedField} IS NOT NULL`);
                }
                break;

            default:
                // 等于条件
                this._validateParam(value);
                this._where.push(`${escapedField} = ?`);
                this._params.push(value);
        }
    }

    /**
     * 处理复杂的 WHERE 条件对象
     */
    private _processWhereConditions(whereObj: WhereConditions): void {
        if (!whereObj || typeof whereObj !== "object") {
            return;
        }

        Object.entries(whereObj).forEach(([key, value]) => {
            // 跳过undefined值
            if (value === undefined) {
                return;
            }

            if (key === "$and") {
                if (Array.isArray(value)) {
                    value.forEach((condition) => this._processWhereConditions(condition));
                }
            } else if (key === "$or") {
                if (Array.isArray(value)) {
                    const orConditions: string[] = [];
                    const tempParams: SqlValue[] = [];

                    value.forEach((condition) => {
                        const tempBuilder = new SqlBuilder({ quoteIdent: this._quoteIdent });
                        tempBuilder._processWhereConditions(condition);
                        if (tempBuilder._where.length > 0) {
                            orConditions.push(`(${tempBuilder._where.join(" AND ")})`);
                            tempParams.push(...tempBuilder._params);
                        }
                    });

                    if (orConditions.length > 0) {
                        this._where.push(`(${orConditions.join(" OR ")})`);
                        this._params.push(...tempParams);
                    }
                }
            } else if (key.includes("$")) {
                // 一级属性格式：age$gt, role$in 等
                const lastDollarIndex = key.lastIndexOf("$");
                const fieldName = key.substring(0, lastDollarIndex);
                const operator = ("$" + key.substring(lastDollarIndex + 1)) as WhereOperator;
                this._applyOperator(fieldName, operator, value);
            } else {
                // 检查值是否为对象（嵌套条件）
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    // 嵌套条件：如 { age: { $gt: 18 } }
                    for (const [op, val] of Object.entries(value)) {
                        this._applyOperator(key, op as WhereOperator, val);
                    }
                } else {
                    // 简单的等于条件
                    this._validateParam(value);
                    const escapedKey = this._escapeField(key);
                    this._where.push(`${escapedKey} = ?`);
                    this._params.push(value);
                }
            }
        });
    }

    /**
     * 获取 WHERE 条件（供 DbHelper 使用）
     */
    getWhereConditions(): { sql: string; params: SqlValue[] } {
        return {
            sql: this._where.length > 0 ? this._where.join(" AND ") : "",
            params: [...this._params]
        };
    }

    /**
     * SELECT 字段
     */
    select(fields: string | string[] = "*"): this {
        if (Array.isArray(fields)) {
            this._select = [...this._select, ...fields.map((field) => this._escapeField(field))];
        } else if (typeof fields === "string") {
            this._select.push(this._escapeField(fields));
        } else {
            throw new Error("SELECT 字段必须是字符串或数组");
        }
        return this;
    }

    /**
     * SELECT 原始表达式（不做转义）
     */
    selectRaw(expr: string): this {
        if (typeof expr !== "string" || !expr.trim()) {
            throw new Error(`selectRaw 需要非空字符串 (expr: ${String(expr)})`);
        }
        this._select.push(expr);
        return this;
    }

    /**
     * FROM 表名
     */
    from(table: string): this {
        if (typeof table !== "string" || !table.trim()) {
            throw new Error(`FROM 表名必须是非空字符串 (table: ${table})`);
        }
        this._from = this._escapeTable(table.trim());
        return this;
    }

    /**
     * FROM 原始表达式（不做转义）
     */
    fromRaw(tableExpr: string): this {
        if (typeof tableExpr !== "string" || !tableExpr.trim()) {
            throw new Error(`fromRaw 需要非空字符串 (tableExpr: ${String(tableExpr)})`);
        }
        this._from = tableExpr;
        return this;
    }

    /**
     * WHERE 条件
     */
    where(condition: WhereConditions): this;
    where(field: string, value: SqlValue): this;
    where(conditionOrField: WhereConditions | string, value?: SqlValue): this {
        if (typeof conditionOrField === "object" && conditionOrField !== null) {
            this._processWhereConditions(conditionOrField);
            return this;
        }

        if (typeof conditionOrField === "string") {
            if (value === undefined) {
                throw new Error("where(field, value) 不允许省略 value。若需传入原始 WHERE，请使用 whereRaw");
            }
            this._validateParam(value);
            const escapedCondition = this._escapeField(conditionOrField);
            this._where.push(`${escapedCondition} = ?`);
            this._params.push(value);
            return this;
        }

        return this;
    }

    /**
     * WHERE 原始片段（不做转义），可附带参数。
     */
    whereRaw(sql: string, params?: SqlValue[]): this {
        if (typeof sql !== "string" || !sql.trim()) {
            throw new Error(`whereRaw 需要非空字符串 (sql: ${String(sql)})`);
        }

        this._where.push(sql);
        if (params && params.length > 0) {
            this._params.push(...params);
        }

        return this;
    }

    /**
     * LEFT JOIN
     */
    leftJoin(table: string, on: string): this {
        if (typeof table !== "string" || typeof on !== "string") {
            throw new Error(`JOIN 表名和条件必须是字符串 (table: ${table}, on: ${on})`);
        }
        const escapedTable = this._escapeTable(table);
        this._joins.push(`LEFT JOIN ${escapedTable} ON ${on}`);
        return this;
    }

    /**
     * RIGHT JOIN
     */
    rightJoin(table: string, on: string): this {
        if (typeof table !== "string" || typeof on !== "string") {
            throw new Error(`JOIN 表名和条件必须是字符串 (table: ${table}, on: ${on})`);
        }
        const escapedTable = this._escapeTable(table);
        this._joins.push(`RIGHT JOIN ${escapedTable} ON ${on}`);
        return this;
    }

    /**
     * INNER JOIN
     */
    innerJoin(table: string, on: string): this {
        if (typeof table !== "string" || typeof on !== "string") {
            throw new Error(`JOIN 表名和条件必须是字符串 (table: ${table}, on: ${on})`);
        }
        const escapedTable = this._escapeTable(table);
        this._joins.push(`INNER JOIN ${escapedTable} ON ${on}`);
        return this;
    }

    /**
     * ORDER BY
     * @param fields - 格式为 ["field#ASC", "field2#DESC"]
     */
    orderBy(fields: string[]): this {
        if (!Array.isArray(fields)) {
            throw new Error('orderBy 必须是字符串数组，格式为 "字段#方向"');
        }

        fields.forEach((item) => {
            if (typeof item !== "string" || !item.includes("#")) {
                throw new Error(`orderBy 字段必须是 "字段#方向" 格式的字符串（例如："name#ASC", "id#DESC"） (item: ${item})`);
            }

            const [fieldName, direction] = item.split("#");
            const cleanField = fieldName.trim();
            const cleanDir = direction.trim().toUpperCase() as OrderDirection;

            if (!cleanField) {
                throw new Error(`orderBy 中字段名不能为空 (item: ${item})`);
            }

            if (!["ASC", "DESC"].includes(cleanDir)) {
                throw new Error(`ORDER BY 方向必须是 ASC 或 DESC (direction: ${cleanDir})`);
            }

            const escapedField = this._escapeField(cleanField);
            this._orderBy.push(`${escapedField} ${cleanDir}`);
        });

        return this;
    }

    /**
     * GROUP BY
     */
    groupBy(field: string | string[]): this {
        if (Array.isArray(field)) {
            const escapedFields = field.filter((f) => typeof f === "string").map((f) => this._escapeField(f));
            this._groupBy = [...this._groupBy, ...escapedFields];
        } else if (typeof field === "string") {
            this._groupBy.push(this._escapeField(field));
        }
        return this;
    }

    /**
     * HAVING
     */
    having(condition: string): this {
        if (typeof condition === "string") {
            this._having.push(condition);
        }
        return this;
    }

    /**
     * LIMIT
     */
    limit(count: number, offset?: number): this {
        if (typeof count !== "number" || count < 0) {
            throw new Error(`LIMIT 数量必须是非负数 (count: ${count})`);
        }
        this._limit = Math.floor(count);
        if (offset !== undefined && offset !== null) {
            if (typeof offset !== "number" || offset < 0) {
                throw new Error(`OFFSET 必须是非负数 (offset: ${offset})`);
            }
            this._offset = Math.floor(offset);
        }
        return this;
    }

    /**
     * OFFSET
     */
    offset(count: number): this {
        if (typeof count !== "number" || count < 0) {
            throw new Error(`OFFSET 必须是非负数 (count: ${count})`);
        }
        this._offset = Math.floor(count);
        return this;
    }

    /**
     * 构建 SELECT 查询
     */
    toSelectSql(): SqlQuery {
        let sql = "SELECT ";

        sql += this._select.length > 0 ? this._select.join(", ") : "*";

        if (!this._from) {
            throw new Error("FROM 表名是必需的");
        }
        sql += ` FROM ${this._from}`;

        if (this._joins.length > 0) {
            sql += " " + this._joins.join(" ");
        }

        if (this._where.length > 0) {
            sql += " WHERE " + this._where.join(" AND ");
        }

        if (this._groupBy.length > 0) {
            sql += " GROUP BY " + this._groupBy.join(", ");
        }

        if (this._having.length > 0) {
            sql += " HAVING " + this._having.join(" AND ");
        }

        if (this._orderBy.length > 0) {
            sql += " ORDER BY " + this._orderBy.join(", ");
        }

        if (this._limit !== null) {
            sql += ` LIMIT ${this._limit}`;
            if (this._offset !== null) {
                sql += ` OFFSET ${this._offset}`;
            }
        }

        return { sql, params: [...this._params] };
    }

    /**
     * 构建 INSERT 查询
     */
    toInsertSql(table: string, data: InsertData): SqlQuery {
        if (!table || typeof table !== "string") {
            throw new Error(`INSERT 需要表名 (table: ${table})`);
        }

        if (!data || typeof data !== "object") {
            throw new Error(`INSERT 需要数据 (table: ${table}, data: ${JSON.stringify(data)})`);
        }

        const escapedTable = this._escapeTable(table);

        if (Array.isArray(data)) {
            if (data.length === 0) {
                throw new Error(`插入数据不能为空 (table: ${table})`);
            }

            const fields = Object.keys(data[0]);
            if (fields.length === 0) {
                throw new Error(`插入数据必须至少有一个字段 (table: ${table})`);
            }

            // 批量 INSERT：要求每行字段集合一致，且参数不可为 undefined
            const fieldSet = new Set(fields);
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (!row || typeof row !== "object" || Array.isArray(row)) {
                    throw new Error(`批量插入的每一行必须是对象 (table: ${table}, rowIndex: ${i})`);
                }

                const rowKeys = Object.keys(row);
                if (rowKeys.length !== fields.length) {
                    throw new Error(`批量插入每行字段必须一致 (table: ${table}, rowIndex: ${i})`);
                }

                for (const key of rowKeys) {
                    if (!fieldSet.has(key)) {
                        throw new Error(`批量插入每行字段必须一致 (table: ${table}, rowIndex: ${i}, extraField: ${key})`);
                    }
                }

                for (const field of fields) {
                    // 缺字段或 undefined 都不允许
                    if (!(field in row)) {
                        throw new Error(`批量插入缺少字段 (table: ${table}, rowIndex: ${i}, field: ${field})`);
                    }
                    this._validateParam((row as any)[field]);
                }
            }

            const escapedFields = fields.map((field) => this._escapeField(field));
            const placeholders = fields.map(() => "?").join(", ");
            const values = data.map(() => `(${placeholders})`).join(", ");

            const sql = `INSERT INTO ${escapedTable} (${escapedFields.join(", ")}) VALUES ${values}`;
            const params: SqlValue[] = [];
            for (let i = 0; i < data.length; i++) {
                const row = data[i] as Record<string, SqlValue>;
                for (const field of fields) {
                    params.push(row[field]);
                }
            }

            return { sql, params };
        } else {
            const fields = Object.keys(data);
            if (fields.length === 0) {
                throw new Error(`插入数据必须至少有一个字段 (table: ${table})`);
            }

            for (const field of fields) {
                this._validateParam((data as any)[field]);
            }

            const escapedFields = fields.map((field) => this._escapeField(field));
            const placeholders = fields.map(() => "?").join(", ");
            const sql = `INSERT INTO ${escapedTable} (${escapedFields.join(", ")}) VALUES (${placeholders})`;
            const params = fields.map((field) => data[field]);

            return { sql, params };
        }
    }

    /**
     * 构建 UPDATE 查询
     */
    toUpdateSql(table: string, data: UpdateData): SqlQuery {
        if (!table || typeof table !== "string") {
            throw new Error("UPDATE 需要表名");
        }

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("UPDATE 需要数据对象");
        }

        const fields = Object.keys(data);
        if (fields.length === 0) {
            throw new Error("更新数据必须至少有一个字段");
        }

        const escapedTable = this._escapeTable(table);
        const setFields = fields.map((field) => `${this._escapeField(field)} = ?`);
        const params: SqlValue[] = [...Object.values(data), ...this._params];

        let sql = `UPDATE ${escapedTable} SET ${setFields.join(", ")}`;

        if (this._where.length > 0) {
            sql += " WHERE " + this._where.join(" AND ");
        } else {
            throw new Error("为安全起见，UPDATE 需要 WHERE 条件");
        }

        return { sql, params };
    }

    /**
     * 构建 DELETE 查询
     */
    toDeleteSql(table: string): SqlQuery {
        if (!table || typeof table !== "string") {
            throw new Error("DELETE 需要表名");
        }

        const escapedTable = this._escapeTable(table);
        let sql = `DELETE FROM ${escapedTable}`;

        if (this._where.length > 0) {
            sql += " WHERE " + this._where.join(" AND ");
        } else {
            throw new Error("为安全起见，DELETE 需要 WHERE 条件");
        }

        return { sql, params: [...this._params] };
    }

    /**
     * 构建 COUNT 查询
     */
    toCountSql(): SqlQuery {
        let sql = "SELECT COUNT(*) as total";

        if (!this._from) {
            throw new Error("COUNT 需要 FROM 表名");
        }
        sql += ` FROM ${this._from}`;

        if (this._joins.length > 0) {
            sql += " " + this._joins.join(" ");
        }

        if (this._where.length > 0) {
            sql += " WHERE " + this._where.join(" AND ");
        }

        return { sql, params: [...this._params] };
    }

    static toDeleteInSql(options: { table: string; idField: string; ids: SqlValue[]; quoteIdent: (identifier: string) => string }): SqlQuery {
        if (typeof options.table !== "string" || !options.table.trim()) {
            throw new Error(`toDeleteInSql 需要非空表名 (table: ${String(options.table)})`);
        }
        if (typeof options.idField !== "string" || !options.idField.trim()) {
            throw new Error(`toDeleteInSql 需要非空 idField (idField: ${String(options.idField)})`);
        }
        if (!Array.isArray(options.ids)) {
            throw new Error("toDeleteInSql 需要 ids 数组");
        }
        if (options.ids.length === 0) {
            return { sql: "", params: [] };
        }

        const placeholders = options.ids.map(() => "?").join(",");
        const sql = `DELETE FROM ${options.quoteIdent(options.table)} WHERE ${options.quoteIdent(options.idField)} IN (${placeholders})`;
        return { sql: sql, params: [...options.ids] };
    }

    static toUpdateCaseByIdSql(options: {
        table: string;
        idField: string;
        rows: Array<{ id: SqlValue; data: Record<string, SqlValue> }>;
        fields: string[];
        quoteIdent: (identifier: string) => string;
        updatedAtField: string;
        updatedAtValue: SqlValue;
        stateField?: string;
        stateGtZero?: boolean;
    }): SqlQuery {
        if (typeof options.table !== "string" || !options.table.trim()) {
            throw new Error(`toUpdateCaseByIdSql 需要非空表名 (table: ${String(options.table)})`);
        }
        if (typeof options.idField !== "string" || !options.idField.trim()) {
            throw new Error(`toUpdateCaseByIdSql 需要非空 idField (idField: ${String(options.idField)})`);
        }
        if (!Array.isArray(options.rows)) {
            throw new Error("toUpdateCaseByIdSql 需要 rows 数组");
        }
        if (options.rows.length === 0) {
            return { sql: "", params: [] };
        }
        if (!Array.isArray(options.fields)) {
            throw new Error("toUpdateCaseByIdSql 需要 fields 数组");
        }
        if (options.fields.length === 0) {
            return { sql: "", params: [] };
        }

        const ids: SqlValue[] = options.rows.map((r) => r.id);
        const placeholders = ids.map(() => "?").join(",");

        const setSqlList: string[] = [];
        const args: SqlValue[] = [];

        const quotedId = options.quoteIdent(options.idField);

        for (const field of options.fields) {
            const whenList: string[] = [];

            for (const row of options.rows) {
                if (!(field in row.data)) {
                    continue;
                }

                whenList.push("WHEN ? THEN ?");
                args.push(row.id);
                args.push(row.data[field]);
            }

            if (whenList.length === 0) {
                continue;
            }

            const quotedField = options.quoteIdent(field);
            setSqlList.push(`${quotedField} = CASE ${quotedId} ${whenList.join(" ")} ELSE ${quotedField} END`);
        }

        setSqlList.push(`${options.quoteIdent(options.updatedAtField)} = ?`);
        args.push(options.updatedAtValue);

        for (const id of ids) {
            args.push(id);
        }

        let sql = `UPDATE ${options.quoteIdent(options.table)} SET ${setSqlList.join(", ")} WHERE ${quotedId} IN (${placeholders})`;
        if (options.stateGtZero && options.stateField) {
            sql += ` AND ${options.quoteIdent(options.stateField)} > 0`;
        }

        return { sql: sql, params: args };
    }
}

/**
 * 创建新的 SQL 构建器实例
 */
export function createQueryBuilder(): SqlBuilder {
    return new SqlBuilder();
}
