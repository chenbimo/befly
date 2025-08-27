/**
 * SQL 构造器 - 生产级稳定版本
 */
export class SqlBuilder {
    constructor() {
        this.reset();
    }

    reset() {
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

    // 字段转义方法 - 处理字段名和表名的着重号转义
    _escapeField(field) {
        if (typeof field !== 'string') {
            return field;
        }

        // 去除前后空格
        field = field.trim();

        // 如果是 * 或已经有着重号，直接返回
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
                    // 如果是 * 或已经有着重号，不再处理
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

    // 转义表名
    _escapeTable(table) {
        if (typeof table !== 'string') {
            return table;
        }

        table = table.trim();

        // 如果已经有着重号，直接返回
        if (table.startsWith('`')) {
            return table;
        }

        // 处理表别名（表名 + 空格 + 别名）
        if (table.includes(' ')) {
            const parts = table.split(/\s+/);
            if (parts.length === 2) {
                // 只有表名和别名的情况
                const tableName = parts[0].trim();
                const alias = parts[1].trim();
                return `\`${tableName}\` ${alias}`;
            } else {
                // 复杂情况，直接返回
                return table;
            }
        }

        return `\`${table}\``;
    }

    select(fields = '*') {
        if (Array.isArray(fields)) {
            this._select = [...this._select, ...fields.map((field) => this._escapeField(field))];
        } else if (typeof fields === 'string') {
            this._select.push(this._escapeField(fields));
        } else {
            throw new Error('SELECT fields must be string or array');
        }
        return this;
    }

    from(table) {
        if (typeof table !== 'string' || !table.trim()) {
            throw new Error('FROM table must be a non-empty string');
        }
        this._from = this._escapeTable(table.trim());
        return this;
    }

    // 安全的参数验证
    _validateParam(value) {
        if (value === undefined) {
            throw new Error('Parameter value cannot be undefined');
        }
        return value;
    }

    // 处理复杂的 where 条件对象
    _processWhereConditions(whereObj) {
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
                    const orConditions = [];
                    const tempParams = [];

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
                const escapedFieldName = this._escapeField(fieldName);
                const operator = '$' + key.substring(lastDollarIndex + 1);

                this._validateParam(value);

                switch (operator) {
                    case '$ne':
                    case '$not':
                        this._where.push(`${escapedFieldName} != ?`);
                        this._params.push(value);
                        break;
                    case '$in':
                        if (Array.isArray(value) && value.length > 0) {
                            const placeholders = value.map(() => '?').join(',');
                            this._where.push(`${escapedFieldName} IN (${placeholders})`);
                            this._params.push(...value);
                        }
                        break;
                    case '$nin':
                    case '$notIn':
                        if (Array.isArray(value) && value.length > 0) {
                            const placeholders = value.map(() => '?').join(',');
                            this._where.push(`${escapedFieldName} NOT IN (${placeholders})`);
                            this._params.push(...value);
                        }
                        break;
                    case '$like':
                        this._where.push(`${escapedFieldName} LIKE ?`);
                        this._params.push(value);
                        break;
                    case '$notLike':
                        this._where.push(`${escapedFieldName} NOT LIKE ?`);
                        this._params.push(value);
                        break;
                    case '$gt':
                        this._where.push(`${escapedFieldName} > ?`);
                        this._params.push(value);
                        break;
                    case '$gte':
                        this._where.push(`${escapedFieldName} >= ?`);
                        this._params.push(value);
                        break;
                    case '$lt':
                        this._where.push(`${escapedFieldName} < ?`);
                        this._params.push(value);
                        break;
                    case '$lte':
                        this._where.push(`${escapedFieldName} <= ?`);
                        this._params.push(value);
                        break;
                    case '$between':
                        if (Array.isArray(value) && value.length === 2) {
                            this._where.push(`${escapedFieldName} BETWEEN ? AND ?`);
                            this._params.push(value[0], value[1]);
                        }
                        break;
                    case '$notBetween':
                        if (Array.isArray(value) && value.length === 2) {
                            this._where.push(`${escapedFieldName} NOT BETWEEN ? AND ?`);
                            this._params.push(value[0], value[1]);
                        }
                        break;
                    case '$null':
                        if (value === true) {
                            this._where.push(`${escapedFieldName} IS NULL`);
                        }
                        break;
                    case '$notNull':
                        if (value === true) {
                            this._where.push(`${escapedFieldName} IS NOT NULL`);
                        }
                        break;
                    default:
                        this._where.push(`${escapedFieldName} = ?`);
                        this._params.push(value);
                }
            } else {
                // 简单的等于条件
                this._validateParam(value);
                const escapedKey = this._escapeField(key);
                this._where.push(`${escapedKey} = ?`);
                this._params.push(value);
            }
        });
    }

    where(condition, value = null) {
        if (typeof condition === 'object' && condition !== null) {
            // 处理对象形式的where条件，会自动过滤undefined
            this._processWhereConditions(condition);
        } else if (value !== null) {
            this._validateParam(value);
            const escapedCondition = this._escapeField(condition);
            this._where.push(`${escapedCondition} = ?`);
            this._params.push(value);
        } else if (typeof condition === 'string') {
            this._where.push(condition);
        }
        return this;
    }

    leftJoin(table, on) {
        if (typeof table !== 'string' || typeof on !== 'string') {
            throw new Error('JOIN table and condition must be strings');
        }
        const escapedTable = this._escapeTable(table);
        this._joins.push(`LEFT JOIN ${escapedTable} ON ${on}`);
        return this;
    }

    orderBy(fields) {
        if (!Array.isArray(fields)) {
            throw new Error('orderBy must be an array of strings in "field#direction" format');
        }

        fields.forEach((item) => {
            if (typeof item !== 'string' || !item.includes('#')) {
                throw new Error('orderBy field must be a string in "field#direction" format (e.g., "name#ASC", "id#DESC")');
            }

            const [fieldName, direction] = item.split('#');
            const cleanField = fieldName.trim();
            const cleanDir = direction.trim().toUpperCase();

            if (!cleanField) {
                throw new Error('Field name cannot be empty in orderBy');
            }

            if (!['ASC', 'DESC'].includes(cleanDir)) {
                throw new Error('ORDER BY direction must be ASC or DESC');
            }

            const escapedField = this._escapeField(cleanField);
            this._orderBy.push(`${escapedField} ${cleanDir}`);
        });

        return this;
    }

    groupBy(field) {
        if (Array.isArray(field)) {
            const escapedFields = field.filter((f) => typeof f === 'string').map((f) => this._escapeField(f));
            this._groupBy = [...this._groupBy, ...escapedFields];
        } else if (typeof field === 'string') {
            this._groupBy.push(this._escapeField(field));
        }
        return this;
    }

    having(condition) {
        if (typeof condition === 'string') {
            this._having.push(condition);
        }
        return this;
    }

    limit(count, offset = null) {
        if (typeof count !== 'number' || count < 0) {
            throw new Error('LIMIT count must be a non-negative number');
        }
        this._limit = Math.floor(count);
        if (offset !== null) {
            if (typeof offset !== 'number' || offset < 0) {
                throw new Error('OFFSET must be a non-negative number');
            }
            this._offset = Math.floor(offset);
        }
        return this;
    }

    offset(count) {
        if (typeof count !== 'number' || count < 0) {
            throw new Error('OFFSET must be a non-negative number');
        }
        this._offset = Math.floor(count);
        return this;
    }

    // 构建 SELECT 查询
    toSelectSql() {
        let sql = 'SELECT ';

        sql += this._select.length > 0 ? this._select.join(', ') : '*';

        if (!this._from) {
            throw new Error('FROM table is required');
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

    // 构建 INSERT 查询
    toInsertSql(table, data) {
        if (!table || typeof table !== 'string') {
            throw new Error('Table name is required for INSERT');
        }

        if (!data || typeof data !== 'object') {
            throw new Error('Data is required for INSERT');
        }

        const escapedTable = this._escapeTable(table);

        if (Array.isArray(data)) {
            if (data.length === 0) {
                throw new Error('Insert data cannot be empty');
            }

            const fields = Object.keys(data[0]);
            if (fields.length === 0) {
                throw new Error('Insert data must have at least one field');
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
                throw new Error('Insert data must have at least one field');
            }

            const escapedFields = fields.map((field) => this._escapeField(field));
            const placeholders = fields.map(() => '?').join(', ');
            const sql = `INSERT INTO ${escapedTable} (${escapedFields.join(', ')}) VALUES (${placeholders})`;
            const params = fields.map((field) => data[field]);

            return { sql, params };
        }
    }

    // 构建 UPDATE 查询
    toUpdateSql(table, data) {
        if (!table || typeof table !== 'string') {
            throw new Error('Table name is required for UPDATE');
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Data object is required for UPDATE');
        }

        const fields = Object.keys(data);
        if (fields.length === 0) {
            throw new Error('Update data must have at least one field');
        }

        const escapedTable = this._escapeTable(table);
        const setFields = fields.map((field) => `${this._escapeField(field)} = ?`);
        const params = [...Object.values(data), ...this._params];

        let sql = `UPDATE ${escapedTable} SET ${setFields.join(', ')}`;

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        } else {
            throw new Error('UPDATE requires WHERE condition for safety');
        }

        return { sql, params };
    }

    // 构建 DELETE 查询
    toDeleteSql(table) {
        if (!table || typeof table !== 'string') {
            throw new Error('Table name is required for DELETE');
        }

        const escapedTable = this._escapeTable(table);
        let sql = `DELETE FROM ${escapedTable}`;

        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ');
        } else {
            throw new Error('DELETE requires WHERE condition for safety');
        }

        return { sql, params: [...this._params] };
    }

    // 构建 COUNT 查询
    toCountSql() {
        let sql = 'SELECT COUNT(*) as total';

        if (!this._from) {
            throw new Error('FROM table is required for COUNT');
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
 * 创建新的 SQL 构造器实例
 */
export function createQueryBuilder() {
    return new SqlBuilder();
}
