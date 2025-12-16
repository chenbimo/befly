/**
 * syncDb SQLite 特殊处理模块
 *
 * 包含：
 * - SQLite 重建表迁移（处理列修改等不支持的操作）
 */

import { createTable } from './tableCreate.js';
import type { SQL } from 'bun';
import type { FieldDefinition } from '../../types/validate.js';

/**
 * SQLite 重建表迁移（简化版）
 *
 * SQLite 不支持修改列类型等操作，需要通过重建表实现：
 * 1. 创建临时表（新结构）
 * 2. 拷贝数据（仅公共列）
 * 3. 删除旧表
 * 4. 重命名临时表
 *
 * 注意：仅处理新增/修改字段，不处理复杂约束与复合索引
 *
 * @param sql - SQL 客户端实例
 * @param tableName - 表名
 * @param fields - 字段定义对象
 */
export async function rebuildSqliteTable(sql: SQL, tableName: string, fields: Record<string, FieldDefinition>): Promise<void> {
    // 1. 读取现有列顺序
    const info = await sql.unsafe(`PRAGMA table_info(${tableName})`);
    const existingCols = info.map((r: any) => r.name);
    const targetCols = ['id', 'created_at', 'updated_at', 'deleted_at', 'state', ...Object.keys(fields)];
    const tmpTable = `${tableName}__tmp__${Date.now()}`;

    // 2. 创建新表（使用当前定义）
    await createTable(sql, tmpTable, fields);

    // 3. 拷贝数据（按交集列）
    const commonCols = targetCols.filter((c) => existingCols.includes(c));
    if (commonCols.length > 0) {
        const colsSql = commonCols.map((c) => `"${c}"`).join(', ');
        await sql.unsafe(`INSERT INTO "${tmpTable}" (${colsSql}) SELECT ${colsSql} FROM "${tableName}"`);
    }

    // 4. 删除旧表并重命名
    await sql.unsafe(`DROP TABLE "${tableName}"`);
    await sql.unsafe(`ALTER TABLE "${tmpTable}" RENAME TO "${tableName}"`);
}
