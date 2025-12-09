/**
 * syncDb 常量模块测试
 *
 * 测试 constants.ts 中的常量：
 * - DB_VERSION_REQUIREMENTS
 * - SYSTEM_INDEX_FIELDS
 * - SYSTEM_INDEX_FIELDS
 * - CHANGE_TYPE_LABELS
 * - MYSQL_TABLE_CONFIG
 * - typeMapping
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setDbType } from '../sync/syncDb/constants.js';

// 设置数据库类型为 MySQL
setDbType('mysql');

let constants: any;

beforeAll(async () => {
    constants = await import('../sync/syncDb/constants.js');
});

describe('DB_VERSION_REQUIREMENTS', () => {
    test('MySQL 最低版本为 8', () => {
        expect(constants.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
    });

    test('PostgreSQL 最低版本为 17', () => {
        expect(constants.DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR).toBe(17);
    });

    test('SQLite 最低版本为 3.50.0', () => {
        expect(constants.DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION).toBe('3.50.0');
    });
});

describe('SYSTEM_INDEX_FIELDS', () => {
    test('包含 created_at', () => {
        expect(constants.SYSTEM_INDEX_FIELDS).toContain('created_at');
    });

    test('包含 updated_at', () => {
        expect(constants.SYSTEM_INDEX_FIELDS).toContain('updated_at');
    });

    test('包含 state', () => {
        expect(constants.SYSTEM_INDEX_FIELDS).toContain('state');
    });

    test('共 3 个系统索引字段', () => {
        expect(constants.SYSTEM_INDEX_FIELDS.length).toBe(3);
    });
});

describe('CHANGE_TYPE_LABELS', () => {
    test('length 对应 "长度"', () => {
        expect(constants.CHANGE_TYPE_LABELS.length).toBe('长度');
    });

    test('datatype 对应 "类型"', () => {
        expect(constants.CHANGE_TYPE_LABELS.datatype).toBe('类型');
    });

    test('comment 对应 "注释"', () => {
        expect(constants.CHANGE_TYPE_LABELS.comment).toBe('注释');
    });

    test('default 对应 "默认值"', () => {
        expect(constants.CHANGE_TYPE_LABELS.default).toBe('默认值');
    });
});

describe('MYSQL_TABLE_CONFIG', () => {
    test('ENGINE 为 InnoDB', () => {
        expect(constants.MYSQL_TABLE_CONFIG.ENGINE).toBe('InnoDB');
    });

    test('CHARSET 为 utf8mb4', () => {
        expect(constants.MYSQL_TABLE_CONFIG.CHARSET).toBe('utf8mb4');
    });

    test('COLLATE 为 utf8mb4_0900_ai_ci', () => {
        expect(constants.MYSQL_TABLE_CONFIG.COLLATE).toBe('utf8mb4_0900_ai_ci');
    });
});

describe('getTypeMapping (MySQL)', () => {
    test('number 映射为 BIGINT', () => {
        expect(constants.getTypeMapping().number).toBe('BIGINT');
    });

    test('string 映射为 VARCHAR', () => {
        expect(constants.getTypeMapping().string).toBe('VARCHAR');
    });

    test('text 映射为 MEDIUMTEXT', () => {
        expect(constants.getTypeMapping().text).toBe('MEDIUMTEXT');
    });

    test('array_string 映射为 VARCHAR', () => {
        expect(constants.getTypeMapping().array_string).toBe('VARCHAR');
    });

    test('array_text 映射为 MEDIUMTEXT', () => {
        expect(constants.getTypeMapping().array_text).toBe('MEDIUMTEXT');
    });
});

describe('IS_PLAN', () => {
    test('IS_PLAN 为 boolean 类型', () => {
        expect(typeof constants.IS_PLAN).toBe('boolean');
    });
});

describe('数据库类型判断 (MySQL)', () => {
    test('isMySQL 为 true', () => {
        expect(constants.isMySQL()).toBe(true);
    });

    test('isPG 为 false', () => {
        expect(constants.isPG()).toBe(false);
    });

    test('isSQLite 为 false', () => {
        expect(constants.isSQLite()).toBe(false);
    });
});
