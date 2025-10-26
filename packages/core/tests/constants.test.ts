/**
 * syncDb 常量模块测试
 */

import { describe, test, expect } from 'bun:test';
import { DB_VERSION_REQUIREMENTS, SYSTEM_FIELDS, SYSTEM_INDEX_FIELDS, CHANGE_TYPE_LABELS, MYSQL_TABLE_CONFIG, IS_MYSQL, IS_PG, IS_SQLITE, typeMapping } from '../commands/syncDb/constants.js';

describe('syncDb/constants', () => {
    describe('数据库版本要求', () => {
        test('应定义 MySQL 最低版本', () => {
            expect(DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
        });

        test('应定义 PostgreSQL 最低版本', () => {
            expect(DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR).toBe(17);
        });

        test('应定义 SQLite 最低版本', () => {
            expect(DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION).toBe('3.50.0');
            expect(DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION_NUM).toBe(35000);
        });
    });

    describe('系统字段定义', () => {
        test('应包含 5 个系统字段', () => {
            const fields = Object.keys(SYSTEM_FIELDS);
            expect(fields).toHaveLength(5);
            expect(fields).toContain('ID');
            expect(fields).toContain('CREATED_AT');
            expect(fields).toContain('UPDATED_AT');
            expect(fields).toContain('DELETED_AT');
            expect(fields).toContain('STATE');
        });

        test('每个系统字段应有名称和注释', () => {
            expect(SYSTEM_FIELDS.ID.name).toBe('id');
            expect(SYSTEM_FIELDS.ID.comment).toBe('主键ID');
        });
    });

    describe('系统索引字段', () => {
        test('应包含 3 个索引字段', () => {
            expect(SYSTEM_INDEX_FIELDS).toHaveLength(3);
            expect(SYSTEM_INDEX_FIELDS).toContain('created_at');
            expect(SYSTEM_INDEX_FIELDS).toContain('updated_at');
            expect(SYSTEM_INDEX_FIELDS).toContain('state');
        });
    });

    describe('变更类型标签', () => {
        test('应包含所有变更类型', () => {
            expect(CHANGE_TYPE_LABELS.length).toBe('长度');
            expect(CHANGE_TYPE_LABELS.datatype).toBe('类型');
            expect(CHANGE_TYPE_LABELS.comment).toBe('注释');
            expect(CHANGE_TYPE_LABELS.default).toBe('默认值');
        });
    });

    describe('MySQL 表配置', () => {
        test('应有默认配置', () => {
            expect(MYSQL_TABLE_CONFIG.ENGINE).toBeDefined();
            expect(MYSQL_TABLE_CONFIG.CHARSET).toBeDefined();
            expect(MYSQL_TABLE_CONFIG.COLLATE).toBeDefined();
        });

        test('默认引擎应为 InnoDB', () => {
            expect(MYSQL_TABLE_CONFIG.ENGINE).toMatch(/InnoDB/i);
        });

        test('默认字符集应为 utf8mb4', () => {
            expect(MYSQL_TABLE_CONFIG.CHARSET).toMatch(/utf8mb4/i);
        });
    });

    describe('数据库类型检测', () => {
        test('IS_MYSQL, IS_PG, IS_SQLITE 三者只有一个为 true', () => {
            const trueCount = [IS_MYSQL, IS_PG, IS_SQLITE].filter(Boolean).length;
            expect(trueCount).toBe(1);
        });

        test('类型映射应包含所有字段类型', () => {
            expect(typeMapping.number).toBeDefined();
            expect(typeMapping.string).toBeDefined();
            expect(typeMapping.text).toBeDefined();
            expect(typeMapping.array_string).toBeDefined();
            expect(typeMapping.array_text).toBeDefined();
        });

        test('不同数据库的类型映射应不同', () => {
            if (IS_MYSQL) {
                expect(typeMapping.number).toBe('BIGINT');
                expect(typeMapping.string).toBe('VARCHAR');
                expect(typeMapping.text).toBe('MEDIUMTEXT');
            } else if (IS_PG) {
                expect(typeMapping.number).toBe('BIGINT');
                expect(typeMapping.string).toBe('character varying');
                expect(typeMapping.text).toBe('TEXT');
            } else if (IS_SQLITE) {
                expect(typeMapping.number).toBe('INTEGER');
                expect(typeMapping.string).toBe('TEXT');
                expect(typeMapping.text).toBe('TEXT');
            }
        });
    });
});
