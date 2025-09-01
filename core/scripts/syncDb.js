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

// 顶部管理数据库客户端（按需求使用 Bun SQL 模板，不使用 exec 辅助）
let sql = null;

// 方言与类型映射
const DB = (Env.DB_TYPE || 'mysql').toLowerCase();
const IS_MYSQL = DB === 'mysql';
const IS_PG = DB === 'postgresql' || DB === 'postgres';
const IS_SQLITE = DB === 'sqlite';

// 字面量转义（标识符引号按方言在各分支内直接写死）
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

// （已移除）getColumnDefinition：不再保留未使用的函数，减少函数数量

// 移除 exec 辅助函数，所有 SQL 执行统一使用模板或片段：
// - 有参数：sql`... ${param}`
// - 无参数但动态整条 SQL：sql`${sql(sqlText)}`

// 获取表的现有列信息（按方言）
const getTableColumns = async (tableName) => {
    const columns = {};
    if (IS_MYSQL) {
        const result = await sql`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${Env.DB_NAME} AND TABLE_NAME = ${tableName}
            ORDER BY ORDINAL_POSITION
        `;
        for (const row of result) {
            columns[row.COLUMN_NAME] = {
                type: row.DATA_TYPE,
                columnType: row.COLUMN_TYPE,
                length: row.CHARACTER_MAXIMUM_LENGTH,
                nullable: row.IS_NULLABLE === 'YES',
                defaultValue: row.COLUMN_DEFAULT,
                comment: row.COLUMN_COMMENT
            };
        }
    } else if (IS_PG) {
        const result = await sql`SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = ${tableName}
                        ORDER BY ordinal_position`;
        // 获取列注释
        const comments = await sql`SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS column_comment
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
        const rs = await sql`PRAGMA table_info(${sql(tableName)})`;
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
const getTableIndexes = async (tableName) => {
    const indexes = {};
    if (IS_MYSQL) {
        const result = await sql`
                        SELECT INDEX_NAME, COLUMN_NAME
                        FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA = ${Env.DB_NAME}
                            AND TABLE_NAME = ${tableName}
                            AND INDEX_NAME != 'PRIMARY'
                        ORDER BY INDEX_NAME
                `;
        for (const row of result) {
            if (!indexes[row.INDEX_NAME]) indexes[row.INDEX_NAME] = [];
            indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
        }
    } else if (IS_PG) {
        const result = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${tableName}`;
        for (const row of result) {
            const m = /\(([^)]+)\)/.exec(row.indexdef);
            if (m) {
                const col = m[1].replace(/\"/g, '').replace(/"/g, '').trim();
                indexes[row.indexname] = [col];
            }
        }
    } else if (IS_SQLITE) {
        const list = await sql`PRAGMA index_list(${sql(tableName)})`;
        for (const idx of list) {
            const info = await sql`PRAGMA index_info(${sql(idx.name)})`;
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
        if (action === 'create') parts.push(`ADD INDEX \`${indexName}\` (\`${fieldName}\`)`);
        else parts.push(`DROP INDEX \`${indexName}\``);
        if (FLAGS.ONLINE_INDEX) {
            parts.push('ALGORITHM=INPLACE');
            parts.push('LOCK=NONE');
        }
        return `ALTER TABLE \`${tableName}\` ${parts.join(', ')}`;
    }
    if (IS_PG) {
        if (action === 'create') {
            const concurrently = FLAGS.ONLINE_INDEX ? ' CONCURRENTLY' : '';
            return `CREATE INDEX${concurrently} IF NOT EXISTS "${indexName}" ON "${tableName}"("${fieldName}")`;
        }
        const concurrently = FLAGS.ONLINE_INDEX ? ' CONCURRENTLY' : '';
        return `DROP INDEX${concurrently} IF EXISTS "${indexName}"`;
    }
    // SQLite
    if (action === 'create') return `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}"("${fieldName}")`;
    return `DROP INDEX IF EXISTS "${indexName}"`;
};

// 创建表（方言化）
const createTable = async (tableName, fields) => {
    const colDefs = [];
    if (IS_MYSQL) {
        colDefs.push(`\`id\` BIGINT PRIMARY KEY COMMENT "主键ID"`);
        colDefs.push(`\`created_at\` BIGINT NOT NULL DEFAULT 0 COMMENT "创建时间"`);
        colDefs.push(`\`updated_at\` BIGINT NOT NULL DEFAULT 0 COMMENT "更新时间"`);
        colDefs.push(`\`deleted_at\` BIGINT NOT NULL DEFAULT 0 COMMENT "删除时间"`);
        colDefs.push(`\`state\` BIGINT NOT NULL DEFAULT 0 COMMENT "状态字段"`);
    } else {
        colDefs.push(`"id" INTEGER PRIMARY KEY`);
        colDefs.push(`"created_at" INTEGER NOT NULL DEFAULT 0`);
        colDefs.push(`"updated_at" INTEGER NOT NULL DEFAULT 0`);
        colDefs.push(`"deleted_at" INTEGER NOT NULL DEFAULT 0`);
        colDefs.push(`"state" INTEGER NOT NULL DEFAULT 0`);
    }

    for (const [fieldName, rule] of Object.entries(fields)) {
        const [disp, fType, , fMax, fDef] = parseFieldRule(rule);
        // 类型映射：checkTable 已保证字段类型合法且可映射
        let sqlType = typeMapping[fType];
        if ((fType === 'string' || fType === 'array') && (IS_MYSQL || IS_PG)) {
            const maxLength = parseInt(fMax);
            sqlType = `${typeMapping[fType]}(${maxLength})`;
        }
        const expectedDefault = getExpectedDefault(fType, fDef);
        if (IS_MYSQL) {
            let columnDef = `\`${fieldName}\` ${sqlType} NOT NULL`;
            if (fType !== 'text' && expectedDefault !== null) {
                columnDef += ` DEFAULT ${typeof expectedDefault === 'number' ? expectedDefault : ql(String(expectedDefault))}`;
            }
            if (disp && disp !== 'null') {
                columnDef += ` COMMENT "${disp.replace(/"/g, '\\"')}"`;
            }
            colDefs.push(columnDef);
        } else {
            let columnDef = `"${fieldName}" ${sqlType} NOT NULL`;
            if (fType !== 'text' && expectedDefault !== null) {
                columnDef += ` DEFAULT ${typeof expectedDefault === 'number' ? expectedDefault : ql(String(expectedDefault))}`;
            }
            // 非 MySQL 不在此处添加注释（PG 后续单独 COMMENT，SQLite 不支持列注释）
            colDefs.push(columnDef);
        }
    }

    let createSQL = '';
    if (IS_MYSQL) {
        createSQL = `CREATE TABLE \`${tableName}\` (\n            ${colDefs.join(',\n            ')}\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`;
    } else {
        createSQL = `CREATE TABLE "${tableName}" (\n            ${colDefs.join(',\n            ')}\n        )`;
    }
    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${createSQL.replace(/\n+/g, ' ')}`);
    else {
        await sql`${sql(createSQL)}`;
        Logger.info(`[新建表] ${tableName}`);
    }

    // PostgreSQL: 添加列注释（用显示名）
    if (IS_PG) {
        const comments = [];
        comments.push(`COMMENT ON COLUMN "${tableName}"."id" IS ${ql('主键ID')}`);
        comments.push(`COMMENT ON COLUMN "${tableName}"."created_at" IS ${ql('创建时间')}`);
        comments.push(`COMMENT ON COLUMN "${tableName}"."updated_at" IS ${ql('更新时间')}`);
        comments.push(`COMMENT ON COLUMN "${tableName}"."deleted_at" IS ${ql('删除时间')}`);
        comments.push(`COMMENT ON COLUMN "${tableName}"."state" IS ${ql('状态字段')}`);
        for (const [fieldName, rule] of Object.entries(fields)) {
            const [disp] = parseFieldRule(rule);
            if (disp && disp !== 'null') {
                comments.push(`COMMENT ON COLUMN "${tableName}"."${fieldName}" IS ${ql(String(disp))}`);
            }
        }
        for (const stmt of comments) {
            if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
            else await sql`${sql(stmt)}`;
        }
    }

    // 统一创建索引
    // 系统字段默认索引
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const stmt = buildIndexSQL(tableName, `idx_${sysField}`, sysField, 'create');
        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
        else await sql`${sql(stmt)}`;
    }

    // 自定义字段索引
    for (const [fieldName, rule] of Object.entries(fields)) {
        const hasIndex = parseFieldRule(rule)[5] === '1';
        if (hasIndex) {
            const stmt = buildIndexSQL(tableName, `idx_${fieldName}`, fieldName, 'create');
            if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
            else await sql`${sql(stmt)}`;
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
    // 类型映射：checkTable 已保证字段类型合法且可映射
    let sqlType = typeMapping[fType];
    if ((fType === 'string' || fType === 'array') && (IS_MYSQL || IS_PG)) {
        const maxLength = parseInt(fMax);
        sqlType = `${typeMapping[fType]}(${maxLength})`;
    }
    const expectedDefault = getExpectedDefault(fType, fDef);
    const defaultSql = fType !== 'text' && expectedDefault !== null ? ` DEFAULT ${typeof expectedDefault === 'number' ? expectedDefault : ql(String(expectedDefault))}` : '';
    if (IS_MYSQL) {
        let col = `\`${fieldName}\` ${sqlType} NOT NULL${defaultSql}`;
        if (disp && disp !== 'null') col += ` COMMENT "${disp.replace(/"/g, '\\"')}"`;
        return `${isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN'} ${col}`;
    }
    if (IS_PG) {
        if (isAdd) return `ADD COLUMN IF NOT EXISTS "${fieldName}" ${sqlType} NOT NULL${defaultSql}`;
        // PG 修改：类型与非空可分条执行，生成 TYPE 改变；非空另由上层统一控制
        return `ALTER COLUMN "${fieldName}" TYPE ${sqlType}`;
    }
    // SQLite 仅支持 ADD COLUMN（>=3.50.0：支持 IF NOT EXISTS）
    if (isAdd) return `ADD COLUMN IF NOT EXISTS "${fieldName}" ${sqlType} NOT NULL${defaultSql}`;
    return '';
};

// 安全执行DDL语句
const executeDDLSafely = async (stmt) => {
    try {
        await sql`${sql(stmt)}`;
        return true;
    } catch (error) {
        // MySQL 专用降级路径
        if (stmt.includes('ALGORITHM=INSTANT')) {
            const inplaceSql = stmt.replace(/ALGORITHM=INSTANT/g, 'ALGORITHM=INPLACE');
            try {
                await sql`${sql(inplaceSql)}`;
                return true;
            } catch (inplaceError) {
                // 最后尝试传统DDL：移除 ALGORITHM/LOCK 附加子句后执行
                const traditionSql = stmt
                    .replace(/,\s*ALGORITHM=INPLACE/g, '')
                    .replace(/,\s*ALGORITHM=INSTANT/g, '')
                    .replace(/,\s*LOCK=(NONE|SHARED|EXCLUSIVE)/g, '');
                await sql`${sql(traditionSql)}`;
                return true;
            }
        } else {
            throw error;
        }
    }
};

// SQLite 重建表迁移（简化版：仅处理新增/修改字段，不处理复杂约束与复合索引）
const rebuildSqliteTable = async (tableName, fields) => {
    // 1. 读取现有列顺序
    const info = await sql`PRAGMA table_info(${sql(tableName)})`;
    const existingCols = info.map((r) => r.name);
    const targetCols = ['id', 'created_at', 'updated_at', 'deleted_at', 'state', ...Object.keys(fields)];
    const tmpTable = `${tableName}__tmp__${Date.now()}`;

    // 2. 创建新表（使用当前定义）
    await createTable(tmpTable, fields);

    // 3. 拷贝数据（按交集列）
    const commonCols = targetCols.filter((c) => existingCols.includes(c));
    if (commonCols.length > 0) {
        const colsSql = commonCols.map((c) => `"${c}"`).join(', ');
        await sql`${sql(`INSERT INTO "${tmpTable}" (${colsSql}) SELECT ${colsSql} FROM "${tableName}"`)}`;
    }

    // 4. 删除旧表并重命名
    await sql`${sql(`DROP TABLE "${tableName}"`)}`;
    await sql`${sql(`ALTER TABLE "${tmpTable}" RENAME TO "${tableName}"`)}`;
};

// 同步表结构
const syncTable = async (tableName, fields) => {
    const existingColumns = await getTableColumns(tableName);
    const existingIndexes = await getTableIndexes(tableName);
    let changed = false;

    const addClauses = [];
    const modifyClauses = [];
    const defaultClauses = [];
    const indexActions = [];
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

    for (const [fieldName, rule] of Object.entries(fields)) {
        if (existingColumns[fieldName]) {
            const comparison = compareFieldDefinition(existingColumns[fieldName], rule, fieldName);
            if (comparison.hasChanges) {
                for (const c of comparison.changes) {
                    const label = { length: '长度', datatype: '类型', comment: '注释', default: '默认值' }[c.type] || c.type;
                    Logger.info(`[字段变更] ${tableName}.${fieldName} ${label}: ${c.current ?? 'NULL'} -> ${c.new ?? 'NULL'}`);
                    if (c.type in changeStats) changeStats[c.type]++;
                }
                const [, fType, , fMax] = parseFieldRule(rule);
                if ((fType === 'string' || fType === 'array') && existingColumns[fieldName].length && fMax !== 'null') {
                    const newLen = parseInt(fMax);
                    if (existingColumns[fieldName].length > newLen && FLAGS.DISALLOW_SHRINK) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${fieldName} 长度收缩 ${existingColumns[fieldName].length} -> ${newLen} 已被跳过（设置 SYNC_DISALLOW_SHRINK=0 可放开）`);
                    }
                }
                const fType2 = parseFieldRule(rule)[1];
                const expectedDbType = IS_MYSQL ? { number: 'bigint', string: 'varchar', text: 'mediumtext', array: 'varchar' }[fType2] : IS_PG ? { number: 'bigint', string: 'character varying', text: 'text', array: 'character varying' }[fType2] : { number: 'integer', string: 'text', text: 'text', array: 'text' }[fType2];
                const hasTypeChange = comparison.changes.some((c) => c.type === 'datatype');
                const hasLengthChange = comparison.changes.some((c) => c.type === 'length');
                const onlyDefaultChanged = comparison.changes.every((c) => c.type === 'default');

                if (onlyDefaultChanged) {
                    const expectedDefault = getExpectedDefault(parseFieldRule(rule)[1], parseFieldRule(rule)[4]);
                    if (expectedDefault === null) {
                        defaultClauses.push(IS_MYSQL ? `ALTER COLUMN \`${fieldName}\` DROP DEFAULT` : `ALTER COLUMN "${fieldName}" DROP DEFAULT`);
                    } else {
                        const v = parseFieldRule(rule)[1] === 'number' ? expectedDefault : ql(String(expectedDefault));
                        defaultClauses.push(IS_MYSQL ? `ALTER COLUMN \`${fieldName}\` SET DEFAULT ${v}` : `ALTER COLUMN "${fieldName}" SET DEFAULT ${v}`);
                    }
                } else {
                    let skipModify = false;
                    if (hasLengthChange && (fType2 === 'string' || fType2 === 'array') && existingColumns[fieldName].length && parseInt(parseFieldRule(rule)[3]) !== NaN) {
                        const newLen = parseInt(parseFieldRule(rule)[3]);
                        const oldLen = existingColumns[fieldName].length;
                        const isShrink = oldLen > newLen;
                        if (isShrink && FLAGS.DISALLOW_SHRINK) skipModify = true;
                    }
                    if (hasTypeChange) {
                        if (IS_PG && FLAGS.PG_ALLOW_COMPATIBLE_TYPE && isPgCompatibleTypeChange(existingColumns[fieldName].type, expectedDbType)) {
                            Logger.info(`[PG兼容类型变更] ${tableName}.${fieldName} ${existingColumns[fieldName].type} -> ${expectedDbType} 允许执行`);
                        } else if (!FLAGS.ALLOW_TYPE_CHANGE) {
                            skipModify = true;
                        }
                    }
                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldName, rule, false));
                }
                changed = true;
            }
        } else {
            const [disp, fType, , fMax, fDef] = parseFieldRule(rule);
            const lenPart = fType === 'string' || fType === 'array' ? ` 长度:${parseInt(fMax)}` : '';
            const expectedDefault = getExpectedDefault(fType, fDef);
            Logger.info(`[新增字段] ${tableName}.${fieldName} 类型:${fType}${lenPart} 默认:${expectedDefault ?? 'NULL'}`);
            addClauses.push(generateDDLClause(fieldName, rule, true));
            changed = true;
            changeStats.addFields++;
        }
    }

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
        const fieldHasIndex = ruleParts[5];
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

    const commentActions = [];
    if (IS_PG) {
        for (const [fieldName, rule] of Object.entries(fields)) {
            if (existingColumns[fieldName]) {
                const [disp] = parseFieldRule(rule);
                const curr = existingColumns[fieldName].comment || '';
                const want = disp && disp !== 'null' ? String(disp) : '';
                if (want !== curr) {
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${fieldName}" IS ${want ? ql(want) : 'NULL'}`);
                    changed = true;
                    changeStats.comment++;
                }
            }
        }
    }
    return { changed, addClauses, modifyClauses, defaultClauses, indexActions, commentActions, metrics: changeStats };
};

// 主同步函数
const SyncDb = async () => {
    try {
        Logger.info('开始数据库表结构同步...');

        // 验证表定义文件
        if (!(await checkTable())) {
            throw new Error('表定义验证失败');
        }

        // 建立数据库连接并检查版本（按方言）
        // 在顶层也保留 sql 引用，便于未来需要跨函数访问
        sql = await createSqlClient({ max: 1 });
        if (IS_MYSQL) {
            const r = await sql`SELECT VERSION() AS version`;
            const version = r[0].version;
            const majorVersion = parseInt(version.split('.')[0]);
            if (majorVersion < 8) {
                throw new Error(`此脚本仅支持 MySQL 8.0+，当前版本: ${version}`);
            }
            Logger.info(`MySQL 版本: ${version}`);
        } else if (IS_PG) {
            const r = await sql`SELECT version() AS version`;
            const versionText = r[0].version;
            Logger.info(`PostgreSQL 版本: ${versionText}`);
            // 提取主版本号（假设格式如 'PostgreSQL 17.1 ...'）
            const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
            const major = m ? parseInt(m[1], 10) : NaN;
            if (!Number.isFinite(major) || major < 17) {
                throw new Error(`此脚本要求 PostgreSQL >= 17，当前: ${versionText}`);
            }
        } else if (IS_SQLITE) {
            const r = await sql`SELECT sqlite_version() AS version`;
            const version = r[0].version;
            Logger.info(`SQLite 版本: ${version}`);
            // 强制最低版本：SQLite ≥ 3.50.0
            const [maj, min, patch] = String(version)
                .split('.')
                .map((v) => parseInt(v, 10) || 0);
            const vnum = maj * 10000 + min * 100 + patch; // 3.50.0 -> 35000
            if (!Number.isFinite(vnum) || vnum < 35000) {
                throw new Error(`此脚本要求 SQLite >= 3.50.0，当前: ${version}`);
            }
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
                    let existsTable = false;
                    if (IS_MYSQL) {
                        const res = await sql`SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${Env.DB_NAME} AND TABLE_NAME = ${tableName}`;
                        existsTable = res[0]?.count > 0;
                    } else if (IS_PG) {
                        const res = await sql`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
                        existsTable = (res[0]?.count || 0) > 0;
                    } else if (IS_SQLITE) {
                        const res = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name = ${tableName}`;
                        existsTable = res.length > 0;
                    }

                    if (existsTable) {
                        const plan = await syncTable(tableName, tableDefinition);
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
                                    else await rebuildSqliteTable(tableName, tableDefinition);
                                } else {
                                    for (const c of plan.addClauses) {
                                        const stmt = `ALTER TABLE "${tableName}" ${c}`;
                                        if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                        else await sql`${sql(stmt)}`;
                                    }
                                }
                            } else if (FLAGS.MERGE_ALTER) {
                                const clauses = [...plan.addClauses, ...plan.modifyClauses];
                                if (clauses.length > 0) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${clauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${clauses.join(', ')}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                    else if (IS_MYSQL) await executeDDLSafely(stmt);
                                    else await sql`${sql(stmt)}`;
                                }
                            } else {
                                // 分别执行
                                for (const c of plan.addClauses) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${c}${suffix}` : `ALTER TABLE "${tableName}" ${c}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                    else if (IS_MYSQL) await executeDDLSafely(stmt);
                                    else await sql`${sql(stmt)}`;
                                }
                                for (const c of plan.modifyClauses) {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${c}${suffix}` : `ALTER TABLE "${tableName}" ${c}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                    else if (IS_MYSQL) await executeDDLSafely(stmt);
                                    else await sql`${sql(stmt)}`;
                                }
                            }

                            // 默认值专用 ALTER
                            if (plan.defaultClauses.length > 0) {
                                if (IS_SQLITE) {
                                    Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
                                } else {
                                    const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
                                    const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${plan.defaultClauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${plan.defaultClauses.join(', ')}`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                    else if (IS_MYSQL) await executeDDLSafely(stmt);
                                    else await sql`${sql(stmt)}`;
                                }
                            }

                            // 索引操作
                            for (const act of plan.indexActions) {
                                const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
                                if (FLAGS.DRY_RUN) {
                                    Logger.info(`[计划] ${stmt}`);
                                } else {
                                    try {
                                        await sql`${sql(stmt)}`;
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
                                for (const stmt of plan.commentActions) {
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${stmt}`);
                                    else await sql`${sql(stmt)}`;
                                }
                            }

                            modifiedTables++;
                        }
                    } else {
                        await createTable(tableName, tableDefinition);
                        createdTables++;
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
        if (sql) {
            try {
                await sql.close();
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
