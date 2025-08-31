/**
 * 数据库表结构同步脚本 - 支持 sqlite / mysql / postgresql
 * 注意：MySQL 提供更完整的在线 ALTER 能力；SQLite/PG 的修改能力有差异，部分操作将跳过或分解。
 */

import path from 'node:path';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { parseFieldRule, createSqlClient, toSnakeTableName } from '../utils/index.js';
import { __dirtables, getProjectDir } from '../system.js';
import { checkTable } from '../checks/table.js';

// 方言与类型映射
const DB = (Env.DB_TYPE || 'mysql').toLowerCase();
const IS_MYSQL = DB === 'mysql';
const IS_PG = DB === 'postgresql' || DB === 'postgres';
const IS_SQLITE = DB === 'sqlite';

// 统一标识符与字面量转义
const qi = (name) => (IS_MYSQL ? `\`${name}\`` : `"${name}"`);
const ql = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
};

// 字段类型映射（按方言）
const typeMapping = {
    number: IS_SQLITE ? 'INTEGER' : 'BIGINT',
    string: IS_SQLITE ? 'TEXT' : 'VARCHAR',
    text: IS_MYSQL ? 'MEDIUMTEXT' : 'TEXT',
    array: IS_SQLITE ? 'TEXT' : 'VARCHAR'
};

// 表名转换函数已移动至 utils/index.js 的 toSnakeTableName

// 环境开关读取（支持未在 Env 显式声明的变量，默认值兜底）
const getFlag = (val, def = 0) => {
    if (val === undefined || val === null || val === '') return !!def;
    const n = Number(val);
    if (!Number.isNaN(n)) return n !== 0;
    const s = String(val).toLowerCase();
    return s === 'true' || s === 'on' || s === 'yes';
};

// 命令行参数
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const CLI = {
    DRY_RUN: ARGV.includes('--dry-run')
};

const FLAGS = {
    // DRY-RUN 改为命令行参数控制，忽略环境变量
    DRY_RUN: CLI.DRY_RUN, // 仅打印计划，不执行
    MERGE_ALTER: getFlag(Env.SYNC_MERGE_ALTER, 1), // 合并每表多项 DDL
    ONLINE_INDEX: getFlag(Env.SYNC_ONLINE_INDEX, 1), // 索引操作使用在线算法
    DISALLOW_SHRINK: getFlag(Env.SYNC_DISALLOW_SHRINK, 1), // 禁止长度收缩
    ALLOW_TYPE_CHANGE: getFlag(Env.SYNC_ALLOW_TYPE_CHANGE, 0), // 允许类型变更
    SQLITE_REBUILD: getFlag(Env.SYNC_SQLITE_REBUILD, 0), // SQLite 遇到不支持的修改时是否重建表
    PG_SAFE_ADD_DEFAULT: getFlag(Env.SYNC_PG_SAFE_ADD_DEFAULT, 1), // PG: 新增列含默认值时走安全多步以避免重写
    PG_ALLOW_COMPATIBLE_TYPE: getFlag(Env.SYNC_PG_ALLOW_COMPATIBLE_TYPE, 1) // PG: 允许兼容类型变更（varchar->text 等）
};

// 计算期望的默认值（与 information_schema 返回的值对齐）
// 规则：当默认值为 'null' 时按类型提供默认值：number→0，string→""，array→"[]"；text 永不设置默认值
const getExpectedDefault = (fieldType, fieldDefaultValue) => {
    if (fieldType === 'text') return null; // TEXT 不设置默认
    if (fieldDefaultValue !== undefined && fieldDefaultValue !== null && fieldDefaultValue !== 'null') {
        return fieldDefaultValue; // 保留显式默认值（数字或字符串，包含空字符串）
    }
    // 规则为 'null' 时的内置默认
    switch (fieldType) {
        case 'number':
            return 0;
        case 'string':
            return '';
        case 'array':
            return '[]';
        default:
            return null;
    }
};

const normalizeDefault = (val) => (val === null || val === undefined ? null : String(val));

// PG 兼容类型变更识别：无需数据重写的宽化型变更
const isPgCompatibleTypeChange = (currentType, newType) => {
    const c = String(currentType || '').toLowerCase();
    const n = String(newType || '').toLowerCase();
    // varchar -> text 视为宽化
    if (c === 'character varying' && n === 'text') return true;
    // text -> character varying 非宽化（可能截断），不兼容
    return false;
};

// 获取字段的SQL定义
const getColumnDefinition = (fieldName, rule) => {
    const [fieldDisplayName, fieldType, fieldMin, fieldMaxLength, fieldDefaultValue, fieldHasIndex] = parseFieldRule(rule);

    let sqlType = typeMapping[fieldType];
    if (!sqlType) throw new Error(`不支持的数据类型: ${fieldType}`);

    // 根据字段类型设置SQL类型和长度
    if (fieldType === 'string' || fieldType === 'array') {
        const maxLength = parseInt(fieldMaxLength);
        sqlType = `VARCHAR(${maxLength})`;
    }

    // 统一强制 NOT NULL
    let columnDef = `\`${fieldName}\` ${sqlType} NOT NULL`;

    // 设置默认值：类型非 text 时总是设置（显式默认或内置默认）
    const expectedDefault = getExpectedDefault(fieldType, fieldDefaultValue);
    if (fieldType !== 'text' && expectedDefault !== null) {
        if (fieldType === 'number') {
            columnDef += ` DEFAULT ${expectedDefault}`;
        } else {
            columnDef += ` DEFAULT \"${String(expectedDefault).replace(/\"/g, '\\"')}\"`;
        }
    }
    // text 类型不设置默认值

    // 添加字段注释（使用第1个属性作为字段显示名称）
    if (fieldDisplayName && fieldDisplayName !== 'null') {
        columnDef += ` COMMENT "${fieldDisplayName.replace(/"/g, '\\"')}"`;
    }

    return columnDef;
};

// 通用执行器：直接使用 Bun SQL 参数化（MySQL 使用 '?' 占位符）
const exec = async (client, query, params = []) => {
    if (params && params.length > 0) {
        return await client.unsafe(query, params);
    }
    return await client.unsafe(query);
};

// 获取表的现有列信息（按方言）
const getTableColumns = async (client, tableName) => {
    const columns = {};
    if (IS_MYSQL) {
        const result = await exec(
            client,
            `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
             FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
            [Env.DB_NAME, tableName]
        );
        result.forEach((row) => {
            columns[row.COLUMN_NAME] = {
                type: row.DATA_TYPE,
                columnType: row.COLUMN_TYPE,
                length: row.CHARACTER_MAXIMUM_LENGTH,
                nullable: row.IS_NULLABLE === 'YES',
                defaultValue: row.COLUMN_DEFAULT,
                comment: row.COLUMN_COMMENT
            };
        });
    } else if (IS_PG) {
        const result = await client`SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = ${tableName}
                        ORDER BY ordinal_position`;
        // 获取列注释
        const comments = await client`SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS column_comment
                          FROM pg_class c
                          JOIN pg_attribute a ON a.attrelid = c.oid
                          JOIN pg_namespace n ON n.oid = c.relnamespace
                          WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname = ${tableName} AND a.attnum > 0`;
        const commentMap = {};
        for (const r of comments) commentMap[r.column_name] = r.column_comment;
        for (const row of result) {
            columns[row.column_name] = {
                type: row.data_type,
                columnType: row.data_type,
                length: row.character_maximum_length,
                nullable: String(row.is_nullable).toUpperCase() === 'YES',
                defaultValue: row.column_default,
                comment: commentMap[row.column_name] ?? null
            };
        }
    } else if (IS_SQLITE) {
        const rs = await client.unsafe(`PRAGMA table_info(${qi(tableName)})`);
        for (const row of rs) {
            let baseType = String(row.type || '').toUpperCase();
            let length = null;
            const m = /^(\w+)\s*\((\d+)\)/.exec(baseType);
            if (m) {
                baseType = m[1];
                length = Number(m[2]);
            }
            columns[row.name] = {
                type: baseType.toLowerCase(),
                columnType: baseType.toLowerCase(),
                length: length,
                nullable: row.notnull === 0,
                defaultValue: row.dflt_value,
                comment: null
            };
        }
    }
    return columns;
};

// 获取表的现有索引信息（单列索引）
const getTableIndexes = async (client, tableName) => {
    const indexes = {};
    if (IS_MYSQL) {
        const result = await exec(
            client,
            `SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME`,
            [Env.DB_NAME, tableName]
        );
        result.forEach((row) => {
            if (!indexes[row.INDEX_NAME]) indexes[row.INDEX_NAME] = [];
            indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
        });
    } else if (IS_PG) {
        const result = await client`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${tableName}`;
        for (const row of result) {
            const m = /\(([^)]+)\)/.exec(row.indexdef);
            if (m) {
                const col = m[1].replace(/\"/g, '').replace(/"/g, '').trim();
                indexes[row.indexname] = [col];
            }
        }
    } else if (IS_SQLITE) {
        const list = await client.unsafe(`PRAGMA index_list(${qi(tableName)})`);
        for (const idx of list) {
            const info = await client.unsafe(`PRAGMA index_info(${qi(idx.name)})`);
            const cols = info.map((r) => r.name);
            if (cols.length === 1) indexes[idx.name] = cols;
        }
    }
    return indexes;
};

// 构建索引操作 SQL（统一使用 ALTER TABLE 并尽量在线）
const buildIndexSQL = (tableName, indexName, fieldName, action) => {
    if (IS_MYSQL) {
        const parts = [];
        if (action === 'create') parts.push(`ADD INDEX ${qi(indexName)} (${qi(fieldName)})`);
        else parts.push(`DROP INDEX ${qi(indexName)}`);
        if (FLAGS.ONLINE_INDEX) {
            parts.push('ALGORITHM=INPLACE');
            parts.push('LOCK=NONE');
        }
        return `ALTER TABLE ${qi(tableName)} ${parts.join(', ')}`;
    }
    if (IS_PG) {
        if (action === 'create') {
            const concurrently = FLAGS.ONLINE_INDEX ? ' CONCURRENTLY' : '';
            return `CREATE INDEX${concurrently} IF NOT EXISTS ${qi(indexName)} ON ${qi(tableName)}(${qi(fieldName)})`;
        }
        const concurrently = FLAGS.ONLINE_INDEX ? ' CONCURRENTLY' : '';
        return `DROP INDEX${concurrently} IF EXISTS ${qi(indexName)}`;
    }
    // SQLite
    if (action === 'create') return `CREATE INDEX IF NOT EXISTS ${qi(indexName)} ON ${qi(tableName)}(${qi(fieldName)})`;
    return `DROP INDEX IF EXISTS ${qi(indexName)}`;
};

// 创建表（方言化）
const createTable = async (client, tableName, fields) => {
    const idType = typeMapping.number;
    const colDefs = [];
    if (IS_MYSQL) {
        colDefs.push(`${qi('id')} ${idType} PRIMARY KEY COMMENT "主键ID"`);
        colDefs.push(`${qi('created_at')} ${idType} NOT NULL DEFAULT 0 COMMENT "创建时间"`);
        colDefs.push(`${qi('updated_at')} ${idType} NOT NULL DEFAULT 0 COMMENT "更新时间"`);
        colDefs.push(`${qi('deleted_at')} ${idType} NOT NULL DEFAULT 0 COMMENT "删除时间"`);
        colDefs.push(`${qi('state')} ${idType} NOT NULL DEFAULT 0 COMMENT "状态字段"`);
    } else {
        colDefs.push(`${qi('id')} ${idType} PRIMARY KEY`);
        colDefs.push(`${qi('created_at')} ${idType} NOT NULL DEFAULT 0`);
        colDefs.push(`${qi('updated_at')} ${idType} NOT NULL DEFAULT 0`);
        colDefs.push(`${qi('deleted_at')} ${idType} NOT NULL DEFAULT 0`);
        colDefs.push(`${qi('state')} ${idType} NOT NULL DEFAULT 0`);
    }

    for (const [fieldName, rule] of Object.entries(fields)) {
        const [disp, fType, , fMax, fDef] = parseFieldRule(rule);
        let sqlType = typeMapping[fType];
        if (!sqlType) throw new Error(`不支持的数据类型: ${fType}`);
        if ((fType === 'string' || fType === 'array') && (IS_MYSQL || IS_PG)) {
            const maxLength = parseInt(fMax);
            sqlType = `${typeMapping[fType]}(${maxLength})`;
        }
        let columnDef = `${qi(fieldName)} ${sqlType} NOT NULL`;
        const expectedDefault = getExpectedDefault(fType, fDef);
        if (fType !== 'text' && expectedDefault !== null) {
            columnDef += ` DEFAULT ${typeof expectedDefault === 'number' ? expectedDefault : ql(String(expectedDefault))}`;
        }
        if (IS_MYSQL && disp && disp !== 'null') {
            columnDef += ` COMMENT "${disp.replace(/"/g, '\\"')}"`;
        }
        colDefs.push(columnDef);
    }

    let createSQL = '';
    if (IS_MYSQL) {
        createSQL = `CREATE TABLE ${qi(tableName)} (\n            ${colDefs.join(',\n            ')}\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`;
    } else {
        createSQL = `CREATE TABLE ${qi(tableName)} (\n            ${colDefs.join(',\n            ')}\n        )`;
    }
    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${createSQL.replace(/\n+/g, ' ')}`);
    else {
        await exec(client, createSQL);
        Logger.info(`[新建表] ${tableName}`);
    }

    // PostgreSQL: 添加列注释（用显示名）
    if (IS_PG) {
        const comments = [];
        const pushComment = (col, disp) => {
            if (disp && disp !== 'null') comments.push(`COMMENT ON COLUMN ${qi(tableName)}.${qi(col)} IS ${ql(String(disp))}`);
        };
        pushComment('id', '主键ID');
        pushComment('created_at', '创建时间');
        pushComment('updated_at', '更新时间');
        pushComment('deleted_at', '删除时间');
        pushComment('state', '状态字段');
        for (const [fieldName, rule] of Object.entries(fields)) {
            const [disp] = parseFieldRule(rule);
            pushComment(fieldName, disp);
        }
        for (const sql of comments) {
            if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
            else await exec(client, sql);
        }
    }

    // 统一创建索引
    // 系统字段默认索引
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const sql = buildIndexSQL(tableName, `idx_${sysField}`, sysField, 'create');
        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
        else await exec(client, sql);
    }

    // 自定义字段索引
    for (const [fieldName, rule] of Object.entries(fields)) {
        const hasIndex = parseFieldRule(rule)[5] === '1';
        if (hasIndex) {
            const sql = buildIndexSQL(tableName, `idx_${fieldName}`, fieldName, 'create');
            if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
            else await exec(client, sql);
        }
    }
};

// 比较字段定义变化
const compareFieldDefinition = (existingColumn, newRule, fieldName) => {
    const ruleParts = parseFieldRule(newRule);
    const [fieldDisplayName, fieldType, fieldMin, fieldMaxLength, fieldDefaultValue] = ruleParts;
    const changes = [];

    // 检查长度变化（string和array类型） - SQLite 不比较长度
    if (!IS_SQLITE && (fieldType === 'string' || fieldType === 'array')) {
        if (fieldMaxLength === 'null') {
            throw new Error(`string/array 类型字段的最大长度未设置，必须指定最大长度`);
        }
        const newMaxLength = parseInt(fieldMaxLength);
        if (existingColumn.length !== newMaxLength) {
            changes.push({ type: 'length', current: existingColumn.length, new: newMaxLength });
        }
    }

    // 检查注释变化（MySQL/PG 支持列注释）
    if ((IS_MYSQL || IS_PG) && fieldDisplayName && fieldDisplayName !== 'null') {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== fieldDisplayName) {
            changes.push({ type: 'comment', current: currentComment, new: fieldDisplayName });
        }
    }

    // 检查数据类型变化（按方言）
    const expectedDbType = IS_MYSQL ? { number: 'bigint', string: 'varchar', text: 'mediumtext', array: 'varchar' }[fieldType] : IS_PG ? { number: 'bigint', string: 'character varying', text: 'text', array: 'character varying' }[fieldType] : { number: 'integer', string: 'text', text: 'text', array: 'text' }[fieldType];

    if (existingColumn.type.toLowerCase() !== expectedDbType) {
        changes.push({ type: 'datatype', current: existingColumn.type, new: expectedDbType });
    }

    // 检查默认值变化（按照生成规则推导期望默认值）
    const expectedDefault = getExpectedDefault(fieldType, fieldDefaultValue);
    const currDef = normalizeDefault(existingColumn.defaultValue);
    const newDef = normalizeDefault(expectedDefault);
    if (currDef !== newDef) {
        changes.push({ type: 'default', current: existingColumn.defaultValue, new: expectedDefault });
    }

    // 检查可空性变化（统一期望 NOT NULL）
    const expectedNullable = false; // 期望 NOT NULL
    if (existingColumn.nullable !== expectedNullable) {
        // existingColumn.nullable 为 true 表示可空
        changes.push({
            type: 'nullability',
            current: existingColumn.nullable ? 'NULL' : 'NOT NULL',
            new: expectedNullable ? 'NULL' : 'NOT NULL'
        });
    }

    return { hasChanges: changes.length > 0, changes };
};

// 生成字段 DDL 子句（不含 ALTER TABLE 前缀）
const generateDDLClause = (fieldName, rule, isAdd = false) => {
    const [disp, fType, , fMax, fDef] = parseFieldRule(rule);
    let sqlType = typeMapping[fType];
    if (!sqlType) throw new Error(`不支持的数据类型: ${fType}`);
    if ((fType === 'string' || fType === 'array') && (IS_MYSQL || IS_PG)) {
        const maxLength = parseInt(fMax);
        sqlType = `${typeMapping[fType]}(${maxLength})`;
    }
    const expectedDefault = getExpectedDefault(fType, fDef);
    const defaultSql = fType !== 'text' && expectedDefault !== null ? ` DEFAULT ${typeof expectedDefault === 'number' ? expectedDefault : ql(String(expectedDefault))}` : '';
    if (IS_MYSQL) {
        let col = `${qi(fieldName)} ${sqlType} NOT NULL${defaultSql}`;
        if (disp && disp !== 'null') col += ` COMMENT "${disp.replace(/"/g, '\\"')}"`;
        return `${isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN'} ${col}`;
    }
    if (IS_PG) {
        if (isAdd) return `ADD COLUMN ${qi(fieldName)} ${sqlType} NOT NULL${defaultSql}`;
        // PG 修改：类型与非空可分条执行，生成 TYPE 改变；非空另由上层统一控制
        return `ALTER COLUMN ${qi(fieldName)} TYPE ${sqlType}`;
    }
    // SQLite 仅支持 ADD COLUMN
    if (isAdd) return `ADD COLUMN ${qi(fieldName)} ${sqlType} NOT NULL${defaultSql}`;
    return '';
};

// 安全执行DDL语句
const executeDDLSafely = async (client, sql) => {
    try {
        await exec(client, sql);
        return true;
    } catch (error) {
        // MySQL 专用降级路径
        if (sql.includes('ALGORITHM=INSTANT')) {
            const inplaceSql = sql.replace(/ALGORITHM=INSTANT/g, 'ALGORITHM=INPLACE');
            try {
                await exec(client, inplaceSql);
                return true;
            } catch (inplaceError) {
                // 最后尝试传统DDL：移除 ALGORITHM/LOCK 附加子句后执行
                const traditionSql = sql
                    .replace(/,\s*ALGORITHM=INPLACE/g, '')
                    .replace(/,\s*ALGORITHM=INSTANT/g, '')
                    .replace(/,\s*LOCK=(NONE|SHARED|EXCLUSIVE)/g, '');
                await exec(client, traditionSql);
                return true;
            }
        } else {
            throw error;
        }
    }
};

// SQLite 重建表迁移（简化版：仅处理新增/修改字段，不处理复杂约束与复合索引）
const rebuildSqliteTable = async (client, tableName, fields) => {
    // 1. 读取现有列顺序
    const info = await client.unsafe(`PRAGMA table_info(${qi(tableName)})`);
    const existingCols = info.map((r) => r.name);
    const targetCols = ['id', 'created_at', 'updated_at', 'deleted_at', 'state', ...Object.keys(fields)];
    const tmpTable = `${tableName}__tmp__${Date.now()}`;

    // 2. 创建新表（使用当前定义）
    await createTable(client, tmpTable, fields);

    // 3. 拷贝数据（按交集列）
    const commonCols = targetCols.filter((c) => existingCols.includes(c));
    if (commonCols.length > 0) {
        const colsSql = commonCols.map((c) => qi(c)).join(', ');
        await exec(client, `INSERT INTO ${qi(tmpTable)} (${colsSql}) SELECT ${colsSql} FROM ${qi(tableName)}`);
    }

    // 4. 删除旧表并重命名
    await exec(client, `DROP TABLE ${qi(tableName)}`);
    await exec(client, `ALTER TABLE ${qi(tmpTable)} RENAME TO ${qi(tableName)}`);
};

// 同步表结构
const syncTable = async (client, tableName, fields) => {
    const existingColumns = await getTableColumns(client, tableName);
    const existingIndexes = await getTableIndexes(client, tableName);
    const systemFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];
    let changed = false;

    const addClauses = [];
    const modifyClauses = [];
    const defaultClauses = [];
    const indexActions = [];
    const pgSafeAdds = [];
    // 变更统计（按字段粒度）
    const changeStats = {
        addFields: 0,
        datatype: 0,
        length: 0,
        default: 0,
        comment: 0,
        nullability: 0,
        indexCreate: 0,
        indexDrop: 0
    };

    // 同步字段
    for (const [fieldName, rule] of Object.entries(fields)) {
        if (existingColumns[fieldName]) {
            const comparison = compareFieldDefinition(existingColumns[fieldName], rule, fieldName);
            if (comparison.hasChanges) {
                // 打印具体变动项并统计
                for (const c of comparison.changes) {
                    const label = { length: '长度', datatype: '类型', comment: '注释', default: '默认值' }[c.type] || c.type;
                    Logger.info(`[字段变更] ${tableName}.${fieldName} ${label}: ${c.current ?? 'NULL'} -> ${c.new ?? 'NULL'}`);
                    if (c.type in changeStats) changeStats[c.type]++;
                }
                // 风险护栏：长度收缩/类型变更
                const ruleParts = parseFieldRule(rule);
                const [, fType, , fMax, fDef] = ruleParts;
                if ((fType === 'string' || fType === 'array') && existingColumns[fieldName].length && fMax !== 'null') {
                    const newLen = parseInt(fMax);
                    if (existingColumns[fieldName].length > newLen && FLAGS.DISALLOW_SHRINK) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${fieldName} 长度收缩 ${existingColumns[fieldName].length} -> ${newLen} 已被跳过（设置 SYNC_DISALLOW_SHRINK=0 可放开）`);
                        // 如果仅有 shrink 一个变化，仍可能还有默认/注释变化要处理
                    }
                }
                const fType2 = parseFieldRule(rule)[1];
                const expectedDbType = IS_MYSQL ? { number: 'bigint', string: 'varchar', text: 'mediumtext', array: 'varchar' }[fType2] : IS_PG ? { number: 'bigint', string: 'character varying', text: 'text', array: 'character varying' }[fType2] : { number: 'integer', string: 'text', text: 'text', array: 'text' }[fType2];
                if (existingColumns[fieldName].type.toLowerCase() !== expectedDbType && !FLAGS.ALLOW_TYPE_CHANGE) {
                    Logger.warn(`[跳过危险变更] ${tableName}.${fieldName} 类型变更 ${existingColumns[fieldName].type} -> ${expectedDbType} 已被跳过（设置 SYNC_ALLOW_TYPE_CHANGE=1 可放开）`);
                    // 继续处理默认值/注释等非类型变更
                }

                // 判断是否“仅默认值变化”
                const onlyDefaultChanged = comparison.changes.every((c) => c.type === 'default');
                if (onlyDefaultChanged) {
                    const expectedDefault = getExpectedDefault(parseFieldRule(rule)[1], parseFieldRule(rule)[4]);
                    if (expectedDefault === null) {
                        defaultClauses.push(`ALTER COLUMN ${qi(fieldName)} DROP DEFAULT`);
                    } else {
                        const v = parseFieldRule(rule)[1] === 'number' ? expectedDefault : ql(String(expectedDefault));
                        defaultClauses.push(`ALTER COLUMN ${qi(fieldName)} SET DEFAULT ${v}`);
                    }
                } else {
                    // 判断是否需要跳过 MODIFY：包含收缩或类型变更时跳过
                    let skipModify = false;
                    const hasLengthChange = comparison.changes.some((c) => c.type === 'length');
                    if (hasLengthChange && (fType === 'string' || fType === 'array') && existingColumns[fieldName].length && fMax !== 'null') {
                        const newLen = parseInt(fMax);
                        const oldLen = existingColumns[fieldName].length;
                        const isShrink = oldLen > newLen;
                        if (isShrink && FLAGS.DISALLOW_SHRINK) {
                            skipModify = true;
                        }
                        // 对 PG 来说，扩列（oldLen < newLen）是安全宽化，允许
                    }
                    const hasTypeChange = comparison.changes.some((c) => c.type === 'datatype');
                    if (hasTypeChange) {
                        if (IS_PG && FLAGS.PG_ALLOW_COMPATIBLE_TYPE && isPgCompatibleTypeChange(existingColumns[fieldName].type, expectedDbType)) {
                            Logger.info(`[PG兼容类型变更] ${tableName}.${fieldName} ${existingColumns[fieldName].type} -> ${expectedDbType} 允许执行`);
                        } else if (!FLAGS.ALLOW_TYPE_CHANGE) {
                            skipModify = true;
                        }
                    }
                    if (!skipModify) {
                        // 合并到 MODIFY/ALTER COLUMN 子句
                        modifyClauses.push(generateDDLClause(fieldName, rule, false));
                    }
                }
                changed = true;
            }
        } else {
            // 新增字段日志
            const [disp, fType, fMin, fMax, fDef, fIdx] = parseFieldRule(rule);
            const lenPart = fType === 'string' || fType === 'array' ? ` 长度:${parseInt(fMax)}` : '';
            const expectedDefault = getExpectedDefault(fType, fDef);
            Logger.info(`[新增字段] ${tableName}.${fieldName} 类型:${fType}${lenPart} 默认:${expectedDefault ?? 'NULL'}`);
            if (IS_PG && FLAGS.PG_SAFE_ADD_DEFAULT) {
                // 生成安全新增列计划（NULL -> UPDATE -> SET DEFAULT? -> SET NOT NULL）
                let sqlType = typeMapping[fType];
                if ((fType === 'string' || fType === 'array') && (IS_MYSQL || IS_PG)) {
                    const maxLength = parseInt(fMax);
                    sqlType = `${typeMapping[fType]}(${maxLength})`;
                }
                const backfill = expectedDefault !== null ? expectedDefault : '';
                pgSafeAdds.push({
                    column: fieldName,
                    sqlType,
                    backfill,
                    setDefault: expectedDefault !== null
                });
            } else {
                addClauses.push(generateDDLClause(fieldName, rule, true));
            }
            changed = true;
            changeStats.addFields++;
        }
    }

    // 同步索引
    // 系统索引：created_at / updated_at / state
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const idxName = `idx_${sysField}`;
        if (!existingIndexes[idxName]) {
            indexActions.push({ action: 'create', indexName: idxName, fieldName: sysField });
            changed = true;
            changeStats.indexCreate++;
        }
    }

    for (const [fieldName, rule] of Object.entries(fields)) {
        const ruleParts = parseFieldRule(rule);
        const fieldHasIndex = ruleParts[5]; // 使用第6个属性判断是否设置索引
        const indexName = `idx_${fieldName}`;

        if (fieldHasIndex === '1' && !existingIndexes[indexName]) {
            indexActions.push({ action: 'create', indexName, fieldName });
            changed = true;
            changeStats.indexCreate++;
        } else if (fieldHasIndex !== '1' && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: 'drop', indexName, fieldName });
            changed = true;
            changeStats.indexDrop++;
        }
    }

    // PG 注释单独处理（MySQL 的 COMMENT 已包含在 MODIFY COLUMN/ADD COLUMN 中）
    const commentActions = [];
    if (IS_PG) {
        for (const [fieldName, rule] of Object.entries(fields)) {
            if (existingColumns[fieldName]) {
                const [disp] = parseFieldRule(rule);
                const curr = existingColumns[fieldName].comment || '';
                const want = disp && disp !== 'null' ? String(disp) : '';
                if (want !== curr) {
                    commentActions.push(`COMMENT ON COLUMN ${qi(tableName)}.${qi(fieldName)} IS ${want ? ql(want) : 'NULL'}`);
                    changed = true;
                    changeStats.comment++;
                }
            }
        }
    }
    return { changed, addClauses, modifyClauses, defaultClauses, indexActions, commentActions, pgSafeAdds, metrics: changeStats };
};

// 主同步函数
const SyncDb = async () => {
    let client = null;

    try {
        Logger.info('开始数据库表结构同步...');

        // 验证表定义文件
        const tableValidationResult = await checkTable();
        if (!tableValidationResult) {
            throw new Error('表定义验证失败');
        }

        // 建立数据库连接并检查版本（按方言）
        client = await createSqlClient({ max: 1 });
        if (IS_MYSQL) {
            const r = await client`SELECT VERSION() AS version`;
            const version = r[0].version;
            if (version.toLowerCase().includes('mariadb')) {
                throw new Error('此脚本仅支持 MySQL 8.0+，不支持 MariaDB');
            }
            const majorVersion = parseInt(version.split('.')[0]);
            if (majorVersion < 8) {
                throw new Error(`此脚本仅支持 MySQL 8.0+，当前版本: ${version}`);
            }
            Logger.info(`MySQL 版本: ${version}`);
        } else if (IS_PG) {
            const r = await client`SELECT version() AS version`;
            Logger.info(`PostgreSQL 版本: ${r[0].version}`);
        } else if (IS_SQLITE) {
            const r = await client`SELECT sqlite_version() AS version`;
            Logger.info(`SQLite 版本: ${r[0].version}`);
        }

        // 扫描并处理表文件
        const tablesGlob = new Bun.Glob('*.json');
        const directories = [__dirtables, getProjectDir('tables')];
        let processedCount = 0;
        let createdTables = 0;
        let modifiedTables = 0;
        // 全局统计
        const overall = {
            addFields: 0,
            typeChanges: 0,
            maxChanges: 0, // 映射为长度变化
            minChanges: 0, // 最小值不参与 DDL，比对保留为0
            defaultChanges: 0,
            nameChanges: 0, // 字段显示名（注释）变更
            indexCreate: 0,
            indexDrop: 0
        };

        for (const dir of directories) {
            try {
                for await (const file of tablesGlob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
                    const fileBaseName = path.basename(file, '.json');
                    const tableName = toSnakeTableName(fileBaseName);
                    const tableDefinition = await Bun.file(file).json();
                    let exists = false;
                    if (IS_MYSQL) {
                        const res = await exec(client, 'SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [Env.DB_NAME, tableName]);
                        exists = res[0].count > 0;
                    } else if (IS_PG) {
                        const res = await client`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
                        exists = (res[0]?.count || 0) > 0;
                    } else if (IS_SQLITE) {
                        const res = await client.unsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name=${ql(tableName)}`);
                        exists = res.length > 0;
                    }

                    if (exists) {
                        const plan = await syncTable(client, tableName, tableDefinition);
                        if (plan.changed) {
                            // 汇总统计
                            if (plan.metrics) {
                                overall.addFields += plan.metrics.addFields;
                                overall.typeChanges += plan.metrics.datatype;
                                overall.maxChanges += plan.metrics.length;
                                overall.defaultChanges += plan.metrics.default;
                                overall.indexCreate += plan.metrics.indexCreate;
                                overall.indexDrop += plan.metrics.indexDrop;
                                overall.nameChanges += plan.metrics.comment;
                            }
                            // 合并执行 ALTER TABLE 子句
                            if (IS_SQLITE) {
                                // SQLite: 仅支持 ADD COLUMN；如需修改/默认值设置，可选择重建表
                                if ((plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) && FLAGS.SQLITE_REBUILD) {
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] 重建表 ${tableName} 以应用列修改/默认值变化`);
                                    else await rebuildSqliteTable(client, tableName, tableDefinition);
                                } else {
                                    for (const c of plan.addClauses) {
                                        const sql = `ALTER TABLE ${qi(tableName)} ${c}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                        else await exec(client, sql);
                                    }
                                }
                            } else if (IS_PG && plan.pgSafeAdds && plan.pgSafeAdds.length > 0) {
                                // PostgreSQL 安全新增列（避免重写）：
                                for (const add of plan.pgSafeAdds) {
                                    // 1) ADD COLUMN NULL 无默认
                                    const addSql = `ALTER TABLE ${qi(tableName)} ADD COLUMN ${qi(add.column)} ${add.sqlType}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${addSql}`);
                                    else await exec(client, addSql);
                                    // 2) 分批回填（这里简单一次性回填；生产可按批次）
                                    if (add.setDefault) {
                                        const updSql = `UPDATE ${qi(tableName)} SET ${qi(add.column)} = ${typeof add.backfill === 'number' ? add.backfill : ql(String(add.backfill))} WHERE ${qi(add.column)} IS NULL`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${updSql}`);
                                        else await exec(client, updSql);
                                        // 3) 设置 DEFAULT
                                        const defSql = `ALTER TABLE ${qi(tableName)} ALTER COLUMN ${qi(add.column)} SET DEFAULT ${typeof add.backfill === 'number' ? add.backfill : ql(String(add.backfill))}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${defSql}`);
                                        else await exec(client, defSql);
                                    }
                                    // 4) 置为 NOT NULL
                                    const notNullSql = `ALTER TABLE ${qi(tableName)} ALTER COLUMN ${qi(add.column)} SET NOT NULL`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${notNullSql}`);
                                    else await exec(client, notNullSql);
                                }
                                // 其他普通 ADD/MODIFY 照常执行
                                if (FLAGS.MERGE_ALTER) {
                                    const clauses = [...plan.addClauses, ...plan.modifyClauses];
                                    if (clauses.length > 0) {
                                        const sql = `ALTER TABLE ${qi(tableName)} ${clauses.join(', ')}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                        else await exec(client, sql);
                                    }
                                } else {
                                    for (const c of plan.addClauses) {
                                        const sql = `ALTER TABLE ${qi(tableName)} ${c}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                        else await exec(client, sql);
                                    }
                                    for (const c of plan.modifyClauses) {
                                        const sql = `ALTER TABLE ${qi(tableName)} ${c}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                        else await exec(client, sql);
                                    }
                                }
                            } else if (FLAGS.MERGE_ALTER) {
                                const clauses = [...plan.addClauses, ...plan.modifyClauses];
                                if (clauses.length > 0) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const sql = `ALTER TABLE ${qi(tableName)} ${clauses.join(', ')}${suffix}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else if (IS_MYSQL) await executeDDLSafely(client, sql);
                                    else await exec(client, sql);
                                }
                            } else {
                                // 分别执行
                                for (const c of plan.addClauses) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const sql = `ALTER TABLE ${qi(tableName)} ${c}${suffix}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else if (IS_MYSQL) await executeDDLSafely(client, sql);
                                    else await exec(client, sql);
                                }
                                for (const c of plan.modifyClauses) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const sql = `ALTER TABLE ${qi(tableName)} ${c}${suffix}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else if (IS_MYSQL) await executeDDLSafely(client, sql);
                                    else await exec(client, sql);
                                }
                            }

                            // 默认值专用 ALTER
                            if (plan.defaultClauses.length > 0) {
                                if (IS_SQLITE) {
                                    Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
                                } else {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const sql = `ALTER TABLE ${qi(tableName)} ${plan.defaultClauses.join(', ')}${suffix}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else if (IS_MYSQL) await executeDDLSafely(client, sql);
                                    else await exec(client, sql);
                                }
                            }

                            // 索引操作
                            for (const act of plan.indexActions) {
                                const sql = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
                                if (FLAGS.DRY_RUN) {
                                    Logger.info(`[计划] ${sql}`);
                                } else {
                                    try {
                                        await exec(client, sql);
                                        if (act.action === 'create') {
                                            Logger.info(`[索引变化] 新建索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                                        } else {
                                            Logger.info(`[索引变化] 删除索引 ${tableName}.${act.indexName} (${act.fieldName})`);
                                        }
                                    } catch (error) {
                                        Logger.error(`${act.action === 'create' ? '创建' : '删除'}索引失败: ${error.message}`);
                                        throw error;
                                    }
                                }
                            }

                            // PG 列注释
                            if (IS_PG && plan.commentActions && plan.commentActions.length > 0) {
                                for (const sql of plan.commentActions) {
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else await exec(client, sql);
                                }
                            }

                            modifiedTables++;
                        }
                    } else {
                        await createTable(client, tableName, tableDefinition);
                        createdTables++;
                        // 新建表已算作变更
                        modifiedTables += 0;
                        // 创建表统计：按需求仅汇总创建表数量
                    }

                    processedCount++;
                }
            } catch (error) {
                Logger.warn(`扫描目录 ${dir} 出错: ${error.message}`);
            }
        }

        // 显示统计信息（扩展维度）
        Logger.info(`统计 - 创建表: ${createdTables}`);
        Logger.info(`统计 - 字段新增: ${overall.addFields}`);
        Logger.info(`统计 - 字段名称变更: ${overall.nameChanges}`);
        Logger.info(`统计 - 字段类型变更: ${overall.typeChanges}`);
        Logger.info(`统计 - 字段最小值变更: ${overall.minChanges}`);
        Logger.info(`统计 - 字段最大值变更: ${overall.maxChanges}`);
        Logger.info(`统计 - 字段默认值变更: ${overall.defaultChanges}`);
        // 索引新增/删除分别打印
        Logger.info(`统计 - 索引新增: ${overall.indexCreate}`);
        Logger.info(`统计 - 索引删除: ${overall.indexDrop}`);

        if (processedCount === 0) {
            Logger.warn('没有找到任何表定义文件');
        }

        // 保持单一职责：此处不再触发开发管理员同步
    } catch (error) {
        Logger.error(`数据库同步失败: ${error.message}`);
        Logger.error(`错误详情: ${error.stack}`);
        if (error.code) {
            Logger.error(`错误代码: ${error.code}`);
        }
        if (error.errno) {
            Logger.error(`错误编号: ${error.errno}`);
        }
        process.exit(1);
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (error) {
                Logger.warn('关闭数据库连接时出错:', error.message);
            }
        }
    }
};

// 如果直接运行此脚本（Bun 支持 import.meta.main）
if (import.meta.main) {
    SyncDb().catch((error) => {
        console.error('❌ 数据库同步失败:', error);
        process.exit(1);
    });
}

export { SyncDb };
