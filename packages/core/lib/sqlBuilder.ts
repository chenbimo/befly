/**
 * SQL 构造器 - TypeScript 版本
 * 提供链式 API 构建 SQL 查询
 */

import type { WhereConditions, WhereOperator, OrderDirection, SqlQuery, InsertData, UpdateData, SqlValue } from '../types/common.js';

/**
 * SQL 构建器类
 */
export class SqlBuilder {
    private _select: string[] = [];
    private _from: string = '';
    private _where: string[] = [];
    private _joins: string[] = [];
    private _orderBy: string[] = [];
    private _groupBy: string[] = [];
    private _having: string[] = [];
    private _limit: number | null = null;
    private _offset: number | null = null;
    private _params: SqlValue[] = [];

    /**
     * 重置构建器状态
     */
    reset(): this {
        this._select = [];
        this._from = '';
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
        if (typeof field !== 'string') {
            return field;
        }

        field = field.trim();

        // 如果是 * 或已经有着重号或包含函数，直接返回
        if (field === '*' || field.startsWith('`') || field.includes('(')) {
            return field;
        }

        // 处理别名（AS关键字）
        if (field.toUpperCase().includes(' AS ')) {
            const parts = field.split(/\s+AS\s+/i);
            const fieldPart = parts[0].trim();
            const aliasPart = parts[1].trim();
            return `${this._escapeField(fieldPart)} AS ${aliasPart}`;
        }

        // 处理表名.字段名的情况（多表联查）
        if (field.includes('.')) {
            const parts = field.split('.');
            return parts
                .map((part) => {
                    part = part.trim();
                    if (part === '*' || part.startsWith('`')) {
                        return part;
                    }
                    return `\`${part}\``;
                })
                .join('.');
        }

        // 处理单个字段名
        return `\`${field}\``;
    }

    /**
     * 转义表名
     */
    private _escapeTable(table: string): string {
        if (typeof table !== 'string') {
            return table;
        }

        table = table.trim();

        if (table.startsWith('`')) {
            return table;
        }

        // 处理表别名（表名 + 空格 + 别名）
        if (table.includes(' ')) {
            const parts = table.split(/\s+/);
            if (parts.length === 2) {
                const tableName = parts[0].trim();
                const alias = parts[1].trim();
                return `\`${tableName}\` ${alias}`;
            } else {
                return table;
            }
        }

        return `\`${table}\``;
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
            case '$ne':
            case '$not':
                this._validateParam(value);
                this._where.push(`${escapedField} != ?`);
                this._params.push(value);
                break;

            case '$in':
                if (!Array.isArray(value)) {
                    throw new Error(`$in 操作符的值必须是数组 (operator: ${operator})`);
                }
                if (value.length === 0) {
                    throw new Error(`$in 操作符的数组不能为空。提示：空数组会导致查询永远不匹配任何记录，这通常不是预期行为。请检查查询条件或移除该字段。`);
                }
                const placeholders = value.map(() => '?').join(',');
                this._where.push(`${escapedField} IN (${placeholders})`);
                this._params.push(...value);
                break;

            case '$nin':
            case '$notIn':
                if (!Array.isArray(value)) {
                    throw new Error(`$nin/$notIn 操作符的值必须是数组 (operator: ${operator})`);
                }
                if (value.length === 0) {
                    throw new Error(`$nin/$notIn 操作符的数组不能为空。提示：空数组会导致查询匹配所有记录，这通常不是预期行为。请检查查询条件或移除该字段。`);
                }
                const placeholders2 = value.map(() => '?').join(',');
                this._where.push(`${escapedField} NOT IN (${placeholders2})`);
                this._params.push(...value);
                break;

            case '$like':
                this._validateParam(value);
                this._where.push(`${escapedField} LIKE ?`);
                this._params.push(value);
                break;

            case '$notLike':
                this._validateParam(value);
                this._where.push(`${escapedField} NOT LIKE ?`);
                this._params.push(value);
                break;

            case '$gt':
                this._validateParam(value);
                this._where.push(`${escapedField} > ?`);
                this._params.push(value);
                break;

            case '$gte':
                this._validateParam(value);
                this._where.push(`${escapedField} >= ?`);
                this._params.push(value);
                break;

            case '$lt':
                this._validateParam(value);
                this._where.push(`${escapedField} < ?`);
                this._params.push(value);
                break;

            case '$lte':
                this._validateParam(value);
                this._where.push(`${escapedField} <= ?`);
                this._params.push(value);
                break;

            case '$between':
                if (Array.isArray(value) && value.length === 2) {
                    this._validateParam(value[0]);
                    this._validateParam(value[1]);
                    this._where.push(`${escapedField} BETWEEN ? AND ?`);
                    this._params.push(value[0], value[1]);
                }
                break;

            case '$notBetween':
                if (Array.isArray(value) && value.length === 2) {
                    this._validateParam(value[0]);
                    this._validateParam(value[1]);
                    this._where.push(`${escapedField} NOT BETWEEN ? AND ?`);
                    this._params.push(value[0], value[1]);
                }
                break;

            case '$null':
                if (value === true) {
                    this._where.push(`${escapedField} IS NULL`);
                }
                break;

            case '$notNull':
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
        if (!whereObj || typeof whereObj !== 'object') {
            return;
        }

        Object.entries(whereObj).forEach(([key, value]) => {
            // 跳过undefined值
            if (value === undefined) {
                return;
            }

            if (key === '$and') {
                if (Array.isArray(value)) {
                    value.forEach((condition) => this._processWhereConditions(condition));
                }
            } else if (key === '$or') {
                if (Array.isArray(value)) {
                    const orConditions: string[] = [];
                    const tempParams: SqlValue[] = [];

                    value.forEach((condition) => {
                        const tempBuilder = new SqlBuilder();
                        tempBuilder._processWhereConditions(condition);
                        if (tempBuilder._where.length > 0) {
                            orConditions.push(`(${tempBuilder._where.join(' AND ')})`);
                            tempParams.push(...tempBuilder._params);
                        }
                    });

                    if (orConditions.length > 0) {
                        this._where.push(`(${orConditions.join(' OR ')})`);
                        this._params.push(...tempParams);
                    }
                }
            } else if (key.includes('$')) {
                // 一级属性格式：age$gt, role$in 等
                const lastDollarIndex = key.lastIndexOf('$');
                const fieldName = key.substring(0, lastDollarIndex);
                const operator = ('$' + key.substring(lastDollarIndex + 1)) as WhereOperator;
                this._applyOperator(fieldName, operator, value);
            } else {
                // 检查值是否为对象（嵌套条件）
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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
            sql: this._where.length > 0 ? this._where.join(' AND ') : '',
            params: [...this._params]
        };
    }

    /**
     * SELECT 字段
     */
    select(fields: string | string[] = '*'): this {
        if (Array.isArray(fields)) {
            this._select = [...this._select, ...fields.map((field) => this._escapeField(field))];
        } else if (typeof fields === 'string') {
            this._select.push(this._escapeField(fields));
        } else {
            throw new Error('SELECT 字段必须是字符串或数组');
        }
        return this;
    }

    /**
     * FROM 表名
     */
    from(table: string): this {
        if (typeof table !== 'string' || !table.trim()) {
            throw new Error(`FROM 表名必须是非空字符串 (table: ${table})`);
        }
        this._from = this._escapeTable(table.trim());
        return this;
    }

    /**
     * WHERE 条件
     */
    where(condition: WhereConditions | string, value?: SqlValue): this {
        if (typeof condition === 'object' && condition !== null) {
            this._processWhereConditions(condition);
        } else if (value !== undefined && value !== null) {
            this._validateParam(value);
            const escapedCondition = this._escapeField(condition as string);
            this._where.push(`${escapedCondition} = ?`);
            this._params.push(value);
        } else if (typeof condition === 'string') {
            this._where.push(condition);
        }
        return this;
    }

    /**
     * LEFT JOIN
     */
    leftJoin(table: string, on: string): this {
        if (typeof table !== 'string' || typeof on !== 'string') {
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
        if (typeof table !== 'string' || typeof on !== 'string') {
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
        if (typeof table !== 'string' || typeof on !== 'string') {
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
            if (typeof item !== 'string' || !item.includes('#')) {
                throw new Error(`orderBy 字段必须是 "字段#方向" 格式的字符串（例如："name#ASC", "id#DESC"） (item: ${item})`);
            }

            const [fieldName, direction] = item.split('#');
            const cleanField = fieldName.trim();
            const cleanDir = direction.trim().toUpperCase() as OrderDirection;

            if (!cleanField) {
                throw new Error(`orderBy 中字段名不能为空 (item: ${item})`);
            }

            if (!['ASC', 'DESC'].includes(cleanDir)) {
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
            const escapedFields = field.filter((f) => typeof f === 'string').map((f) => this._escapeField(f));
            this._groupBy = [...this._groupBy, ...escapedFields];
        } else if (typeof field === 'string') {
            this._groupBy.push(this._escapeField(field));
        }
        return this;
    }

    /**
     * HAVING
     */
    having(condition: string): this {
        if (typeof condition === 'string') {
            this._having.push(condition);
        }
        return this;
    }

    /**
     * LIMIT
     */
    limit(count: number, offset?: number): this {
        if (typeof count !== 'number' || count < 0) {
            throw new Error(`LIMIT 数量必须是非负数 (count: ${count})`);
        }
        this._limit = Math.floor(count);
        if (offset !== undefined && offset !== null) {
            if (typeof offset !== 'number' || offset < 0) {
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
        if (typeof count !== 'number' || count < 0) {
            throw new Error(`OFFSET 必须是非负数 (count: ${count})`);
        }
        this._offset = Math.floor(count);
        return this;
    }

    /**
     * 构建 SELECT 查询
     */
    toSelectSql(): SqlQuery {
        let sql = 'SELECT ';

        sql += this._select.length > 0 ? this._select.join(', ') : '*';

        if (!this._from) {
            throw new Error('FROM 表名是必需的');
        }
        sql += ` FROM ${this._from}`;

        if (this._joins.length > 0) {
            sql += ' ' + this._joins.join(' ');
        }

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        }

        if (this._groupBy.length > 0) {
            sql += ' GROUP BY ' + this._groupBy.join(', ');
        }

        if (this._having.length > 0) {
            sql += ' HAVING ' + this._having.join(' AND ');
        }

        if (this._orderBy.length > 0) {
            sql += ' ORDER BY ' + this._orderBy.join(', ');
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
        if (!table || typeof table !== 'string') {
            throw new Error(`INSERT 需要表名 (table: ${table})`);
        }

        if (!data || typeof data !== 'object') {
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

            const escapedFields = fields.map((field) => this._escapeField(field));
            const placeholders = fields.map(() => '?').join(', ');
            const values = data.map(() => `(${placeholders})`).join(', ');

            const sql = `INSERT INTO ${escapedTable} (${escapedFields.join(', ')}) VALUES ${values}`;
            const params = data.flatMap((row) => fields.map((field) => row[field]));

            return { sql, params };
        } else {
            const fields = Object.keys(data);
            if (fields.length === 0) {
                throw new Error(`插入数据必须至少有一个字段 (table: ${table})`);
            }

            const escapedFields = fields.map((field) => this._escapeField(field));
            const placeholders = fields.map(() => '?').join(', ');
            const sql = `INSERT INTO ${escapedTable} (${escapedFields.join(', ')}) VALUES (${placeholders})`;
            const params = fields.map((field) => data[field]);

            return { sql, params };
        }
    }

    /**
     * 构建 UPDATE 查询
     */
    toUpdateSql(table: string, data: UpdateData): SqlQuery {
        if (!table || typeof table !== 'string') {
            throw new Error('UPDATE 需要表名');
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('UPDATE 需要数据对象');
        }

        const fields = Object.keys(data);
        if (fields.length === 0) {
            throw new Error('更新数据必须至少有一个字段');
        }

        const escapedTable = this._escapeTable(table);
        const setFields = fields.map((field) => `${this._escapeField(field)} = ?`);
        const params: SqlValue[] = [...Object.values(data), ...this._params];

        let sql = `UPDATE ${escapedTable} SET ${setFields.join(', ')}`;

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        } else {
            throw new Error('为安全起见，UPDATE 需要 WHERE 条件');
        }

        return { sql, params };
    }

    /**
     * 构建 DELETE 查询
     */
    toDeleteSql(table: string): SqlQuery {
        if (!table || typeof table !== 'string') {
            throw new Error('DELETE 需要表名');
        }

        const escapedTable = this._escapeTable(table);
        let sql = `DELETE FROM ${escapedTable}`;

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        } else {
            throw new Error('为安全起见，DELETE 需要 WHERE 条件');
        }

        return { sql, params: [...this._params] };
    }

    /**
     * 构建 COUNT 查询
     */
    toCountSql(): SqlQuery {
        let sql = 'SELECT COUNT(*) as total';

        if (!this._from) {
            throw new Error('COUNT 需要 FROM 表名');
        }
        sql += ` FROM ${this._from}`;

        if (this._joins.length > 0) {
            sql += ' ' + this._joins.join(' ');
        }

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        }

        return { sql, params: [...this._params] };
    }
}

/**
 * 创建新的 SQL 构建器实例
 */
export function createQueryBuilder(): SqlBuilder {
    return new SqlBuilder();
}
