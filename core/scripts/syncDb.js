/**
 * 数据库表结构同步脚本 - 仅支持 MySQL 8.0+
 */

import path from 'node:path';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { parseFieldRule, createSqlClient, toSnakeTableName } from '../utils/index.js';
import { __dirtables, getProjectDir } from '../system.js';
import { checkTable } from '../checks/table.js';

const typeMapping = {
    number: 'BIGINT',
    string: 'VARCHAR',
    text: 'MEDIUMTEXT',
    array: 'VARCHAR'
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
    ALLOW_TYPE_CHANGE: getFlag(Env.SYNC_ALLOW_TYPE_CHANGE, 0) // 允许类型变更
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

// 获取表的现有列信息
const getTableColumns = async (client, tableName) => {
    const result = await exec(
        client,
        `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT, COLUMN_TYPE
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [Env.MYSQL_DB || 'test', tableName]
    );

    const columns = {};
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
    return columns;
};

// 获取表的现有索引信息
const getTableIndexes = async (client, tableName) => {
    const result = await exec(
        client,
        `SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME`,
        [Env.MYSQL_DB || 'test', tableName]
    );

    const indexes = {};
    result.forEach((row) => {
        if (!indexes[row.INDEX_NAME]) indexes[row.INDEX_NAME] = [];
        indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
    });
    return indexes;
};

// 构建索引操作 SQL（统一使用 ALTER TABLE 并尽量在线）
const buildIndexSQL = (tableName, indexName, fieldName, action) => {
    const parts = [];
    if (action === 'create') {
        parts.push(`ADD INDEX \`${indexName}\` (\`${fieldName}\`)`);
    } else {
        parts.push(`DROP INDEX \`${indexName}\``);
    }
    if (FLAGS.ONLINE_INDEX) {
        parts.push('ALGORITHM=INPLACE');
        parts.push('LOCK=NONE');
    }
    return `ALTER TABLE \`${tableName}\` ${parts.join(', ')}`;
};

// 创建表
const createTable = async (client, tableName, fields) => {
    const columns = [
        //
        '`id` BIGINT PRIMARY KEY COMMENT "主键ID"',
        '`created_at` BIGINT NOT NULL DEFAULT 0 COMMENT "创建时间"',
        '`updated_at` BIGINT NOT NULL DEFAULT 0 COMMENT "更新时间"',
        '`deleted_at` BIGINT NOT NULL DEFAULT 0 COMMENT "删除时间"',
        '`state` BIGINT NOT NULL DEFAULT 0 COMMENT "状态字段"'
    ];

    const indexes = [
        //
        'INDEX `idx_created_at` (`created_at`)',
        'INDEX `idx_updated_at` (`updated_at`)',
        'INDEX `idx_state` (`state`)'
    ];

    // 添加自定义字段和索引
    for (const [fieldName, rule] of Object.entries(fields)) {
        columns.push(getColumnDefinition(fieldName, rule));

        // 使用第6个属性判断是否设置索引
        const ruleParts = parseFieldRule(rule);
        const fieldHasIndex = ruleParts[5]; // 第6个属性
        if (fieldHasIndex === '1') {
            indexes.push(`INDEX \`idx_${fieldName}\` (\`${fieldName}\`)`);
        }
    }

    const createTableSQL = `
        CREATE TABLE \`${tableName}\` (
            ${columns.join(',\n            ')},
            ${indexes.join(',\n            ')}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
    `;

    if (FLAGS.DRY_RUN) {
        Logger.info(`[计划] ${createTableSQL.replace(/\n+/g, ' ')}`);
    } else {
        await exec(client, createTableSQL);
        Logger.info(`[新建表] ${tableName}`);
    }
};

// 比较字段定义变化
const compareFieldDefinition = (existingColumn, newRule, fieldName) => {
    const ruleParts = parseFieldRule(newRule);
    const [fieldDisplayName, fieldType, fieldMin, fieldMaxLength, fieldDefaultValue] = ruleParts;
    const changes = [];

    // 检查长度变化（string和array类型）
    if (fieldType === 'string' || fieldType === 'array') {
        if (fieldMaxLength === 'null') {
            throw new Error(`string/array 类型字段的最大长度未设置，必须指定最大长度`);
        }
        const newMaxLength = parseInt(fieldMaxLength);
        if (existingColumn.length !== newMaxLength) {
            changes.push({ type: 'length', current: existingColumn.length, new: newMaxLength });
        }
    }

    // 检查注释变化（使用第1个属性作为字段显示名称）
    if (fieldDisplayName && fieldDisplayName !== 'null') {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== fieldDisplayName) {
            changes.push({ type: 'comment', current: currentComment, new: fieldDisplayName });
        }
    }

    // 检查数据类型变化
    const expectedDbType = {
        number: 'bigint',
        string: 'varchar',
        text: 'mediumtext',
        array: 'varchar'
    }[fieldType];

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
    const columnDef = getColumnDefinition(fieldName, rule);
    const operation = isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN';
    return `${operation} ${columnDef}`;
};

// 安全执行DDL语句
const executeDDLSafely = async (client, sql) => {
    try {
        await exec(client, sql);
        return true;
    } catch (error) {
        // INSTANT失败时尝试INPLACE
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
                const expectedDbType = {
                    number: 'bigint',
                    string: 'varchar',
                    text: 'mediumtext',
                    array: 'varchar'
                }[parseFieldRule(rule)[1]];
                if (existingColumns[fieldName].type.toLowerCase() !== expectedDbType && !FLAGS.ALLOW_TYPE_CHANGE) {
                    Logger.warn(`[跳过危险变更] ${tableName}.${fieldName} 类型变更 ${existingColumns[fieldName].type} -> ${expectedDbType} 已被跳过（设置 SYNC_ALLOW_TYPE_CHANGE=1 可放开）`);
                    // 继续处理默认值/注释等非类型变更
                }

                // 判断是否“仅默认值变化”
                const onlyDefaultChanged = comparison.changes.every((c) => c.type === 'default');
                if (onlyDefaultChanged) {
                    const expectedDefault = getExpectedDefault(parseFieldRule(rule)[1], parseFieldRule(rule)[4]);
                    if (expectedDefault === null) {
                        defaultClauses.push(`ALTER COLUMN \`${fieldName}\` DROP DEFAULT`);
                    } else {
                        const isNumber = parseFieldRule(rule)[1] === 'number';
                        const v = isNumber ? expectedDefault : `"${String(expectedDefault).replace(/"/g, '\\"')}"`;
                        defaultClauses.push(`ALTER COLUMN \`${fieldName}\` SET DEFAULT ${v}`);
                    }
                } else {
                    // 判断是否需要跳过 MODIFY：包含收缩或类型变更时跳过
                    let skipModify = false;
                    const hasLengthChange = comparison.changes.some((c) => c.type === 'length');
                    if (hasLengthChange && (fType === 'string' || fType === 'array') && existingColumns[fieldName].length && fMax !== 'null') {
                        const newLen = parseInt(fMax);
                        if (existingColumns[fieldName].length > newLen && FLAGS.DISALLOW_SHRINK) {
                            skipModify = true;
                        }
                    }
                    const hasTypeChange = comparison.changes.some((c) => c.type === 'datatype');
                    if (hasTypeChange && !FLAGS.ALLOW_TYPE_CHANGE) {
                        skipModify = true;
                    }
                    if (!skipModify) {
                        // 合并到 MODIFY COLUMN 子句
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
            addClauses.push(generateDDLClause(fieldName, rule, true));
            changed = true;
            changeStats.addFields++;
        }
    }

    // 同步索引
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
    return { changed, addClauses, modifyClauses, defaultClauses, indexActions, metrics: changeStats };
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

        // 建立数据库连接并检查版本（统一工具函数）
        client = await createSqlClient({ max: 1 });
        const result = await client`SELECT VERSION() AS version`;
        const version = result[0].version;

        if (version.toLowerCase().includes('mariadb')) {
            throw new Error('此脚本仅支持 MySQL 8.0+，不支持 MariaDB');
        }

        const majorVersion = parseInt(version.split('.')[0]);
        if (majorVersion < 8) {
            throw new Error(`此脚本仅支持 MySQL 8.0+，当前版本: ${version}`);
        }

        Logger.info(`MySQL 版本检查通过: ${version}`);

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
                    const result = await exec(client, 'SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [Env.MYSQL_DB || 'test', tableName]);
                    const exists = result[0].count > 0;

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
                            if (FLAGS.MERGE_ALTER) {
                                const clauses = [...plan.addClauses, ...plan.modifyClauses];
                                if (clauses.length > 0) {
                                    const sql = `ALTER TABLE \`${tableName}\` ${clauses.join(', ')}, ALGORITHM=INSTANT, LOCK=NONE`;
                                    if (FLAGS.DRY_RUN) {
                                        Logger.info(`[计划] ${sql}`);
                                    } else {
                                        await executeDDLSafely(client, sql);
                                    }
                                }
                            } else {
                                // 分别执行
                                for (const c of plan.addClauses) {
                                    const sql = `ALTER TABLE \`${tableName}\` ${c}, ALGORITHM=INSTANT, LOCK=NONE`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else await executeDDLSafely(client, sql);
                                }
                                for (const c of plan.modifyClauses) {
                                    const sql = `ALTER TABLE \`${tableName}\` ${c}, ALGORITHM=INSTANT, LOCK=NONE`;
                                    if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                    else await executeDDLSafely(client, sql);
                                }
                            }

                            // 默认值专用 ALTER
                            if (plan.defaultClauses.length > 0) {
                                const sql = `ALTER TABLE \`${tableName}\` ${plan.defaultClauses.join(', ')}, ALGORITHM=INSTANT, LOCK=NONE`;
                                if (FLAGS.DRY_RUN) Logger.info(`[计划] ${sql}`);
                                else await executeDDLSafely(client, sql);
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

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dbSync.js')) {
    SyncDb().catch((error) => {
        console.error('❌ 数据库同步失败:', error);
        process.exit(1);
    });
}

export { SyncDb };
