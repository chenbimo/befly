/**
 * 数据库字段转义功能测试套件
 * 测试 SqlBuilder 类的字段转义和安全性功能
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import { createQueryBuilder, SqlBuilder } from '../utils/sqlBuilder.js';

describe('字段转义功能测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    describe('_escapeField 方法测试', () => {
        test('普通字段名转义', () => {
            expect(builder._escapeField('name')).toBe('`name`');
            expect(builder._escapeField('user_id')).toBe('`user_id`');
            expect(builder._escapeField('created_at')).toBe('`created_at`');
        });

        test('表.字段格式转义', () => {
            expect(builder._escapeField('users.name')).toBe('`users`.`name`');
            expect(builder._escapeField('orders.user_id')).toBe('`orders`.`user_id`');
            expect(builder._escapeField('products.created_at')).toBe('`products`.`created_at`');
        });

        test('通配符保持不变', () => {
            expect(builder._escapeField('*')).toBe('*');
            expect(builder._escapeField('users.*')).toBe('`users`.*');
        });

        test('已有反引号的字段保持不变', () => {
            expect(builder._escapeField('`name`')).toBe('`name`');
            expect(builder._escapeField('`users`.`name`')).toBe('`users`.`name`');
        });

        test('函数调用保持不变', () => {
            expect(builder._escapeField('COUNT(*)')).toBe('COUNT(*)');
            expect(builder._escapeField('MAX(price)')).toBe('MAX(price)');
            expect(builder._escapeField('CONCAT(first_name, last_name)')).toBe('CONCAT(first_name, last_name)');
        });

        test('别名处理', () => {
            expect(builder._escapeField('name AS user_name')).toBe('`name` AS user_name');
            expect(builder._escapeField('users.name AS user_name')).toBe('`users`.`name` AS user_name');
        });
    });

    describe('_escapeTable 方法测试', () => {
        test('普通表名转义', () => {
            expect(builder._escapeTable('users')).toBe('`users`');
            expect(builder._escapeTable('user_orders')).toBe('`user_orders`');
        });

        test('已有反引号的表名保持不变', () => {
            expect(builder._escapeTable('`users`')).toBe('`users`');
            expect(builder._escapeTable('`user_orders`')).toBe('`user_orders`');
        });

        test('表别名处理', () => {
            expect(builder._escapeTable('users u')).toBe('`users` u');
            expect(builder._escapeTable('user_orders uo')).toBe('`user_orders` uo');
        });
    });

    describe('SELECT 查询字段转义测试', () => {
        test('单个字段转义', () => {
            const { sql } = builder.select('name').from('users').toSelectSql();
            expect(sql).toBe('SELECT `name` FROM `users`');
        });

        test('多个字段转义', () => {
            const { sql } = builder.select(['id', 'name', 'email']).from('users').toSelectSql();
            expect(sql).toBe('SELECT `id`, `name`, `email` FROM `users`');
        });

        test('表.字段格式转义', () => {
            const { sql } = builder.select(['users.id', 'users.name', 'profiles.avatar']).from('users').toSelectSql();
            expect(sql).toBe('SELECT `users`.`id`, `users`.`name`, `profiles`.`avatar` FROM `users`');
        });

        test('通配符和函数不转义', () => {
            const { sql } = builder.select(['*', 'COUNT(*)', 'users.*']).from('users').toSelectSql();
            expect(sql).toBe('SELECT *, COUNT(*), `users`.* FROM `users`');
        });
    });

    describe('JOIN 查询表名转义测试', () => {
        test('LEFT JOIN 表名转义', () => {
            const { sql } = builder.select('*').from('users').leftJoin('profiles', 'users.id = profiles.user_id').toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` LEFT JOIN `profiles` ON users.id = profiles.user_id');
        });

        test('多个 JOIN 表名转义', () => {
            const { sql } = builder.select('*').from('users').leftJoin('profiles', 'users.id = profiles.user_id').leftJoin('orders', 'users.id = orders.user_id').toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` LEFT JOIN `profiles` ON users.id = profiles.user_id LEFT JOIN `orders` ON users.id = orders.user_id');
        });
    });

    describe('WHERE 条件字段转义测试', () => {
        test('简单等于条件字段转义', () => {
            const { sql, params } = builder.select('*').from('users').where('name', 'John').toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `name` = ?');
            expect(params).toEqual(['John']);
        });

        test('对象形式简单条件字段转义', () => {
            const { sql, params } = builder.select('*').from('users').where({ name: 'John', age: 25 }).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `name` = ? AND `age` = ?');
            expect(params).toEqual(['John', 25]);
        });

        test('一级属性操作符条件字段转义', () => {
            const { sql, params } = builder.select('*').from('users').where({ age$gt: 18, name$like: 'John%' }).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `age` > ? AND `name` LIKE ?');
            expect(params).toEqual([18, 'John%']);
        });

        test('IN 操作符字段转义', () => {
            const { sql, params } = builder
                .select('*')
                .from('users')
                .where({ role$in: ['admin', 'user'] })
                .toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `role` IN (?,?)');
            expect(params).toEqual(['admin', 'user']);
        });

        test('BETWEEN 操作符字段转义', () => {
            const { sql, params } = builder
                .select('*')
                .from('users')
                .where({ age$between: [18, 65] })
                .toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `age` BETWEEN ? AND ?');
            expect(params).toEqual([18, 65]);
        });

        test('NULL 检查字段转义', () => {
            const { sql, params } = builder.select('*').from('users').where({ deleted_at$null: true }).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `deleted_at` IS NULL');
            expect(params).toEqual([]);
        });

        test('表.字段格式WHERE条件转义', () => {
            const { sql, params } = builder.select('*').from('users').where({ 'users.name': 'John', 'profiles.active': true }).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` WHERE `users`.`name` = ? AND `profiles`.`active` = ?');
            expect(params).toEqual(['John', true]);
        });
    });

    describe('ORDER BY 字段转义测试', () => {
        test('单个字段排序转义', () => {
            const { sql } = builder.select('*').from('users').orderBy(['name#ASC']).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` ORDER BY `name` ASC');
        });

        test('多个字段排序转义', () => {
            const { sql } = builder.select('*').from('users').orderBy(['created_at#DESC', 'name#ASC']).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` ORDER BY `created_at` DESC, `name` ASC');
        });

        test('表.字段格式排序转义', () => {
            const { sql } = builder.select('*').from('users').orderBy(['users.name#ASC', 'profiles.updated_at#DESC']).toSelectSql();
            expect(sql).toBe('SELECT * FROM `users` ORDER BY `users`.`name` ASC, `profiles`.`updated_at` DESC');
        });
    });

    describe('GROUP BY 字段转义测试', () => {
        test('单个字段分组转义', () => {
            const { sql } = builder.select(['role', 'COUNT(*)']).from('users').groupBy('role').toSelectSql();
            expect(sql).toBe('SELECT `role`, COUNT(*) FROM `users` GROUP BY `role`');
        });

        test('多个字段分组转义', () => {
            const { sql } = builder.select(['role', 'status', 'COUNT(*)']).from('users').groupBy(['role', 'status']).toSelectSql();
            expect(sql).toBe('SELECT `role`, `status`, COUNT(*) FROM `users` GROUP BY `role`, `status`');
        });

        test('表.字段格式分组转义', () => {
            const { sql } = builder.select(['users.role', 'COUNT(*)']).from('users').groupBy('users.role').toSelectSql();
            expect(sql).toBe('SELECT `users`.`role`, COUNT(*) FROM `users` GROUP BY `users`.`role`');
        });
    });

    describe('INSERT 查询字段转义测试', () => {
        test('单条记录插入字段转义', () => {
            const { sql, params } = builder.toInsertSql('users', {
                name: 'John',
                email: 'john@example.com',
                created_at: new Date()
            });
            expect(sql).toBe('INSERT INTO `users` (`name`, `email`, `created_at`) VALUES (?, ?, ?)');
            expect(params).toHaveLength(3);
        });

        test('批量插入字段转义', () => {
            const { sql, params } = builder.toInsertSql('users', [
                { name: 'John', email: 'john@example.com' },
                { name: 'Jane', email: 'jane@example.com' }
            ]);
            expect(sql).toBe('INSERT INTO `users` (`name`, `email`) VALUES (?, ?), (?, ?)');
            expect(params).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com']);
        });

        test('特殊字段名插入转义', () => {
            const { sql } = builder.toInsertSql('users', {
                first_name: 'John',
                last_name: 'Doe',
                user_id: 123
            });
            expect(sql).toBe('INSERT INTO `users` (`first_name`, `last_name`, `user_id`) VALUES (?, ?, ?)');
        });
    });

    describe('UPDATE 查询字段转义测试', () => {
        test('基础更新字段转义', () => {
            const { sql, params } = builder.where({ id: 1 }).toUpdateSql('users', { name: 'Updated Name', email: 'new@example.com' });
            expect(sql).toBe('UPDATE `users` SET `name` = ?, `email` = ? WHERE `id` = ?');
            expect(params).toEqual(['Updated Name', 'new@example.com', 1]);
        });

        test('特殊字段名更新转义', () => {
            const { sql } = builder.where({ user_id: 123 }).toUpdateSql('user_profiles', {
                first_name: 'John',
                last_name: 'Doe',
                updated_at: new Date()
            });
            expect(sql).toBe('UPDATE `user_profiles` SET `first_name` = ?, `last_name` = ?, `updated_at` = ? WHERE `user_id` = ?');
        });
    });

    describe('DELETE 查询表名转义测试', () => {
        test('基础删除表名转义', () => {
            const { sql, params } = builder.where({ id: 1 }).toDeleteSql('users');
            expect(sql).toBe('DELETE FROM `users` WHERE `id` = ?');
            expect(params).toEqual([1]);
        });

        test('特殊表名删除转义', () => {
            const { sql } = builder.where({ user_id: 123 }).toDeleteSql('user_sessions');
            expect(sql).toBe('DELETE FROM `user_sessions` WHERE `user_id` = ?');
        });
    });

    describe('复杂查询字段转义测试', () => {
        test('复杂多表查询字段转义', () => {
            const { sql, params } = builder
                .select(['users.id', 'users.name', 'profiles.avatar', 'COUNT(orders.id)'])
                .from('users')
                .leftJoin('profiles', 'users.id = profiles.user_id')
                .leftJoin('orders', 'users.id = orders.user_id')
                .where({
                    'users.status': 'active',
                    'profiles.verified$ne': false,
                    'orders.created_at$gt': '2023-01-01'
                })
                .groupBy(['users.id', 'profiles.id'])
                .orderBy(['users.created_at#DESC'])
                .toSelectSql();

            expect(sql).toBe('SELECT `users`.`id`, `users`.`name`, `profiles`.`avatar`, COUNT(orders.id) FROM `users` LEFT JOIN `profiles` ON users.id = profiles.user_id LEFT JOIN `orders` ON users.id = orders.user_id WHERE `users`.`status` = ? AND `profiles`.`verified` != ? AND `orders`.`created_at` > ? GROUP BY `users`.`id`, `profiles`.`id` ORDER BY `users`.`created_at` DESC');
            expect(params).toEqual(['active', false, '2023-01-01']);
        });

        test('OR 条件字段转义', () => {
            const { sql, params } = builder
                .select('*')
                .from('users')
                .where({
                    $or: [{ 'users.name': 'John' }, { 'users.email$like': 'john%' }]
                })
                .toSelectSql();

            expect(sql).toBe('SELECT * FROM `users` WHERE ((`users`.`name` = ?) OR (`users`.`email` LIKE ?))');
            expect(params).toEqual(['John', 'john%']);
        });

        test('AND 和 OR 混合条件字段转义', () => {
            const { sql, params } = builder
                .select('*')
                .from('users')
                .where({
                    status: 'active',
                    $or: [{ role: 'admin' }, { permissions$in: ['read', 'write'] }]
                })
                .toSelectSql();

            expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND ((`role` = ?) OR (`permissions` IN (?,?)))');
            expect(params).toEqual(['active', 'admin', 'read', 'write']);
        });
    });

    describe('边界情况和安全性测试', () => {
        test('SQL注入防护 - 字段名中的特殊字符', () => {
            // 测试包含特殊字符的字段名是否正确转义
            const { sql } = builder.select('field_with_quotes').from('table_with_special_chars').where({ field_with_quotes: 'value' }).toSelectSql();

            expect(sql).toBe('SELECT `field_with_quotes` FROM `table_with_special_chars` WHERE `field_with_quotes` = ?');
        });

        test('空字段名处理', () => {
            expect(() => {
                builder._escapeField('');
            }).not.toThrow();
            expect(builder._escapeField('')).toBe('``');
        });

        test('null 和 undefined 字段名处理', () => {
            expect(() => {
                builder._escapeField(null);
            }).not.toThrow();
            expect(() => {
                builder._escapeField(undefined);
            }).not.toThrow();
        });

        test('数字字段名转义', () => {
            expect(builder._escapeField('123field')).toBe('`123field`');
            expect(builder._escapeField('field123')).toBe('`field123`');
        });

        test('中文字段名转义', () => {
            expect(builder._escapeField('用户名')).toBe('`用户名`');
            expect(builder._escapeField('用户表.用户名')).toBe('`用户表`.`用户名`');
        });
    });

    describe('兼容性测试', () => {
        test('向后兼容 - 原有查询仍然工作', () => {
            // 确保添加转义功能后，原有的查询仍然正常工作
            const { sql, params } = builder.select(['id', 'name']).from('users').where({ id: 1 }).orderBy(['name#ASC']).toSelectSql();

            expect(sql).toBe('SELECT `id`, `name` FROM `users` WHERE `id` = ? ORDER BY `name` ASC');
            expect(params).toEqual([1]);
        });

        test('原生SQL条件不受影响', () => {
            const { sql, params } = builder.select('*').from('users').where('id > 10 AND status = "active"').toSelectSql();

            expect(sql).toBe('SELECT * FROM `users` WHERE id > 10 AND status = "active"');
            expect(params).toEqual([]);
        });
    });
});

describe('性能测试', () => {
    test('大量字段转义性能', () => {
        const builder = createQueryBuilder();
        const fields = Array.from({ length: 100 }, (_, i) => `field_${i}`);

        const start = performance.now();
        const { sql } = builder.select(fields).from('test_table').toSelectSql();
        const end = performance.now();

        expect(end - start).toBeLessThan(100); // 应该在100ms内完成
        expect(sql).toContain('`field_0`');
        expect(sql).toContain('`field_99`');
    });

    test('复杂查询构建性能', () => {
        const builder = createQueryBuilder();

        const start = performance.now();
        const { sql } = builder
            .select(['users.id', 'users.name', 'profiles.avatar'])
            .from('users')
            .leftJoin('profiles', 'users.id = profiles.user_id')
            .where({
                'users.status': 'active',
                'profiles.verified': true,
                'users.created_at$gt': '2023-01-01'
            })
            .orderBy(['users.created_at#DESC'])
            .groupBy(['users.id'])
            .toSelectSql();
        const end = performance.now();

        expect(end - start).toBeLessThan(50); // 应该在50ms内完成
        expect(sql).toContain('`users`.`id`');
    });
});
