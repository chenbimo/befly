/**
 * syncDb DDL 构建测试
 */

import { describe, test, expect } from 'bun:test';
import { buildIndexSQL, buildSystemColumnDefs, buildBusinessColumnDefs, generateDDLClause, isPgCompatibleTypeChange } from '../commands/syncDb/ddl.js';
import { IS_MYSQL, IS_PG, IS_SQLITE } from '../commands/syncDb/constants.js';

describe('syncDb/ddl', () => {
    describe('buildIndexSQL', () => {
        test('应生成创建索引 SQL', () => {
            const sql = buildIndexSQL('users', 'idx_email', 'email', 'create');
            expect(sql).toBeDefined();
            expect(sql.length).toBeGreaterThan(0);

            if (IS_MYSQL) {
                expect(sql).toContain('ADD INDEX');
                expect(sql).toContain('ALGORITHM=INPLACE');
                expect(sql).toContain('LOCK=NONE');
            } else if (IS_PG) {
                expect(sql).toContain('CREATE INDEX CONCURRENTLY');
            } else if (IS_SQLITE) {
                expect(sql).toContain('CREATE INDEX');
            }
        });

        test('应生成删除索引 SQL', () => {
            const sql = buildIndexSQL('users', 'idx_email', 'email', 'drop');
            expect(sql).toBeDefined();

            if (IS_MYSQL) {
                expect(sql).toContain('DROP INDEX');
            } else if (IS_PG) {
                expect(sql).toContain('DROP INDEX CONCURRENTLY');
            } else if (IS_SQLITE) {
                expect(sql).toContain('DROP INDEX');
            }
        });
    });

    describe('buildSystemColumnDefs', () => {
        test('应返回 5 个系统字段定义', () => {
            const defs = buildSystemColumnDefs();
            expect(defs).toHaveLength(5);
        });

        test('系统字段应包含 id, created_at, updated_at, deleted_at, state', () => {
            const defs = buildSystemColumnDefs();
            const combined = defs.join(' ');

            expect(combined).toContain('id');
            expect(combined).toContain('created_at');
            expect(combined).toContain('updated_at');
            expect(combined).toContain('deleted_at');
            expect(combined).toContain('state');
        });

        test('MySQL 应包含 COMMENT', () => {
            const defs = buildSystemColumnDefs();
            const combined = defs.join(' ');

            if (IS_MYSQL) {
                expect(combined).toContain('COMMENT');
            }
        });
    });

    describe('buildBusinessColumnDefs', () => {
        test('应处理空字段对象', () => {
            const defs = buildBusinessColumnDefs({});
            expect(defs).toHaveLength(0);
        });

        test('应生成字段定义', () => {
            const fields = {
                username: '用户名|string|1|50||1',
                age: '年龄|number|0|150|0|0'
            };
            const defs = buildBusinessColumnDefs(fields);

            expect(defs.length).toBeGreaterThan(0);
            expect(defs.join(' ')).toContain('username');
            expect(defs.join(' ')).toContain('age');
        });
    });

    describe('generateDDLClause', () => {
        test('应生成添加字段子句', () => {
            const clause = generateDDLClause('email', '邮箱|string|0|100||0', true);
            expect(clause).toBeDefined();

            if (IS_MYSQL) {
                expect(clause).toContain('ADD COLUMN');
            } else if (IS_PG) {
                expect(clause).toContain('ADD COLUMN');
            } else if (IS_SQLITE) {
                expect(clause).toContain('ADD COLUMN');
            }
        });

        test('应生成修改字段子句', () => {
            const clause = generateDDLClause('email', '邮箱|string|0|100||0', false);
            expect(clause).toBeDefined();

            if (IS_MYSQL) {
                expect(clause).toContain('MODIFY COLUMN');
            } else if (IS_PG) {
                expect(clause).toContain('ALTER COLUMN');
            }
        });
    });

    describe('isPgCompatibleTypeChange', () => {
        test('varchar -> text 应为兼容变更', () => {
            const result = isPgCompatibleTypeChange('character varying', 'text');
            expect(result).toBe(true);
        });

        test('text -> varchar 应为不兼容变更', () => {
            const result = isPgCompatibleTypeChange('text', 'character varying');
            expect(result).toBe(false);
        });

        test('相同类型应为不兼容变更（无需变更）', () => {
            const result = isPgCompatibleTypeChange('text', 'text');
            expect(result).toBe(false);
        });

        test('应处理大小写', () => {
            const result = isPgCompatibleTypeChange('CHARACTER VARYING', 'TEXT');
            expect(result).toBe(true);
        });
    });
});
