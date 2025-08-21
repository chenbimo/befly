import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { parseFieldRule } from '../utils/util.js';
import { __dirtables, getProjectDir } from '../system.js';
import tableCheck from '../checks/table.js';

// 自动加载环境配置文件
const loadEnvFile = () => {
    const envFiles = [path.join(process.cwd(), '.env.development'), path.join(process.cwd(), '.env.local'), path.join(process.cwd(), '.env')];

    for (const envFile of envFiles) {
        if (existsSync(envFile)) {
            console.log(`📄 加载环境配置文件: ${envFile}`);
            const envContent = readFileSync(envFile, 'utf8');
            const lines = envContent.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                        process.env[key] = value;
                    }
                }
            }
            break;
        }
    }
};

// 初始化时加载环境配置
loadEnvFile();

// 数据类型映射到数据库字段类型
const typeMapping = {
    number: 'BIGINT',
    string: 'VARCHAR',
    text: 'MEDIUMTEXT',
    array: 'VARCHAR' // 使用管道符连接元素存储
};

// 获取字段的SQL定义
const getColumnDefinition = (fieldName, rule, withoutIndex = false) => {
    const ruleParts = parseFieldRule(rule);
    const [displayName, type, minStr, maxStr, defaultValue, hasIndex, spec] = ruleParts;

    let sqlType = typeMapping[type];
    if (!sqlType) {
        throw new Error(`不支持的数据类型: ${type}`);
    }

    // 处理字符串类型的长度
    if (type === 'string') {
        const maxLength = maxStr === 'null' ? 255 : parseInt(maxStr);
        sqlType = `VARCHAR(${maxLength})`;
    }

    // 处理数组类型的长度
    if (type === 'array') {
        const maxLength = maxStr === 'null' ? 1000 : parseInt(maxStr);
        sqlType = `VARCHAR(${maxLength})`;
    }

    // 构建完整的列定义
    let columnDef = `\`${fieldName}\` ${sqlType} NOT NULL`;

    // 添加默认值
    if (defaultValue && defaultValue !== 'null') {
        if (type === 'string') {
            columnDef += ` DEFAULT "${defaultValue.replace(/"/g, '\\"')}"`;
        } else if (type === 'number') {
            columnDef += ` DEFAULT ${defaultValue}`;
        } else if (type === 'array') {
            columnDef += ` DEFAULT "${defaultValue.replace(/"/g, '\\"')}"`;
        }
        // text 类型不添加默认值，因为MySQL不支持TEXT类型的默认值
    } else {
        // 根据字段类型设置合适的默认值，所有字段都不允许为NULL
        if (type === 'string' || type === 'array') {
            columnDef += ` DEFAULT ""`;
        } else if (type === 'number') {
            columnDef += ` DEFAULT 0`;
        }
        // text 类型不添加默认值，因为MySQL不支持TEXT类型的默认值
    }

    // 添加注释
    if (displayName && displayName !== 'null') {
        columnDef += ` COMMENT "${displayName.replace(/"/g, '\\"')}"`;
    }

    return columnDef;
};

// 创建数据库连接
const createConnection = async () => {
    console.log(`🔍 检查 MySQL 配置...`);
    console.log(`MYSQL_ENABLE: ${process.env.MYSQL_ENABLE}`);
    console.log(`MYSQL_HOST: ${process.env.MYSQL_HOST}`);
    console.log(`MYSQL_PORT: ${process.env.MYSQL_PORT}`);
    console.log(`MYSQL_DB: ${process.env.MYSQL_DB}`);
    console.log(`MYSQL_USER: ${process.env.MYSQL_USER}`);

    if (Env.MYSQL_ENABLE !== 1) {
        throw new Error('MySQL 未启用，请在环境变量中设置 MYSQL_ENABLE=1');
    }

    console.log(`📦 导入 mariadb 驱动...`);
    const mariadb = await import('mariadb');

    const config = {
        host: Env.MYSQL_HOST || '127.0.0.1',
        port: Env.MYSQL_PORT || 3306,
        database: Env.MYSQL_DB || 'test',
        user: Env.MYSQL_USER || 'root',
        password: Env.MYSQL_PASSWORD || 'root',
        charset: 'utf8mb4',
        timezone: Env.TIMEZONE || 'local'
    };

    console.log(`🔌 尝试连接数据库...`);
    console.log(`连接配置: ${config.user}@${config.host}:${config.port}/${config.database}`);

    return await mariadb.createConnection(config);
};

// 检查表是否存在
const tableExists = async (conn, tableName) => {
    const result = await conn.query('SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [Env.MYSQL_DB || 'test', tableName]);
    return result[0].count > 0;
};

// 获取表的现有列信息
const getTableColumns = async (conn, tableName) => {
    const result = await conn.query(
        `SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            NUMERIC_PRECISION,
            NUMERIC_SCALE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            COLUMN_COMMENT,
            COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
        [Env.MYSQL_DB || 'test', tableName]
    );

    const columns = {};
    result.forEach((row) => {
        columns[row.COLUMN_NAME] = {
            type: row.DATA_TYPE,
            columnType: row.COLUMN_TYPE, // 完整的类型定义，如 varchar(255)
            length: row.CHARACTER_MAXIMUM_LENGTH,
            precision: row.NUMERIC_PRECISION,
            scale: row.NUMERIC_SCALE,
            nullable: row.IS_NULLABLE === 'YES',
            defaultValue: row.COLUMN_DEFAULT,
            comment: row.COLUMN_COMMENT
        };
    });
    return columns;
};

// 获取表的现有索引信息
const getTableIndexes = async (conn, tableName) => {
    const result = await conn.query(
        `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY'
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [Env.MYSQL_DB || 'test', tableName]
    );

    const indexes = {};
    result.forEach((row) => {
        if (!indexes[row.INDEX_NAME]) {
            indexes[row.INDEX_NAME] = [];
        }
        indexes[row.INDEX_NAME].push(row.COLUMN_NAME);
    });
    return indexes;
};

// 创建索引
const createIndex = async (conn, tableName, fieldName, dbInfo) => {
    const indexName = `idx_${fieldName}`;
    const createIndexSQL = `CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`${fieldName}\`)`;

    try {
        await conn.query(createIndexSQL);
        Logger.info(`表 ${tableName} 字段 ${fieldName} 索引创建成功`);
    } catch (error) {
        Logger.error(`创建索引失败: ${error.message}`);
        throw error;
    }
};

// 删除索引
const dropIndex = async (conn, tableName, indexName) => {
    const dropIndexSQL = `DROP INDEX \`${indexName}\` ON \`${tableName}\``;

    try {
        await conn.query(dropIndexSQL);
        Logger.info(`表 ${tableName} 索引 ${indexName} 删除成功`);
    } catch (error) {
        Logger.error(`删除索引失败: ${error.message}`);
        throw error;
    }
};

// 创建表
const createTable = async (conn, tableName, fields) => {
    const columns = [];
    const indexes = [];

    // 添加系统默认字段
    columns.push('`id` BIGINT PRIMARY KEY COMMENT "主键ID"');
    columns.push('`created_at` BIGINT NOT NULL DEFAULT 0 COMMENT "创建时间"');
    columns.push('`updated_at` BIGINT NOT NULL DEFAULT 0 COMMENT "更新时间"');
    columns.push('`deleted_at` BIGINT NOT NULL DEFAULT 0 COMMENT "删除时间"');
    columns.push('`state` BIGINT NOT NULL DEFAULT 0 COMMENT "状态字段"');

    // 添加系统字段的索引
    indexes.push('INDEX `idx_created_at` (`created_at`)');
    indexes.push('INDEX `idx_updated_at` (`updated_at`)');
    indexes.push('INDEX `idx_state` (`state`)');

    // 添加自定义字段
    for (const [fieldName, rule] of Object.entries(fields)) {
        const columnDef = getColumnDefinition(fieldName, rule);
        columns.push(columnDef);

        // 检查是否需要创建索引
        const ruleParts = parseFieldRule(rule);
        const hasIndex = ruleParts[5]; // 第6个参数是索引设置

        if (hasIndex && hasIndex !== 'null' && hasIndex !== '0' && hasIndex.toLowerCase() !== 'false') {
            indexes.push(`INDEX \`idx_${fieldName}\` (\`${fieldName}\`)`);
            console.log(`📊 为字段 ${tableName}.${fieldName} 创建索引`);
        }
    }

    const createTableSQL = `
        CREATE TABLE \`${tableName}\` (
            ${columns.join(',\n            ')},
            ${indexes.join(',\n            ')}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT="${tableName} 表"
    `;

    await conn.query(createTableSQL);
    Logger.info(`表 ${tableName} 创建成功`);
};

// 比较字段定义是否有变化
const compareFieldDefinition = (existingColumn, newRule) => {
    const ruleParts = parseFieldRule(newRule);
    const [displayName, type, minStr, maxStr, defaultValue, hasIndex, spec] = ruleParts;
    const changes = [];

    // 检查数据类型变化
    const expectedType = typeMapping[type];

    // 对于 string 类型，检查长度变化
    if (type === 'string') {
        const newMaxLength = maxStr === 'null' ? 255 : parseInt(maxStr);
        const currentLength = existingColumn.length;

        if (currentLength !== newMaxLength) {
            changes.push({
                type: 'length',
                current: currentLength,
                new: newMaxLength,
                field: 'CHARACTER_MAXIMUM_LENGTH'
            });
        }
    }

    // 检查注释变化
    if (displayName && displayName !== 'null') {
        const currentComment = existingColumn.comment || '';
        if (currentComment !== displayName) {
            changes.push({
                type: 'comment',
                current: currentComment,
                new: displayName,
                field: 'COLUMN_COMMENT'
            });
        }
    }

    // 检查默认值变化
    if (defaultValue && defaultValue !== 'null') {
        const currentDefault = existingColumn.defaultValue;
        let expectedDefault = defaultValue;

        // 根据类型格式化期望的默认值
        if (type === 'string' || type === 'text' || type === 'array') {
            expectedDefault = defaultValue;
        } else if (type === 'number') {
            expectedDefault = parseInt(defaultValue);
        }

        if (currentDefault !== expectedDefault) {
            changes.push({
                type: 'default',
                current: currentDefault,
                new: expectedDefault,
                field: 'COLUMN_DEFAULT'
            });
        }
    }

    // 检查基础数据类型变化
    const currentType = existingColumn.type.toLowerCase();
    let expectedDbType = '';

    switch (type) {
        case 'number':
            expectedDbType = 'bigint';
            break;
        case 'string':
            expectedDbType = 'varchar';
            break;
        case 'text':
            expectedDbType = 'mediumtext';
            break;
        case 'array':
            expectedDbType = 'varchar';
            break;
    }

    if (currentType !== expectedDbType) {
        changes.push({
            type: 'datatype',
            current: currentType,
            new: expectedDbType,
            field: 'DATA_TYPE'
        });
    }

    return {
        hasChanges: changes.length > 0,
        changes: changes,
        reason: changes.length > 0 ? `发现 ${changes.length} 个变化` : '无变化'
    };
};

// 生成ALTER语句来修改字段（使用MySQL 8 Online DDL）
const generateAlterStatement = (tableName, fieldName, rule, changes) => {
    const columnDef = getColumnDefinition(fieldName, rule);

    // 使用 MySQL 8 的 Online DDL 语法
    // ALGORITHM=INSTANT: 立即执行，不复制数据
    // ALGORITHM=INPLACE: 就地执行，不阻塞DML操作
    // LOCK=NONE: 不锁定表，允许并发读写
    return `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${columnDef}, ALGORITHM=INPLACE, LOCK=NONE`;
};

// 生成添加字段的ALTER语句（使用MySQL 8 Online DDL）
const generateAddColumnStatement = (tableName, fieldName, rule) => {
    const columnDef = getColumnDefinition(fieldName, rule);

    // 使用 Online DDL 添加字段
    return `ALTER TABLE \`${tableName}\` ADD COLUMN ${columnDef}, ALGORITHM=INSTANT, LOCK=NONE`;
};

// 检查MySQL版本和Online DDL支持
const checkMySQLVersion = async (conn) => {
    try {
        const result = await conn.query('SELECT VERSION() AS version');
        const version = result[0].version;
        Logger.info(`MySQL/MariaDB 版本: ${version}`);

        // 检查是否支持 Online DDL
        const versionParts = version.split('.');
        const majorVersion = parseInt(versionParts[0]);
        const minorVersion = parseInt(versionParts[1]);

        const isMySQL = version.toLowerCase().includes('mysql') || !version.toLowerCase().includes('mariadb');
        const isMariaDB = version.toLowerCase().includes('mariadb');

        // MySQL 5.6+ 支持 Online DDL，MySQL 8.0+ 支持更完善的 Online DDL
        const isMySQL56Plus = isMySQL && (majorVersion > 5 || (majorVersion === 5 && minorVersion >= 6));
        // MariaDB 10.0+ 支持 Online DDL
        const isMariaDB10Plus = isMariaDB && majorVersion >= 10;

        const supportsOnlineDDL = isMySQL56Plus || isMariaDB10Plus;
        Logger.info(`Online DDL 支持: ${supportsOnlineDDL ? '是' : '否'}`);

        if (supportsOnlineDDL) {
            Logger.info(`数据库类型: ${isMySQL ? 'MySQL' : 'MariaDB'} ${majorVersion}.${minorVersion}`);
        }

        return { version, supportsOnlineDDL };
    } catch (error) {
        Logger.warn('无法检测数据库版本，使用默认设置');
        return { version: 'unknown', supportsOnlineDDL: false };
    }
};

// 安全执行DDL语句
const executeDDLSafely = async (conn, sql, fallbackSql = null) => {
    try {
        Logger.info(`执行SQL: ${sql}`);
        await conn.query(sql);
        return true;
    } catch (error) {
        Logger.warn(`Online DDL 执行失败: ${error.message}`);

        if (fallbackSql) {
            Logger.info(`尝试回退SQL: ${fallbackSql}`);
            try {
                await conn.query(fallbackSql);
                Logger.info('回退SQL执行成功');
                return true;
            } catch (fallbackError) {
                Logger.error(`回退SQL也执行失败: ${fallbackError.message}`);
                throw fallbackError;
            }
        } else {
            throw error;
        }
    }
};

// 同步表字段
const syncTableFields = async (conn, tableName, fields, dbInfo) => {
    const existingColumns = await getTableColumns(conn, tableName);
    const systemFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];

    Logger.info(`开始同步表 ${tableName} 的字段...`);
    Logger.info(`现有字段数量: ${Object.keys(existingColumns).length}`);
    Logger.info(`新定义字段数量: ${Object.keys(fields).length}`);

    for (const [fieldName, rule] of Object.entries(fields)) {
        if (existingColumns[fieldName]) {
            // 字段已存在，检查是否需要修改
            const comparison = compareFieldDefinition(existingColumns[fieldName], rule);

            if (comparison.hasChanges) {
                Logger.info(`字段 ${tableName}.${fieldName} 需要更新:`);
                comparison.changes.forEach((change) => {
                    Logger.info(`  - ${change.type}: ${change.current} → ${change.new}`);
                });

                // 生成Online DDL语句
                const onlineSQL = generateAlterStatement(tableName, fieldName, rule, comparison.changes);
                const fallbackSQL = `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${getColumnDefinition(fieldName, rule)}`;

                // 安全执行DDL（总是提供回退方案）
                await executeDDLSafely(conn, onlineSQL, fallbackSQL);
                Logger.info(`表 ${tableName} 字段 ${fieldName} 更新成功`);
            } else {
                Logger.info(`字段 ${tableName}.${fieldName} 无变化，跳过`);
            }
        } else {
            // 添加新字段
            Logger.info(`字段 ${tableName}.${fieldName} 不存在，需要添加`);

            const onlineSQL = generateAddColumnStatement(tableName, fieldName, rule);
            const fallbackSQL = `ALTER TABLE \`${tableName}\` ADD COLUMN ${getColumnDefinition(fieldName, rule)}`;

            // 安全执行DDL（总是提供回退方案）
            await executeDDLSafely(conn, onlineSQL, fallbackSQL);
            Logger.info(`表 ${tableName} 添加字段 ${fieldName} 成功`);

            // 检查新字段是否需要创建索引
            const ruleParts = parseFieldRule(rule);
            const hasIndex = ruleParts[5]; // 第6个参数是索引设置

            if (hasIndex && hasIndex !== 'null' && hasIndex !== '0' && hasIndex.toLowerCase() !== 'false') {
                await createIndex(conn, tableName, fieldName, dbInfo);
            }
        }
    }

    // 同步索引
    Logger.info(`开始同步表 ${tableName} 的索引...`);
    await syncTableIndexes(conn, tableName, fields, dbInfo);

    Logger.info(`表 ${tableName} 字段和索引同步完成`);
};

// 同步表索引
const syncTableIndexes = async (conn, tableName, fields, dbInfo) => {
    // 获取现有索引
    const existingIndexes = await getTableIndexes(conn, tableName);

    // 系统字段索引（这些索引在表创建时已经建立）
    const systemIndexes = ['idx_created_at', 'idx_updated_at', 'idx_state'];

    // 收集需要创建的索引
    const requiredIndexes = [];

    for (const [fieldName, rule] of Object.entries(fields)) {
        const ruleParts = parseFieldRule(rule);
        const hasIndex = ruleParts[5]; // 第6个参数是索引设置

        if (hasIndex && hasIndex !== 'null' && hasIndex !== '0' && hasIndex.toLowerCase() !== 'false') {
            const indexName = `idx_${fieldName}`;
            requiredIndexes.push({ fieldName, indexName });
        }
    }

    // 检查需要创建的索引
    for (const { fieldName, indexName } of requiredIndexes) {
        if (!existingIndexes[indexName]) {
            Logger.info(`字段 ${tableName}.${fieldName} 需要创建索引`);
            await createIndex(conn, tableName, fieldName, dbInfo);
        } else {
            Logger.info(`字段 ${tableName}.${fieldName} 索引已存在，跳过`);
        }
    }

    // 检查需要删除的索引（字段定义中不再需要索引的字段）
    for (const [indexName, columns] of Object.entries(existingIndexes)) {
        // 跳过系统索引
        if (systemIndexes.includes(indexName)) {
            continue;
        }

        // 检查是否为单字段索引且该字段在当前定义中不需要索引
        if (columns.length === 1) {
            const fieldName = columns[0];

            // 检查该字段是否在当前表定义中
            if (fields[fieldName]) {
                const ruleParts = parseFieldRule(fields[fieldName]);
                const hasIndex = ruleParts[5];

                // 如果字段定义中不需要索引，则删除现有索引
                if (!hasIndex || hasIndex === 'null' || hasIndex === '0' || hasIndex.toLowerCase() === 'false') {
                    Logger.info(`字段 ${tableName}.${fieldName} 不再需要索引，删除索引 ${indexName}`);
                    await dropIndex(conn, tableName, indexName);
                }
            } else {
                // 字段已被删除，但我们不处理字段删除，只记录
                Logger.info(`字段 ${tableName}.${fieldName} 不在当前定义中，保留索引 ${indexName}`);
            }
        }
    }

    Logger.info(`表 ${tableName} 索引同步完成`);
};

// 处理单个表文件
const processTableFile = async (conn, filePath, dbInfo) => {
    const fileName = path.basename(filePath, '.json');
    const tableName = fileName;

    Logger.info(`处理表定义文件: ${fileName}`);

    // 读取表定义
    const tableDefinition = await Bun.file(filePath).json();

    // 检查表是否存在
    const exists = await tableExists(conn, tableName);
    Logger.info(`表 ${tableName} 存在状态: ${exists}`);

    if (exists) {
        Logger.info(`表 ${tableName} 已存在，检查字段变化并同步...`);
        await syncTableFields(conn, tableName, tableDefinition, dbInfo);
    } else {
        Logger.info(`表 ${tableName} 不存在，创建新表...`);
        await createTable(conn, tableName, tableDefinition);
    }

    Logger.info(`表 ${tableName} 处理完成`);
};

// 主同步函数
const syncDatabase = async () => {
    let conn = null;

    try {
        Logger.info('开始数据库表结构同步...');

        // 首先执行表定义验证
        Logger.info('步骤 1/3: 验证表定义文件...');
        const tableValidationResult = await tableCheck();

        if (!tableValidationResult) {
            throw new Error('表定义验证失败，请检查表定义文件格式。同步操作已取消。');
        }

        Logger.info('✅ 表定义验证通过，继续执行数据库同步...');

        // 创建数据库连接
        Logger.info('步骤 2/3: 建立数据库连接...');
        conn = await createConnection();
        Logger.info('数据库连接成功');

        // 检查数据库版本和 Online DDL 支持
        const dbInfo = await checkMySQLVersion(conn);
        Logger.info(`数据库信息: ${dbInfo.version}`);
        Logger.info(`Online DDL 支持: ${dbInfo.supportsOnlineDDL ? '是' : '否'}`);

        // 扫描tables目录
        Logger.info('步骤 3/3: 同步数据库表结构...');
        const tablesGlob = new Bun.Glob('*.json');
        const coreTablesDir = __dirtables;
        const userTablesDir = getProjectDir('tables');

        let processedCount = 0;
        let createdTables = 0;
        let modifiedTables = 0;

        Logger.info('开始处理表定义文件...');

        // 处理核心表定义
        Logger.info(`扫描核心表目录: ${coreTablesDir}`);
        try {
            for await (const file of tablesGlob.scan({
                cwd: coreTablesDir,
                absolute: true,
                onlyFiles: true
            })) {
                const tableName = path.basename(file, '.json');
                const exists = await tableExists(conn, tableName);

                try {
                    await processTableFile(conn, file, dbInfo);
                    if (exists) {
                        modifiedTables++;
                    } else {
                        createdTables++;
                    }
                    processedCount++;
                } catch (error) {
                    Logger.error(`处理表文件 ${file} 时出错:`, error.message);
                    console.error(`错误详情:`, error);
                    throw error;
                }
            }
        } catch (error) {
            Logger.warn('核心表目录扫描出错:', error.message);
        }

        // 处理用户表定义
        Logger.info(`扫描用户表目录: ${userTablesDir}`);
        try {
            for await (const file of tablesGlob.scan({
                cwd: userTablesDir,
                absolute: true,
                onlyFiles: true
            })) {
                const tableName = path.basename(file, '.json');
                const exists = await tableExists(conn, tableName);

                try {
                    await processTableFile(conn, file, dbInfo);
                    if (exists) {
                        modifiedTables++;
                    } else {
                        createdTables++;
                    }
                    processedCount++;
                } catch (error) {
                    Logger.error(`处理表文件 ${file} 时出错:`, error.message);
                    console.error(`错误详情:`, error);
                    throw error;
                }
            }
        } catch (error) {
            Logger.warn('用户表目录扫描出错:', error.message);
        }

        // 显示同步统计信息
        Logger.info('='.repeat(50));
        Logger.info('数据库表结构同步完成');
        Logger.info('='.repeat(50));
        Logger.info(`总处理表数: ${processedCount}`);
        Logger.info(`新创建表数: ${createdTables}`);
        Logger.info(`修改表数: ${modifiedTables}`);
        Logger.info(`使用的DDL模式: ${dbInfo.supportsOnlineDDL ? 'Online DDL (无锁)' : '传统DDL'}`);
        Logger.info(`数据库版本: ${dbInfo.version}`);
        Logger.info('='.repeat(50));

        if (processedCount === 0) {
            Logger.warn('没有找到任何表定义文件，请检查 tables/ 目录');
        }
    } catch (error) {
        Logger.error('数据库同步失败:', error);
        process.exit(1);
    } finally {
        if (conn) {
            try {
                await conn.end();
                Logger.info('数据库连接已关闭');
            } catch (error) {
                Logger.warn('关闭数据库连接时出错:', error.message);
            }
        }
    }
};

// 如果直接运行此脚本或通过 CLI 调用
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dbSync.js')) {
    console.log(`🚀 开始执行数据库同步脚本...`);
    syncDatabase().catch((error) => {
        console.error('❌ 数据库同步失败:', error);
        process.exit(1);
    });
}

export { syncDatabase };
