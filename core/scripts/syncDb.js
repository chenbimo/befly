/**
 * 数据库表结构同步脚本 - 支持 sqlite / mysql / postgresql
 * 注意：MySQL 提供更完整的在线 ALTER 能力；SQLite/PG 的修改能力有差异，部分操作将跳过或分解。
 */

import path from 'node:path';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient, toSnakeTableName, isType, parseRule } from '../utils/index.js';
import { __dirtables, getProjectDir } from '../system.js';
import { checkTable } from '../checks/table.js';

// 顶部管理数据库客户端（按需求使用 Bun SQL 模板，不使用 exec 辅助）
let sql = null;

// 方言与类型映射
const DB = (Env.DB_TYPE || 'mysql').toLowerCase();
const IS_MYSQL = DB === 'mysql';
const IS_PG = DB === 'postgresql' || DB === 'postgres';
const IS_SQLITE = DB === 'sqlite'; // 命令行参数
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const IS_PLAN = ARGV.includes('--plan');

// 字段类型映射（按方言）
const typeMapping = {
    number: IS_SQLITE ? 'INTEGER' : 'BIGINT',
    string: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR',
    text: IS_MYSQL ? 'MEDIUMTEXT' : 'TEXT',
    array: IS_SQLITE ? 'TEXT' : IS_PG ? 'character varying' : 'VARCHAR'
};

// 全局统计
const globalCount = {
    // 表级
    processedTables: 0,
    createdTables: 0,
    modifiedTables: 0,
    // 字段与索引级
    addFields: 0,
    typeChanges: 0,
    maxChanges: 0, // 映射为长度变化
    minChanges: 0, // 最小值不参与 DDL，比对保留为0
    defaultChanges: 0,
    nameChanges: 0, // 字段显示名（注释）变更
    indexCreate: 0,
    indexDrop: 0
};

// PG 兼容类型变更识别：无需数据重写的宽化型变更
const isPgCompatibleTypeChange = (currentType, newType) => {
    const c = String(currentType || '').toLowerCase();
    const n = String(newType || '').toLowerCase();
    // varchar -> text 视为宽化
    if (c === 'character varying' && n === 'text') return true;
    // text -> character varying 非宽化（可能截断），不兼容
    return false;
};

// 数据库版本检查（按方言）
const ensureDbVersion = async () => {
    if (!sql) throw new Error('SQL 客户端未初始化');
    if (IS_MYSQL) {
        const r = await sql`SELECT VERSION() AS version`;
        const version = r[0].version;
        const majorVersion = parseInt(String(version).split('.')[0], 10);
        if (!Number.isFinite(majorVersion) || majorVersion < 8) {
            throw new Error(`此脚本仅支持 MySQL 8.0+，当前版本: ${version}`);
        }
        Logger.info(`MySQL 版本: ${version}`);
        return;
    }
    if (IS_PG) {
        const r = await sql`SELECT version() AS version`;
        const versionText = r[0].version;
        Logger.info(`PostgreSQL 版本: ${versionText}`);
        const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
        const major = m ? parseInt(m[1], 10) : NaN;
        if (!Number.isFinite(major) || major < 17) {
            throw new Error(`此脚本要求 PostgreSQL >= 17，当前: ${versionText}`);
        }
        return;
    }
    if (IS_SQLITE) {
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
        return;
    }
};

// 判断表是否存在（返回布尔值）
const tableExists = async (tableName) => {
    if (!sql) throw new Error('SQL 客户端未初始化');
    if (IS_MYSQL) {
        const res = await sql`SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${Env.DB_NAME} AND TABLE_NAME = ${tableName}`;
        return (res[0]?.count || 0) > 0;
    }
    if (IS_PG) {
        const res = await sql`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
        return (res[0]?.count || 0) > 0;
    }
    if (IS_SQLITE) {
        const res = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name = ${tableName}`;
        return res.length > 0;
    }
    return false;
};

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
        const result = await sql`PRAGMA table_info(${sql(tableName)})`;
        for (const row of result) {
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

// 构建索引操作 SQL（统一使用在线策略）
const buildIndexSQL = (tableName, indexName, fieldName, action) => {
    if (IS_MYSQL) {
        const parts = [];
        action === 'create' ? parts.push(`ADD INDEX \`${indexName}\` (\`${fieldName}\`)`) : parts.push(`DROP INDEX \`${indexName}\``);
        // 始终使用在线算法
        parts.push('ALGORITHM=INPLACE');
        parts.push('LOCK=NONE');
        return `ALTER TABLE \`${tableName}\` ${parts.join(', ')}`;
    }
    if (IS_PG) {
        if (action === 'create') {
            // 始终使用 CONCURRENTLY
            return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${tableName}"("${fieldName}")`;
        }
        return `DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"`;
    }
    // SQLite
    if (action === 'create') return `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}"("${fieldName}")`;
    return `DROP INDEX IF EXISTS "${indexName}"`;
};

// 创建表（尽量精简但保持既有行为）
const createTable = async (tableName, fields) => {
    // 统一列定义数组：包含系统字段与业务字段
    const colDefs = [];

    // 1) 固定字段
    if (IS_MYSQL) {
        colDefs.push('`id` BIGINT PRIMARY KEY COMMENT "主键ID"');
        colDefs.push('`created_at` BIGINT NOT NULL DEFAULT 0 COMMENT "创建时间"');
        colDefs.push('`updated_at` BIGINT NOT NULL DEFAULT 0 COMMENT "更新时间"');
        colDefs.push('`deleted_at` BIGINT NOT NULL DEFAULT 0 COMMENT "删除时间"');
        colDefs.push('`state` BIGINT NOT NULL DEFAULT 0 COMMENT "状态字段"');
    } else {
        colDefs.push('"id" INTEGER PRIMARY KEY');
        colDefs.push('"created_at" INTEGER NOT NULL DEFAULT 0');
        colDefs.push('"updated_at" INTEGER NOT NULL DEFAULT 0');
        colDefs.push('"deleted_at" INTEGER NOT NULL DEFAULT 0');
        colDefs.push('"state" INTEGER NOT NULL DEFAULT 0');
    }

    // 2) 业务字段
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
        const sqlType = ['string', 'array'].includes(fieldType) ? `${typeMapping[fieldType]}(${fieldMax})` : typeMapping[fieldType];
        const defaultSql = ['number', 'string', 'array'].includes(fieldType) ? (isType(fieldDefault, 'number') ? ` DEFAULT ${fieldDefault}` : ` DEFAULT '${fieldDefault}'`) : '';
        if (IS_MYSQL) {
            colDefs.push(`\`${fieldKey}\` ${sqlType} NOT NULL${defaultSql} COMMENT "${String(fieldName).replace(/"/g, '\\"')}"`);
        } else {
            colDefs.push(`"${fieldKey}" ${sqlType} NOT NULL${defaultSql}`);
        }
    }

    // 3) CREATE TABLE 语句
    const cols = colDefs.join(',\n            ');
    let createSQL;
    if (IS_MYSQL) {
        createSQL = `CREATE TABLE \`${tableName}\` (\n            ${cols}\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`;
    } else {
        createSQL = `CREATE TABLE "${tableName}" (\n            ${cols}\n        )`;
    }

    if (IS_PLAN) {
        Logger.info(`[计划] ${createSQL.replace(/\n+/g, ' ')}`);
    } else {
        await sql.unsafe(createSQL);
        Logger.info(`[新建表] ${tableName}`);
    }

    // 4) PG: 列注释（SQLite 不支持；MySQL 已在列定义中）
    if (IS_PG) {
        const commentPairs = [
            ['id', '主键ID'],
            ['created_at', '创建时间'],
            ['updated_at', '更新时间'],
            ['deleted_at', '删除时间'],
            ['state', '状态字段']
        ];
        for (const [name, cmt] of commentPairs) {
            const stmt = `COMMENT ON COLUMN "${tableName}"."${name}" IS '${cmt}'`;
            if (IS_PLAN) {
                Logger.info(`[计划] ${stmt}`);
            } else {
                await sql.unsafe(stmt);
            }
        }
        for (const [fieldKey, fieldRule] of Object.entries(fields)) {
            const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
            const stmt = `COMMENT ON COLUMN "${tableName}"."${fieldKey}" IS '${fieldName}'`;
            if (IS_PLAN) {
                Logger.info(`[计划] ${stmt}`);
            } else {
                await sql.unsafe(stmt);
            }
        }
    }

    // 5) 索引：系统字段 + 业务字段（按规则）
    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const stmt = buildIndexSQL(tableName, `idx_${sysField}`, sysField, 'create');
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            await sql.unsafe(stmt);
        }
    }
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
        if (fieldIndex === 1) {
            const stmt = buildIndexSQL(tableName, `idx_${fieldKey}`, fieldKey, 'create');
            if (IS_PLAN) {
                Logger.info(`[计划] ${stmt}`);
            } else {
                await sql.unsafe(stmt);
            }
        }
    }
};

// 比较字段定义变化
const compareFieldDefinition = (existingColumn, newRule, colName) => {
    const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(newRule);
    const changes = [];

    // 检查长度变化（string和array类型） - SQLite 不比较长度
    if (!IS_SQLITE && (fieldType === 'string' || fieldType === 'array')) {
        if (existingColumn.length !== fieldMax) {
            changes.push({
                type: 'length',
                current: existingColumn.length,
                new: fieldMax
            });
        }
    }

    // 检查注释变化（MySQL/PG 支持列注释）
    if (!IS_SQLITE) {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== fieldName) {
            changes.push({
                type: 'comment',
                current: currentComment,
                new: fieldName
            });
        }
    }

    // 检查数据类型变化（按方言）

    if (existingColumn.type.toLowerCase() !== typeMapping[fieldType].toLowerCase()) {
        changes.push({
            type: 'datatype',
            current: existingColumn.type,
            new: typeMapping[fieldType].toLowerCase()
        });
    }

    // 检查默认值变化（按照生成规则推导期望默认值）
    if (existingColumn.defaultValue !== String(fieldDefault)) {
        changes.push({
            type: 'default',
            current: existingColumn.defaultValue,
            new: fieldDefault
        });
    }

    return changes;
};

// 生成字段 DDL 子句（不含 ALTER TABLE 前缀）
const generateDDLClause = (fieldKey, fieldRule, isAdd = false) => {
    const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
    const sqlType = ['string', 'array'].includes(fieldType) ? `${typeMapping[fieldType]}(${fieldMax})` : typeMapping[fieldType];
    const defaultSql = ['number', 'string', 'array'].includes(fieldType) ? (isType(fieldDefault, 'number') ? ` DEFAULT ${fieldDefault}` : ` DEFAULT '${fieldDefault}'`) : '';
    if (IS_MYSQL) {
        return `${isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN'} \`${fieldKey}\` ${sqlType} NOT NULL${defaultSql} COMMENT "${String(fieldName).replace(/"/g, '\\"')}"`;
    }
    if (IS_PG) {
        if (isAdd) return `ADD COLUMN IF NOT EXISTS "${fieldKey}" ${sqlType} NOT NULL${defaultSql}`;
        // PG 修改：类型与非空可分条执行，生成 TYPE 改变；非空另由上层统一控制
        return `ALTER COLUMN "${fieldKey}" TYPE ${sqlType}`;
    }
    // SQLite 仅支持 ADD COLUMN（>=3.50.0：支持 IF NOT EXISTS）
    if (isAdd) return `ADD COLUMN IF NOT EXISTS "${fieldKey}" ${sqlType} NOT NULL${defaultSql}`;
    return '';
};

// 安全执行DDL语句
const executeDDLSafely = async (stmt) => {
    try {
        await sql.unsafe(stmt);
        return true;
    } catch (error) {
        // MySQL 专用降级路径
        if (stmt.includes('ALGORITHM=INSTANT')) {
            const inplaceSql = stmt.replace(/ALGORITHM=INSTANT/g, 'ALGORITHM=INPLACE');
            try {
                await sql.unsafe(inplaceSql);
                return true;
            } catch (inplaceError) {
                // 最后尝试传统DDL：移除 ALGORITHM/LOCK 附加子句后执行
                const traditionSql = stmt
                    .replace(/,\s*ALGORITHM=INPLACE/g, '')
                    .replace(/,\s*ALGORITHM=INSTANT/g, '')
                    .replace(/,\s*LOCK=(NONE|SHARED|EXCLUSIVE)/g, '');
                await sql.unsafe(traditionSql);
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
        await sql.unsafe(`INSERT INTO "${tmpTable}" (${colsSql}) SELECT ${colsSql} FROM "${tableName}"`);
    }

    // 4. 删除旧表并重命名
    await sql.unsafe(`DROP TABLE "${tableName}"`);
    await sql.unsafe(`ALTER TABLE "${tmpTable}" RENAME TO "${tableName}"`);
};

// 将表结构计划应用到数据库（执行 DDL/索引/注释等）
const applyTablePlan = async (tableName, fields, plan) => {
    if (!plan || !plan.changed) return;

    // SQLite: 仅支持部分 ALTER；需要时走重建
    if (IS_SQLITE) {
        if (plan.modifyClauses.length > 0 || plan.defaultClauses.length > 0) {
            if (IS_PLAN) Logger.info(`[计划] 重建表 ${tableName} 以应用列修改/默认值变化`);
            else await rebuildSqliteTable(tableName, fields);
        } else {
            for (const c of plan.addClauses) {
                const stmt = `ALTER TABLE "${tableName}" ${c}`;
                if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
                else await sql.unsafe(stmt);
            }
        }
    } else {
        const clauses = [...plan.addClauses, ...plan.modifyClauses];
        if (clauses.length > 0) {
            const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
            const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${clauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${clauses.join(', ')}`;
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else if (IS_MYSQL) await executeDDLSafely(stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 默认值专用 ALTER（SQLite 不支持）
    if (plan.defaultClauses.length > 0) {
        if (IS_SQLITE) {
            Logger.warn(`SQLite 不支持修改默认值，表 ${tableName} 的默认值变更已跳过`);
        } else {
            const suffix = IS_MYSQL ? ', ALGORITHM=INSTANT, LOCK=NONE' : '';
            const stmt = IS_MYSQL ? `ALTER TABLE \`${tableName}\` ${plan.defaultClauses.join(', ')}${suffix}` : `ALTER TABLE "${tableName}" ${plan.defaultClauses.join(', ')}`;
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else if (IS_MYSQL) await executeDDLSafely(stmt);
            else await sql.unsafe(stmt);
        }
    }

    // 索引操作
    for (const act of plan.indexActions) {
        const stmt = buildIndexSQL(tableName, act.indexName, act.fieldName, act.action);
        if (IS_PLAN) {
            Logger.info(`[计划] ${stmt}`);
        } else {
            try {
                await sql.unsafe(stmt);
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
            if (IS_PLAN) Logger.info(`[计划] ${stmt}`);
            else await sql.unsafe(stmt);
        }
    }

    // 计数
    globalCount.modifiedTables++;
};

// 同步表结构
const modifyTable = async (tableName, fields) => {
    const existingColumns = await getTableColumns(tableName);
    const existingIndexes = await getTableIndexes(tableName);
    let changed = false;

    const addClauses = [];
    const modifyClauses = [];
    const defaultClauses = [];
    const indexActions = [];

    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        if (existingColumns[fieldKey]) {
            const comparison = compareFieldDefinition(existingColumns[fieldKey], fieldRule, fieldKey);
            if (comparison.length > 0) {
                for (const c of comparison) {
                    const label =
                        {
                            length: '长度',
                            datatype: '类型',
                            comment: '注释',
                            default: '默认值'
                        }[c.type] || c.type;
                    Logger.info(`[字段变更] ${tableName}.${fieldKey} ${label}: ${c.current ?? 'NULL'} -> ${c.new ?? 'NULL'}`);
                    // 全量计数：全局累加
                    if (c.type === 'datatype') globalCount.typeChanges++;
                    else if (c.type === 'length') globalCount.maxChanges++;
                    else if (c.type === 'default') globalCount.defaultChanges++;
                    else if (c.type === 'comment') globalCount.nameChanges++;
                }
                const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
                if ((fieldType === 'string' || fieldType === 'array') && existingColumns[fieldKey].length) {
                    if (existingColumns[fieldKey].length > fieldMax) {
                        Logger.warn(`[跳过危险变更] ${tableName}.${fieldKey} 长度收缩 ${existingColumns[fieldKey].length} -> ${fieldMax} 已被跳过（设置 SYNC_DISALLOW_SHRINK=0 可放开）`);
                    }
                }
                const hasTypeChange = comparison.some((c) => c.type === 'datatype');
                const hasLengthChange = comparison.some((c) => c.type === 'length');
                const onlyDefaultChanged = comparison.every((c) => c.type === 'default');
                const defaultChanged = comparison.some((c) => c.type === 'default');

                // 严格限制：除 string/array 互转外，禁止任何字段类型变更；一旦发现，立即终止同步
                // 说明：string 与 array 在各方言下映射同为 VARCHAR/character varying/TEXT，compare 不会将其视为类型变更
                if (hasTypeChange) {
                    const currentSqlType = String(existingColumns[fieldKey].type || '').toLowerCase();
                    const newSqlType = String(typeMapping[fieldType] || '').toLowerCase();
                    // 明确抛错，阻止后续任何 DDL 应用
                    throw new Error(`禁止字段类型变更: ${tableName}.${fieldKey} ${currentSqlType} -> ${newSqlType}。仅允许 string<->array 互相切换`);
                }

                // 默认值变化处理：
                if (defaultChanged) {
                    const v = fieldType === 'number' ? fieldDefault : `'${fieldDefault}'`;
                    if (IS_PG) {
                        defaultClauses.push(`ALTER COLUMN "${fieldKey}" SET DEFAULT ${v}`);
                    } else if (IS_MYSQL && onlyDefaultChanged) {
                        // MySQL 的 TEXT/BLOB 不允许 DEFAULT，跳过 text 类型
                        if (fieldType !== 'text') {
                            defaultClauses.push(`ALTER COLUMN \`${fieldKey}\` SET DEFAULT ${v}`);
                        }
                    }
                }

                // 若不仅仅是默认值变化，继续生成修改子句
                if (!onlyDefaultChanged) {
                    let skipModify = false;
                    if (hasLengthChange && (fieldType === 'string' || fieldType === 'array') && existingColumns[fieldKey].length) {
                        const oldLen = existingColumns[fieldKey].length;
                        const isShrink = oldLen > fieldMax;
                        if (isShrink) skipModify = true;
                    }
                    if (hasTypeChange) {
                        if (IS_PG && isPgCompatibleTypeChange(existingColumns[fieldKey].type, typeMapping[fieldType].toLowerCase())) {
                            Logger.info(`[PG兼容类型变更] ${tableName}.${fieldKey} ${existingColumns[fieldKey].type} -> ${typeMapping[fieldType].toLowerCase()} 允许执行`);
                        }
                    }
                    if (!skipModify) modifyClauses.push(generateDDLClause(fieldKey, fieldRule, false));
                }
                changed = true;
            }
        } else {
            const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
            const lenPart = fieldType === 'string' || fieldType === 'array' ? ` 长度:${parseInt(fieldMax)}` : '';
            Logger.info(`[新增字段] ${tableName}.${fieldKey} 类型:${fieldType}${lenPart} 默认:${fieldDefault ?? 'NULL'}`);
            addClauses.push(generateDDLClause(fieldKey, fieldRule, true));
            changed = true;
            globalCount.addFields++;
        }
    }

    for (const sysField of ['created_at', 'updated_at', 'state']) {
        const idxName = `idx_${sysField}`;
        if (!existingIndexes[idxName]) {
            indexActions.push({ action: 'create', indexName: idxName, fieldName: sysField });
            changed = true;
            globalCount.indexCreate++;
        }
    }
    for (const [fieldKey, fieldRule] of Object.entries(fields)) {
        const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
        const indexName = `idx_${fieldKey}`;
        if (fieldIndex === 1 && !existingIndexes[indexName]) {
            indexActions.push({ action: 'create', indexName, fieldName: fieldKey });
            changed = true;
            globalCount.indexCreate++;
        } else if (!(fieldIndex === 1) && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            indexActions.push({ action: 'drop', indexName, fieldName: fieldKey });
            changed = true;
            globalCount.indexDrop++;
        }
    }

    const commentActions = [];
    if (IS_PG) {
        for (const [fieldKey, fieldRule] of Object.entries(fields)) {
            if (existingColumns[fieldKey]) {
                const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(fieldRule);
                const curr = existingColumns[fieldKey].comment || '';
                const want = fieldName && fieldName !== 'null' ? String(fieldName) : '';
                if (want !== curr) {
                    commentActions.push(`COMMENT ON COLUMN "${tableName}"."${fieldKey}" IS ${want ? `'${want}'` : 'NULL'}`);
                    changed = true;
                }
            }
        }
    }
    // 仅当存在实际动作时才认为有变更（避免仅日志的收缩跳过被计为修改）
    changed = addClauses.length > 0 || modifyClauses.length > 0 || defaultClauses.length > 0 || indexActions.length > 0 || commentActions.length > 0;
    const plan = { changed, addClauses, modifyClauses, defaultClauses, indexActions, commentActions };
    // 将计划应用（包含 --plan 情况下仅输出）
    if (plan.changed) {
        await applyTablePlan(tableName, fields, plan);
    }
    return plan;
};

// 主同步函数
const SyncDb = async () => {
    try {
        Logger.info('开始数据库表结构同步...');
        // 重置全局统计，避免多次调用累加
        for (const k of Object.keys(globalCount)) {
            if (typeof globalCount[k] === 'number') globalCount[k] = 0;
        }

        // 验证表定义文件
        if (!(await checkTable())) {
            throw new Error('表定义验证失败');
        }

        // 建立数据库连接并检查版本（按方言）
        // 在顶层也保留 sql 引用，便于未来需要跨函数访问
        sql = await createSqlClient({ max: 1 });
        await ensureDbVersion();

        // 扫描并处理表文件
        const tablesGlob = new Bun.Glob('*.json');
        const directories = [__dirtables, getProjectDir('tables')];
        // 统计使用全局 globalCount

        for (const dir of directories) {
            for await (const file of tablesGlob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
                const tableName = toSnakeTableName(path.basename(file, '.json'));
                const tableDefinition = await Bun.file(file).json();
                const existsTable = await tableExists(tableName);

                if (existsTable) {
                    await modifyTable(tableName, tableDefinition);
                } else {
                    await createTable(tableName, tableDefinition);
                    globalCount.createdTables++;
                }
                globalCount.processedTables++;
            }
        }

        // 显示统计信息（扩展维度）
        Logger.info(`统计 - 处理表总数: ${globalCount.processedTables}`);
        Logger.info(`统计 - 创建表: ${globalCount.createdTables}`);
        Logger.info(`统计 - 修改表: ${globalCount.modifiedTables}`);
        Logger.info(`统计 - 字段新增: ${globalCount.addFields}`);
        Logger.info(`统计 - 字段名称变更: ${globalCount.nameChanges}`);
        Logger.info(`统计 - 字段类型变更: ${globalCount.typeChanges}`);
        Logger.info(`统计 - 字段最小值变更: ${globalCount.minChanges}`);
        Logger.info(`统计 - 字段最大值变更: ${globalCount.maxChanges}`);
        Logger.info(`统计 - 字段默认值变更: ${globalCount.defaultChanges}`);
        // 索引新增/删除分别打印
        Logger.info(`统计 - 索引新增: ${globalCount.indexCreate}`);
        Logger.info(`统计 - 索引删除: ${globalCount.indexDrop}`);

        if (globalCount.processedTables === 0) {
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
