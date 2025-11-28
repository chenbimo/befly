/**
 * syncDb DDL 构建模块测试
 *
 * 测试 ddl.ts 中的函数：
 * - buildIndexSQL
 * - buildSystemColumnDefs
 * - buildBusinessColumnDefs
 * - generateDDLClause
 * - isPgCompatibleTypeChange
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { setDbType } from '../sync/syncDb/constants.js';

// 设置数据库类型为 MySQL
setDbType('mysql');

let buildIndexSQL: any;
let buildSystemColumnDefs: any;
let buildBusinessColumnDefs: any;
let generateDDLClause: any;
let isPgCompatibleTypeChange: any;

beforeAll(async () => {
    const ddl = await import('../sync/syncDb/ddl.js');
    buildIndexSQL = ddl.buildIndexSQL;
    buildSystemColumnDefs = ddl.buildSystemColumnDefs;
    buildBusinessColumnDefs = ddl.buildBusinessColumnDefs;
    generateDDLClause = ddl.generateDDLClause;
    isPgCompatibleTypeChange = ddl.isPgCompatibleTypeChange;
});

describe('buildIndexSQL (MySQL)', () => {
    test('创建索引 SQL', () => {
        const sql = buildIndexSQL('user', 'idx_created_at', 'created_at', 'create');
        expect(sql).toContain('ALTER TABLE `user`');
        expect(sql).toContain('ADD INDEX `idx_created_at`');
        expect(sql).toContain('(`created_at`)');
        expect(sql).toContain('ALGORITHM=INPLACE');
        expect(sql).toContain('LOCK=NONE');
    });

    test('删除索引 SQL', () => {
        const sql = buildIndexSQL('user', 'idx_created_at', 'created_at', 'drop');
        expect(sql).toContain('ALTER TABLE `user`');
        expect(sql).toContain('DROP INDEX `idx_created_at`');
    });
});

describe('buildSystemColumnDefs (MySQL)', () => {
    test('返回 5 个系统字段定义', () => {
        const defs = buildSystemColumnDefs();
        expect(defs.length).toBe(5);
    });

    test('包含 id 主键', () => {
        const defs = buildSystemColumnDefs();
        const idDef = defs.find((d: string) => d.includes('`id`'));
        expect(idDef).toContain('PRIMARY KEY');
        expect(idDef).toContain('AUTO_INCREMENT');
        expect(idDef).toContain('BIGINT UNSIGNED');
    });

    test('包含 created_at 字段', () => {
        const defs = buildSystemColumnDefs();
        const def = defs.find((d: string) => d.includes('`created_at`'));
        expect(def).toContain('BIGINT UNSIGNED');
        expect(def).toContain('NOT NULL');
        expect(def).toContain('DEFAULT 0');
    });

    test('包含 state 字段', () => {
        const defs = buildSystemColumnDefs();
        const def = defs.find((d: string) => d.includes('`state`'));
        expect(def).toContain('BIGINT UNSIGNED');
        expect(def).toContain('NOT NULL');
        expect(def).toContain('DEFAULT 0');
    });
});

describe('buildBusinessColumnDefs (MySQL)', () => {
    test('生成 string 类型字段', () => {
        const fields = {
            userName: {
                name: '用户名',
                type: 'string',
                max: 50,
                default: null,
                unique: false,
                nullable: false,
                unsigned: true
            }
        };
        const defs = buildBusinessColumnDefs(fields);
        expect(defs.length).toBe(1);
        expect(defs[0]).toContain('`user_name`');
        expect(defs[0]).toContain('VARCHAR(50)');
        expect(defs[0]).toContain('NOT NULL');
        expect(defs[0]).toContain("DEFAULT ''");
        expect(defs[0]).toContain('COMMENT "用户名"');
    });

    test('生成 number 类型字段', () => {
        const fields = {
            age: {
                name: '年龄',
                type: 'number',
                max: null,
                default: 0,
                unique: false,
                nullable: false,
                unsigned: true
            }
        };
        const defs = buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain('`age`');
        expect(defs[0]).toContain('BIGINT UNSIGNED');
        expect(defs[0]).toContain('DEFAULT 0');
    });

    test('生成 unique 字段', () => {
        const fields = {
            email: {
                name: '邮箱',
                type: 'string',
                max: 100,
                default: null,
                unique: true,
                nullable: false,
                unsigned: true
            }
        };
        const defs = buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain('UNIQUE');
    });

    test('生成 nullable 字段', () => {
        const fields = {
            remark: {
                name: '备注',
                type: 'string',
                max: 200,
                default: null,
                unique: false,
                nullable: true,
                unsigned: true
            }
        };
        const defs = buildBusinessColumnDefs(fields);
        expect(defs[0]).toContain('NULL');
        expect(defs[0]).not.toContain('NOT NULL');
    });
});

describe('generateDDLClause (MySQL)', () => {
    test('生成 ADD COLUMN 子句', () => {
        const fieldDef = {
            name: '用户名',
            type: 'string',
            max: 50,
            default: null,
            unique: false,
            nullable: false,
            unsigned: true
        };
        const clause = generateDDLClause('userName', fieldDef, true);
        expect(clause).toContain('ADD COLUMN');
        expect(clause).toContain('`user_name`');
        expect(clause).toContain('VARCHAR(50)');
    });

    test('生成 MODIFY COLUMN 子句', () => {
        const fieldDef = {
            name: '用户名',
            type: 'string',
            max: 100,
            default: null,
            unique: false,
            nullable: false,
            unsigned: true
        };
        const clause = generateDDLClause('userName', fieldDef, false);
        expect(clause).toContain('MODIFY COLUMN');
        expect(clause).toContain('`user_name`');
        expect(clause).toContain('VARCHAR(100)');
    });
});

describe('isPgCompatibleTypeChange', () => {
    test('varchar -> text 是兼容变更', () => {
        expect(isPgCompatibleTypeChange('character varying', 'text')).toBe(true);
    });

    test('text -> varchar 不是兼容变更', () => {
        expect(isPgCompatibleTypeChange('text', 'character varying')).toBe(false);
    });

    test('相同类型不是变更', () => {
        expect(isPgCompatibleTypeChange('text', 'text')).toBe(false);
    });

    test('空值处理', () => {
        expect(isPgCompatibleTypeChange(null, 'text')).toBe(false);
        expect(isPgCompatibleTypeChange('text', null)).toBe(false);
    });
});
