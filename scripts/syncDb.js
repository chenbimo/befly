/**
 * 数据库表结构同步脚本 - 仅支持 MySQL 8.0+
 */

import path from 'node:path';
import { SQL } from 'bun';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { parseFieldRule } from '../utils/util.js';
import { __dirtables, getProjectDir } from '../system.js';
import tableCheck from '../checks/table.js';

const typeMapping = {
    number: 'BIGINT',
    string: 'VARCHAR',
    text: 'MEDIUMTEXT',
    array: 'VARCHAR'
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

    let columnDef = `\`${fieldName}\` ${sqlType} NOT NULL`;

    // 设置默认值：如果第5个属性为null或字段类型为text，则不设置默认值
    if (fieldDefaultValue && fieldDefaultValue !== 'null' && fieldType !== 'text') {
        if (fieldType === 'number') {
            columnDef += ` DEFAULT ${fieldDefaultValue}`;
        } else {
            columnDef += ` DEFAULT "${fieldDefaultValue.replace(/"/g, '\\"')}"`;
        }
    } else if (fieldType === 'string' || fieldType === 'array') {
        columnDef += ` DEFAULT ""`;
    } else if (fieldType === 'number') {
        columnDef += ` DEFAULT 0`;
    }
    // text类型不设置默认值

    // 添加字段注释（使用第1个属性作为字段显示名称）
    if (fieldDisplayName && fieldDisplayName !== 'null') {
        columnDef += ` COMMENT "${fieldDisplayName.replace(/"/g, '\\"')}"`;
    }

    return columnDef;
};

// 通用执行器：将 '?' 占位符转换为 Bun SQL 的 $1, $2 并执行
const toDollarParams = (query, params) => {
    if (!params || params.length === 0) return query;
    let i = 0;
    return query.replace(/\?/g, () => `$${++i}`);
};

const exec = async (client, query, params = []) => {
    if (params.length > 0) {
        return await client.unsafe(toDollarParams(query, params), params);
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

// 管理索引
const manageIndex = async (client, tableName, indexName, fieldName, action) => {
    const sql = action === 'create' ? `CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`${fieldName}\`)` : `DROP INDEX \`${indexName}\` ON \`${tableName}\``;

    try {
        await exec(client, sql);
        Logger.info(`表 ${tableName} 索引 ${indexName} ${action === 'create' ? '创建' : '删除'}成功`);
    } catch (error) {
        Logger.error(`${action === 'create' ? '创建' : '删除'}索引失败: ${error.message}`);
        throw error;
    }
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await exec(client, createTableSQL);
    Logger.info(`表 ${tableName} 创建成功`);
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

    return { hasChanges: changes.length > 0, changes };
};

// 生成DDL语句
const generateDDL = (tableName, fieldName, rule, isAdd = false) => {
    const columnDef = getColumnDefinition(fieldName, rule);
    const operation = isAdd ? 'ADD COLUMN' : 'MODIFY COLUMN';
    return `ALTER TABLE \`${tableName}\` ${operation} ${columnDef}, ALGORITHM=INSTANT, LOCK=NONE`;
};

// 安全执行DDL语句
const executeDDLSafely = async (client, sql) => {
    try {
        await exec(client, sql);
        return true;
    } catch (error) {
        // INSTANT失败时尝试INPLACE
        if (sql.includes('ALGORITHM=INSTANT')) {
            const inplaceSql = sql.replace('ALGORITHM=INSTANT', 'ALGORITHM=INPLACE');
            try {
                await exec(client, inplaceSql);
                return true;
            } catch (inplaceError) {
                // 最后尝试传统DDL
                const traditionSql = sql.split(',')[0]; // 移除ALGORITHM和LOCK参数
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

    // 同步字段
    for (const [fieldName, rule] of Object.entries(fields)) {
        if (existingColumns[fieldName]) {
            const comparison = compareFieldDefinition(existingColumns[fieldName], rule, fieldName);
            if (comparison.hasChanges) {
                const sql = generateDDL(tableName, fieldName, rule);
                await executeDDLSafely(client, sql);
                Logger.info(`字段 ${tableName}.${fieldName} 更新成功`);
            }
        } else {
            const sql = generateDDL(tableName, fieldName, rule, true);
            await executeDDLSafely(client, sql);
            Logger.info(`字段 ${tableName}.${fieldName} 添加成功`);
        }
    }

    // 同步索引
    for (const [fieldName, rule] of Object.entries(fields)) {
        const ruleParts = parseFieldRule(rule);
        const fieldHasIndex = ruleParts[5]; // 使用第6个属性判断是否设置索引
        const indexName = `idx_${fieldName}`;

        if (fieldHasIndex === '1' && !existingIndexes[indexName]) {
            await manageIndex(client, tableName, indexName, fieldName, 'create');
        } else if (fieldHasIndex !== '1' && existingIndexes[indexName] && existingIndexes[indexName].length === 1) {
            await manageIndex(client, tableName, indexName, fieldName, 'drop');
        }
    }
};

// 主同步函数
const SyncDb = async () => {
    let client = null;

    try {
        Logger.info('开始数据库表结构同步...');

        // 验证表定义文件
        const tableValidationResult = await tableCheck();
        if (!tableValidationResult) {
            throw new Error('表定义验证失败');
        }

        // 建立数据库连接并检查版本（Bun SQL）
        const url = `mysql://${encodeURIComponent(Env.MYSQL_USER)}:${encodeURIComponent(Env.MYSQL_PASSWORD)}@${Env.MYSQL_HOST}:${Env.MYSQL_PORT}/${Env.MYSQL_DB}`;
        client = new SQL({
            url: Env.MYSQL_URL ? Env.MYSQL_URL : url,
            max: 1,
            bigint: true
        });
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

        for (const dir of directories) {
            try {
                for await (const file of tablesGlob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
                    const tableName = path.basename(file, '.json');
                    const tableDefinition = await Bun.file(file).json();
                    const result = await exec(client, 'SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [Env.MYSQL_DB || 'test', tableName]);
                    const exists = result[0].count > 0;

                    if (exists) {
                        await syncTable(client, tableName, tableDefinition);
                    } else {
                        await createTable(client, tableName, tableDefinition);
                    }

                    Logger.info(`表 ${tableName} 处理完成`);
                    exists ? modifiedTables++ : createdTables++;
                    processedCount++;
                }
            } catch (error) {
                Logger.warn(`扫描目录 ${dir} 出错: ${error.message}`);
            }
        }

        // 显示统计信息
        Logger.info(`同步完成 - 总计: ${processedCount}, 新建: ${createdTables}, 修改: ${modifiedTables}`);

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
