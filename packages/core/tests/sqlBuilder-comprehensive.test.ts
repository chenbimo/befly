/**
 * SqlBuilder 全面测试
 * 覆盖所有功能、边界条件和错误处理
 */

import { describe, expect, test } from 'bun:test';
import { SqlBuilder, createQueryBuilder } from '../utils/sqlBuilder.js';

describe('SqlBuilder - 基础功能', () => {
    test('应该创建新的 SqlBuilder 实例', () => {
        const builder = new SqlBuilder();
        expect(builder).toBeInstanceOf(SqlBuilder);
    });

    test('createQueryBuilder 应该返回新实�?, () => {
        const builder = createQueryBuilder();
        expect(builder).toBeInstanceOf(SqlBuilder);
    });

    test('reset() 应该重置所有状�?, () => {
        const builder = new SqlBuilder().select(['id', 'name']).from('users').where({ id: 1 }).orderBy(['id#ASC']).limit(10).offset(5);

        builder.reset();
        const result = builder.from('test').toSelectSql();

        expect(result.sql).toBe('SELECT * FROM `test`');
        expect(result.params).toEqual([]);
    });
});

describe('SqlBuilder - 字段转义 (_escapeField)', () => {
    test('应该转义普通字段名', () => {
        const builder = new SqlBuilder().select('username').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`username`');
    });

    test('不应该转�?* 通配�?, () => {
        const builder = new SqlBuilder().select('*').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('SELECT *');
    });

    test('不应该转义已经带反引号的字段', () => {
        const builder = new SqlBuilder().select('`user_id`').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`user_id`');
        expect(result.sql).not.toContain('``');
    });

    test('不应该转义包含函数的字段', () => {
        const builder = new SqlBuilder().select('COUNT(*)').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('COUNT(*)');
    });

    test('应该正确处理 AS 别名', () => {
        const builder = new SqlBuilder().select('username AS user_name').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`username` AS user_name');
    });

    test('应该正确处理表名.字段名格�?, () => {
        const builder = new SqlBuilder().select('users.id').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`users`.`id`');
    });

    test('应该正确处理表名.*格式', () => {
        const builder = new SqlBuilder().select('users.*').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`users`.*');
    });
});

describe('SqlBuilder - 表名转义 (_escapeTable)', () => {
    test('应该转义普通表�?, () => {
        const builder = new SqlBuilder().from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('FROM `users`');
    });

    test('不应该转义已经带反引号的表名', () => {
        const builder = new SqlBuilder().from('`user_table`');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`user_table`');
        expect(result.sql).not.toContain('``');
    });

    test('应该正确处理表别�?, () => {
        const builder = new SqlBuilder().from('users u');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('FROM `users` u');
    });
});

describe('SqlBuilder - SELECT 方法', () => {
    test('应该支持单个字段', () => {
        const builder = new SqlBuilder().select('id').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT `id` FROM `users`');
    });

    test('应该支持字段数组', () => {
        const builder = new SqlBuilder().select(['id', 'name', 'email']).from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT `id`, `name`, `email` FROM `users`');
    });

    test('应该支持链式调用添加多个字段', () => {
        const builder = new SqlBuilder().select('id').select('name').select('email').from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT `id`, `name`, `email` FROM `users`');
    });

    test('默认应该 SELECT *', () => {
        const builder = new SqlBuilder().from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT * FROM `users`');
    });

    test('应该拒绝非字符串/数组的字�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.select(123);
        }).toThrow();
    });
});

describe('SqlBuilder - FROM 方法', () => {
    test('应该设置表名', () => {
        const builder = new SqlBuilder().from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('FROM `users`');
    });

    test('应该拒绝空字符串表名', () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.from('');
        }).toThrow();
        expect(() => {
            builder.from('   ');
        }).toThrow();
    });

    test('应该拒绝非字符串表名', () => {
        const builder = new SqlBuilder();
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.from(123);
        }).toThrow();
    });

    test('应该自动 trim 表名', () => {
        const builder = new SqlBuilder().from('  users  ');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('FROM `users`');
    });
});

describe('SqlBuilder - WHERE 方法 - 简单条�?, () => {
    test('应该支持简单的等于条件', () => {
        const builder = new SqlBuilder().from('users').where({ id: 1 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('WHERE `id` = ?');
        expect(result.params).toEqual([1]);
    });

    test('应该支持多个等于条件', () => {
        const builder = new SqlBuilder().from('users').where({ id: 1, status: 'active' });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('WHERE `id` = ? AND `status` = ?');
        expect(result.params).toEqual([1, 'active']);
    });

    test('应该跳过 undefined �?, () => {
        const builder = new SqlBuilder().from('users').where({ id: 1, name: undefined });
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT * FROM `users` WHERE `id` = ?');
        expect(result.params).toEqual([1]);
    });

    test('应该支持字符串条�?, () => {
        const builder = new SqlBuilder().from('users').where('id > 10');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('WHERE id > 10');
    });

    test('应该支持字段名和值的方式', () => {
        const builder = new SqlBuilder().from('users').where('status', 'active');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('WHERE `status` = ?');
        expect(result.params).toEqual(['active']);
    });
});

describe('SqlBuilder - WHERE 方法 - 操作符（一级格式）', () => {
    test('$ne - 不等�?, () => {
        const builder = new SqlBuilder().from('users').where({ status$ne: 'deleted' });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`status` != ?');
        expect(result.params).toEqual(['deleted']);
    });

    test('$not - 不等于（别名�?, () => {
        const builder = new SqlBuilder().from('users').where({ status$not: 'deleted' });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`status` != ?');
        expect(result.params).toEqual(['deleted']);
    });

    test('$in - IN 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ role$in: ['admin', 'editor'] });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`role` IN (?,?)');
        expect(result.params).toEqual(['admin', 'editor']);
    });

    test('$in - 应该拒绝空数�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.where({ role$in: [] });
        }).toThrow();
        expect(() => {
            builder.where({ role$in: [] });
        }).toThrow(/空数组会导致查询永远不匹�?);
    });

    test('$nin - NOT IN 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ role$nin: ['guest', 'banned'] });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`role` NOT IN (?,?)');
        expect(result.params).toEqual(['guest', 'banned']);
    });

    test('$notIn - NOT IN 别名', () => {
        const builder = new SqlBuilder().from('users').where({ role$notIn: ['guest', 'banned'] });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`role` NOT IN (?,?)');
        expect(result.params).toEqual(['guest', 'banned']);
    });

    test('$nin - 应该拒绝空数�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.where({ role$nin: [] });
        }).toThrow();
        expect(() => {
            builder.where({ role$nin: [] });
        }).toThrow(/空数组会导致查询匹配所有记�?);
    });

    test('$like - LIKE 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ name$like: '%John%' });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`name` LIKE ?');
        expect(result.params).toEqual(['%John%']);
    });

    test('$notLike - NOT LIKE 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ name$notLike: '%spam%' });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`name` NOT LIKE ?');
        expect(result.params).toEqual(['%spam%']);
    });

    test('$gt - 大于', () => {
        const builder = new SqlBuilder().from('users').where({ age$gt: 18 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` > ?');
        expect(result.params).toEqual([18]);
    });

    test('$gte - 大于等于', () => {
        const builder = new SqlBuilder().from('users').where({ age$gte: 18 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` >= ?');
        expect(result.params).toEqual([18]);
    });

    test('$lt - 小于', () => {
        const builder = new SqlBuilder().from('users').where({ age$lt: 65 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` < ?');
        expect(result.params).toEqual([65]);
    });

    test('$lte - 小于等于', () => {
        const builder = new SqlBuilder().from('users').where({ age$lte: 65 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` <= ?');
        expect(result.params).toEqual([65]);
    });

    test('$between - BETWEEN 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ age$between: [18, 65] });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` BETWEEN ? AND ?');
        expect(result.params).toEqual([18, 65]);
    });

    test('$notBetween - NOT BETWEEN 操作�?, () => {
        const builder = new SqlBuilder().from('users').where({ age$notBetween: [0, 17] });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` NOT BETWEEN ? AND ?');
        expect(result.params).toEqual([0, 17]);
    });

    test('$null - IS NULL', () => {
        const builder = new SqlBuilder().from('users').where({ deleted_at$null: true });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`deleted_at` IS NULL');
        expect(result.params).toEqual([]);
    });

    test('$notNull - IS NOT NULL', () => {
        const builder = new SqlBuilder().from('users').where({ email$notNull: true });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`email` IS NOT NULL');
        expect(result.params).toEqual([]);
    });
});

describe('SqlBuilder - WHERE 方法 - 操作符（嵌套格式�?, () => {
    test('应该支持嵌套的操作符对象', () => {
        const builder = new SqlBuilder().from('users').where({ age: { $gt: 18, $lt: 65 } });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`age` > ?');
        expect(result.sql).toContain('`age` < ?');
        expect(result.params).toEqual([18, 65]);
    });

    test('应该支持混合一级和嵌套格式', () => {
        const builder = new SqlBuilder().from('users').where({
            status$ne: 'deleted',
            age: { $gte: 18 }
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`status` != ?');
        expect(result.sql).toContain('`age` >= ?');
        expect(result.params).toEqual(['deleted', 18]);
    });
});

describe('SqlBuilder - WHERE 方法 - 逻辑操作�?, () => {
    test('$and - AND 逻辑', () => {
        const builder = new SqlBuilder().from('users').where({
            $and: [{ status: 'active' }, { age: { $gte: 18 } }]
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`status` = ?');
        expect(result.sql).toContain('`age` >= ?');
        expect(result.params).toEqual(['active', 18]);
    });

    test('$or - OR 逻辑', () => {
        const builder = new SqlBuilder().from('users').where({
            $or: [{ role: 'admin' }, { role: 'editor' }]
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('(`role` = ?) OR (`role` = ?)');
        expect(result.params).toEqual(['admin', 'editor']);
    });

    test('$or - 复杂�?OR 条件', () => {
        const builder = new SqlBuilder().from('users').where({
            $or: [{ status: 'active', age$gte: 18 }, { role: 'admin' }]
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('OR');
        expect(result.params).toEqual(['active', 18, 'admin']);
    });

    test('混合 AND �?OR', () => {
        const builder = new SqlBuilder().from('users').where({
            status: 'active',
            $or: [{ role: 'admin' }, { role: 'editor' }]
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`status` = ?');
        expect(result.sql).toContain('OR');
        expect(result.params).toEqual(['active', 'admin', 'editor']);
    });
});

describe('SqlBuilder - WHERE 方法 - 参数验证', () => {
    test('undefined/null 值时应该作为原始 SQL 字符串处�?, () => {
        // �?value �?undefined �?null 时，condition 会被当作原始 SQL 字符�?        const builder = new SqlBuilder().from('users').where('status', undefined);
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT * FROM `users` WHERE status');
        expect(result.params).toEqual([]);
    });

    test('$in 应该拒绝非数组�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.where({ role$in: 'admin' });
        }).toThrow();
    });

    test('$nin 应该拒绝非数组�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.where({ role$nin: 'guest' });
        }).toThrow();
    });
});

describe('SqlBuilder - LEFT JOIN 方法', () => {
    test('应该添加 LEFT JOIN', () => {
        const builder = new SqlBuilder().from('users').leftJoin('orders', 'orders.user_id = users.id');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LEFT JOIN `orders` ON orders.user_id = users.id');
    });

    test('应该支持多个 LEFT JOIN', () => {
        const builder = new SqlBuilder().from('users').leftJoin('orders', 'orders.user_id = users.id').leftJoin('profiles', 'profiles.user_id = users.id');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LEFT JOIN `orders`');
        expect(result.sql).toContain('LEFT JOIN `profiles`');
    });

    test('应该拒绝非字符串参数', () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.leftJoin(123, 'condition');
        }).toThrow();
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.leftJoin('orders', 123);
        }).toThrow();
    });
});

describe('SqlBuilder - ORDER BY 方法', () => {
    test('应该支持单个排序字段', () => {
        const builder = new SqlBuilder().from('users').orderBy(['id#ASC']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('ORDER BY `id` ASC');
    });

    test('应该支持多个排序字段', () => {
        const builder = new SqlBuilder().from('users').orderBy(['status#DESC', 'created_at#ASC']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('ORDER BY `status` DESC, `created_at` ASC');
    });

    test('应该支持 DESC 排序', () => {
        const builder = new SqlBuilder().from('users').orderBy(['id#DESC']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('ORDER BY `id` DESC');
    });

    test('应该拒绝非数组输�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.orderBy('id#ASC');
        }).toThrow();
    });

    test('应该拒绝不包�?# 的字符串', () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.orderBy(['id ASC']);
        }).toThrow();
        expect(() => {
            builder.orderBy(['id ASC']);
        }).toThrow(/字段#方向/);
    });

    test('应该拒绝空字段名', () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.orderBy(['#ASC']);
        }).toThrow();
    });

    test('应该拒绝无效的排序方�?, () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.orderBy(['id#INVALID']);
        }).toThrow();
        expect(() => {
            builder.orderBy(['id#INVALID']);
        }).toThrow(/ASC �?DESC/);
    });

    test('应该自动转换排序方向为大�?, () => {
        const builder = new SqlBuilder().from('users').orderBy(['id#asc', 'name#desc']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('ORDER BY `id` ASC, `name` DESC');
    });

    test('应该自动 trim 字段名和方向', () => {
        const builder = new SqlBuilder().from('users').orderBy(['  id  #  ASC  ']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('ORDER BY `id` ASC');
    });
});

describe('SqlBuilder - GROUP BY 方法', () => {
    test('应该支持单个字段', () => {
        const builder = new SqlBuilder().from('orders').groupBy('user_id');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('GROUP BY `user_id`');
    });

    test('应该支持字段数组', () => {
        const builder = new SqlBuilder().from('orders').groupBy(['user_id', 'status']);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('GROUP BY `user_id`, `status`');
    });

    test('应该支持链式调用', () => {
        const builder = new SqlBuilder().from('orders').groupBy('user_id').groupBy('status');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('GROUP BY `user_id`, `status`');
    });
});

describe('SqlBuilder - HAVING 方法', () => {
    test('应该添加 HAVING 条件', () => {
        const builder = new SqlBuilder().from('orders').groupBy('user_id').having('COUNT(*) > 5');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('HAVING COUNT(*) > 5');
    });

    test('应该支持多个 HAVING 条件', () => {
        const builder = new SqlBuilder().from('orders').groupBy('user_id').having('COUNT(*) > 5').having('SUM(amount) > 1000');
        const result = builder.toSelectSql();
        expect(result.sql).toContain('HAVING COUNT(*) > 5 AND SUM(amount) > 1000');
    });
});

describe('SqlBuilder - LIMIT �?OFFSET 方法', () => {
    test('应该添加 LIMIT', () => {
        const builder = new SqlBuilder().from('users').limit(10);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LIMIT 10');
    });

    test('应该�?LIMIT 方法中同时设�?OFFSET', () => {
        const builder = new SqlBuilder().from('users').limit(10, 20);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LIMIT 10 OFFSET 20');
    });

    test('应该单独设置 OFFSET', () => {
        const builder = new SqlBuilder().from('users').limit(10).offset(20);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LIMIT 10 OFFSET 20');
    });

    test('应该拒绝负数 LIMIT', () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            builder.limit(-1);
        }).toThrow();
    });

    test('应该拒绝负数 OFFSET', () => {
        const builder = new SqlBuilder().from('users').limit(10);
        expect(() => {
            builder.offset(-1);
        }).toThrow();
    });

    test('应该拒绝非数�?LIMIT', () => {
        const builder = new SqlBuilder().from('users');
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.limit('10');
        }).toThrow();
    });

    test('应该向下取整 LIMIT', () => {
        const builder = new SqlBuilder().from('users').limit(10.7);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('LIMIT 10');
    });

    test('应该向下取整 OFFSET', () => {
        const builder = new SqlBuilder().from('users').limit(10).offset(20.9);
        const result = builder.toSelectSql();
        expect(result.sql).toContain('OFFSET 20');
    });
});

describe('SqlBuilder - toSelectSql 方法', () => {
    test('应该构建基本�?SELECT 查询', () => {
        const builder = new SqlBuilder().from('users');
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT * FROM `users`');
        expect(result.params).toEqual([]);
    });

    test('应该构建�?WHERE 的查�?, () => {
        const builder = new SqlBuilder().from('users').where({ id: 1 });
        const result = builder.toSelectSql();
        expect(result.sql).toBe('SELECT * FROM `users` WHERE `id` = ?');
        expect(result.params).toEqual([1]);
    });

    test('应该构建完整的查询（包含所有子句）', () => {
        const builder = new SqlBuilder().select(['id', 'name', 'COUNT(*) as order_count']).from('users').leftJoin('orders', 'orders.user_id = users.id').where({ status$ne: 'deleted' }).groupBy('users.id').having('COUNT(*) > 5').orderBy(['order_count#DESC']).limit(10).offset(20);

        const result = builder.toSelectSql();
        expect(result.sql).toContain('SELECT');
        expect(result.sql).toContain('FROM `users`');
        expect(result.sql).toContain('LEFT JOIN');
        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('GROUP BY');
        expect(result.sql).toContain('HAVING');
        expect(result.sql).toContain('ORDER BY');
        expect(result.sql).toContain('LIMIT 10 OFFSET 20');
    });

    test('应该拒绝没有 FROM 的查�?, () => {
        const builder = new SqlBuilder().select('id');
        expect(() => {
            builder.toSelectSql();
        }).toThrow();
        expect(() => {
            builder.toSelectSql();
        }).toThrow(/FROM 表名是必需�?);
    });
});

describe('SqlBuilder - toInsertSql 方法', () => {
    test('应该构建单条插入语句', () => {
        const builder = new SqlBuilder();
        const result = builder.toInsertSql('users', { name: 'John', age: 30 });
        expect(result.sql).toBe('INSERT INTO `users` (`name`, `age`) VALUES (?, ?)');
        expect(result.params).toEqual(['John', 30]);
    });

    test('应该构建批量插入语句', () => {
        const builder = new SqlBuilder();
        const result = builder.toInsertSql('users', [
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 }
        ]);
        expect(result.sql).toBe('INSERT INTO `users` (`name`, `age`) VALUES (?, ?), (?, ?)');
        expect(result.params).toEqual(['John', 30, 'Jane', 25]);
    });

    test('应该转义字段�?, () => {
        const builder = new SqlBuilder();
        const result = builder.toInsertSql('users', { user_name: 'John' });
        expect(result.sql).toContain('`user_name`');
    });

    test('应该拒绝空表�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toInsertSql('', { name: 'John' });
        }).toThrow();
    });

    test('应该拒绝非字符串表名', () => {
        const builder = new SqlBuilder();
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.toInsertSql(123, { name: 'John' });
        }).toThrow();
    });

    test('应该拒绝空数�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.toInsertSql('users', null);
        }).toThrow();
    });

    test('应该拒绝空数�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toInsertSql('users', []);
        }).toThrow();
    });

    test('应该拒绝没有字段的对�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toInsertSql('users', {});
        }).toThrow();
    });

    test('应该拒绝数组中第一个对象没有字�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toInsertSql('users', [{}]);
        }).toThrow();
    });
});

describe('SqlBuilder - toUpdateSql 方法', () => {
    test('应该构建 UPDATE 语句', () => {
        const builder = new SqlBuilder().where({ id: 1 });
        const result = builder.toUpdateSql('users', { name: 'John', age: 30 });
        expect(result.sql).toBe('UPDATE `users` SET `name` = ?, `age` = ? WHERE `id` = ?');
        expect(result.params).toEqual(['John', 30, 1]);
    });

    test('应该转义字段�?, () => {
        const builder = new SqlBuilder().where({ id: 1 });
        const result = builder.toUpdateSql('users', { user_name: 'John' });
        expect(result.sql).toContain('`user_name`');
    });

    test('应该拒绝没有 WHERE 条件', () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toUpdateSql('users', { name: 'John' });
        }).toThrow(/WHERE 条件/);
    });

    test('应该拒绝空表�?, () => {
        const builder = new SqlBuilder().where({ id: 1 });
        expect(() => {
            builder.toUpdateSql('', { name: 'John' });
        }).toThrow(/表名/);
    });

    test('应该拒绝空数�?, () => {
        const builder = new SqlBuilder().where({ id: 1 });
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.toUpdateSql('users', null);
        }).toThrow(/数据/);
    });

    test('应该拒绝数组数据', () => {
        const builder = new SqlBuilder().where({ id: 1 });
        expect(() => {
            // @ts-expect-error - 测试错误输入
            builder.toUpdateSql('users', [{ name: 'John' }]);
        }).toThrow(/数据/);
    });

    test('应该拒绝没有字段的对�?, () => {
        const builder = new SqlBuilder().where({ id: 1 });
        expect(() => {
            builder.toUpdateSql('users', {});
        }).toThrow(/至少有一个字�?);
    });
});

describe('SqlBuilder - toDeleteSql 方法', () => {
    test('应该构建 DELETE 语句', () => {
        const builder = new SqlBuilder().where({ id: 1 });
        const result = builder.toDeleteSql('users');
        expect(result.sql).toBe('DELETE FROM `users` WHERE `id` = ?');
        expect(result.params).toEqual([1]);
    });

    test('应该拒绝没有 WHERE 条件', () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toDeleteSql('users');
        }).toThrow(/WHERE 条件/);
    });

    test('应该拒绝空表�?, () => {
        const builder = new SqlBuilder().where({ id: 1 });
        expect(() => {
            builder.toDeleteSql('');
        }).toThrow(/表名/);
    });
});

describe('SqlBuilder - toCountSql 方法', () => {
    test('应该构建 COUNT 查询', () => {
        const builder = new SqlBuilder().from('users');
        const result = builder.toCountSql();
        expect(result.sql).toBe('SELECT COUNT(*) as total FROM `users`');
        expect(result.params).toEqual([]);
    });

    test('应该支持�?WHERE �?COUNT', () => {
        const builder = new SqlBuilder().from('users').where({ status: 'active' });
        const result = builder.toCountSql();
        expect(result.sql).toBe('SELECT COUNT(*) as total FROM `users` WHERE `status` = ?');
        expect(result.params).toEqual(['active']);
    });

    test('应该支持�?JOIN �?COUNT', () => {
        const builder = new SqlBuilder().from('users').leftJoin('orders', 'orders.user_id = users.id');
        const result = builder.toCountSql();
        expect(result.sql).toContain('LEFT JOIN');
    });

    test('应该拒绝没有 FROM 的查�?, () => {
        const builder = new SqlBuilder();
        expect(() => {
            builder.toCountSql();
        }).toThrow(/FROM 表名/);
    });
});

describe('SqlBuilder - getWhereConditions 方法', () => {
    test('应该返回 WHERE 条件和参�?, () => {
        const builder = new SqlBuilder().where({ id: 1, status: 'active' });
        const result = builder.getWhereConditions();
        expect(result.sql).toBe('`id` = ? AND `status` = ?');
        expect(result.params).toEqual([1, 'active']);
    });

    test('没有条件时应该返回空字符�?, () => {
        const builder = new SqlBuilder();
        const result = builder.getWhereConditions();
        expect(result.sql).toBe('');
        expect(result.params).toEqual([]);
    });

    test('应该返回参数副本（不影响原数组）', () => {
        const builder = new SqlBuilder().where({ id: 1 });
        const result = builder.getWhereConditions();
        result.params.push(999);

        const result2 = builder.getWhereConditions();
        expect(result2.params).toEqual([1]);
    });
});

describe('SqlBuilder - 链式调用', () => {
    test('所有方法都应该返回 this', () => {
        const builder = new SqlBuilder();

        expect(builder.select('id')).toBe(builder);
        expect(builder.from('users')).toBe(builder);
        expect(builder.where({ id: 1 })).toBe(builder);
        expect(builder.leftJoin('orders', 'orders.user_id = users.id')).toBe(builder);
        expect(builder.orderBy(['id#ASC'])).toBe(builder);
        expect(builder.groupBy('status')).toBe(builder);
        expect(builder.having('COUNT(*) > 0')).toBe(builder);
        expect(builder.limit(10)).toBe(builder);
        expect(builder.offset(20)).toBe(builder);
        expect(builder.reset()).toBe(builder);
    });

    test('应该支持完整的链式调�?, () => {
        const result = new SqlBuilder().select(['id', 'name']).from('users').where({ status: 'active' }).orderBy(['id#DESC']).limit(10).toSelectSql();

        expect(result.sql).toContain('SELECT');
        expect(result.sql).toContain('FROM');
        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('ORDER BY');
        expect(result.sql).toContain('LIMIT');
    });
});

describe('SqlBuilder - 边界情况和特殊场�?, () => {
    test('应该处理包含特殊字符的�?, () => {
        const builder = new SqlBuilder().from('users').where({ name: "O'Brien" });
        const result = builder.toSelectSql();
        expect(result.params).toEqual(["O'Brien"]);
    });

    test('应该处理 null �?, () => {
        const builder = new SqlBuilder().from('users').where({ deleted_at: null });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`deleted_at` = ?');
        expect(result.params).toEqual([null]);
    });

    test('应该处理数字 0', () => {
        const builder = new SqlBuilder().from('users').where({ status: 0 });
        const result = builder.toSelectSql();
        expect(result.params).toEqual([0]);
    });

    test('应该处理空字符串', () => {
        const builder = new SqlBuilder().from('users').where({ description: '' });
        const result = builder.toSelectSql();
        expect(result.params).toEqual(['']);
    });

    test('应该处理 false �?, () => {
        const builder = new SqlBuilder().from('users').where({ is_active: false });
        const result = builder.toSelectSql();
        expect(result.params).toEqual([false]);
    });

    test('应该处理包含多个 $ 的字段名', () => {
        const builder = new SqlBuilder().from('users').where({ price$usd$gt: 100 });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('`price$usd` > ?');
        expect(result.params).toEqual([100]);
    });

    test('应该处理非常长的 IN 列表', () => {
        const ids = Array.from({ length: 100 }, (_, i) => i + 1);
        const builder = new SqlBuilder().from('users').where({ id$in: ids });
        const result = builder.toSelectSql();
        expect(result.params).toEqual(ids);
        expect(result.sql).toContain('IN');
    });

    test('应该处理复杂的嵌�?OR 条件', () => {
        const builder = new SqlBuilder().from('users').where({
            status: 'active',
            $or: [{ age$gte: 18, age$lt: 65 }, { role: 'admin' }, { permissions$in: ['manage_users', 'view_reports'] }]
        });
        const result = builder.toSelectSql();
        expect(result.sql).toContain('OR');
        expect(result.params.length).toBeGreaterThan(0);
    });
});

describe('SqlBuilder - 实际使用场景', () => {
    test('场景1：用户列表查询（分页、筛选、排序）', () => {
        const result = new SqlBuilder()
            .select(['id', 'username', 'email', 'created_at'])
            .from('users')
            .where({
                status: 'active',
                created_at$gte: '2024-01-01'
            })
            .orderBy(['created_at#DESC'])
            .limit(20)
            .offset(40)
            .toSelectSql();

        expect(result.sql).toContain('SELECT');
        expect(result.sql).toContain('WHERE');
        expect(result.sql).toContain('ORDER BY');
        expect(result.sql).toContain('LIMIT 20 OFFSET 40');
    });

    test('场景2：订单统计（JOIN + GROUP BY + HAVING�?, () => {
        const result = new SqlBuilder().select(['users.id', 'users.name', 'COUNT(*) as order_count', 'SUM(orders.amount) as total_amount']).from('users').leftJoin('orders', 'orders.user_id = users.id').where({ 'orders.status': 'completed' }).groupBy(['users.id', 'users.name']).having('COUNT(*) >= 5').orderBy(['total_amount#DESC']).limit(10).toSelectSql();

        expect(result.sql).toContain('LEFT JOIN');
        expect(result.sql).toContain('GROUP BY');
        expect(result.sql).toContain('HAVING');
    });

    test('场景3：高级搜索（多条�?OR�?, () => {
        const keyword = 'john';
        const result = new SqlBuilder()
            .from('users')
            .where({
                $or: [{ username$like: `%${keyword}%` }, { email$like: `%${keyword}%` }, { phone$like: `%${keyword}%` }]
            })
            .toSelectSql();

        expect(result.sql).toContain('OR');
        expect(result.params).toEqual([`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]);
    });

    test('场景4：批量插入用�?, () => {
        const users = [
            { username: 'john', email: 'john@example.com', age: 30 },
            { username: 'jane', email: 'jane@example.com', age: 25 },
            { username: 'bob', email: 'bob@example.com', age: 35 }
        ];

        const result = new SqlBuilder().toInsertSql('users', users);

        expect(result.sql).toContain('VALUES');
        expect(result.sql).toContain('(?, ?, ?), (?, ?, ?), (?, ?, ?)');
        expect(result.params.length).toBe(9);
    });

    test('场景5：更新用户信�?, () => {
        const result = new SqlBuilder().where({ id: 123 }).toUpdateSql('users', {
            username: 'john_updated',
            email: 'john.new@example.com',
            updated_at: Date.now()
        });

        expect(result.sql).toContain('UPDATE');
        expect(result.sql).toContain('SET');
        expect(result.sql).toContain('WHERE');
        expect(result.params[3]).toBe(123);
    });

    test('场景6：软删除（更�?deleted_at�?, () => {
        const result = new SqlBuilder().where({ id$in: [1, 2, 3, 4, 5] }).toUpdateSql('users', { deleted_at: Date.now() });

        expect(result.sql).toContain('UPDATE');
        expect(result.sql).toContain('WHERE `id` IN');
    });

    test('场景7：硬删除', () => {
        const result = new SqlBuilder().where({ deleted_at$notNull: true }).toDeleteSql('users');

        expect(result.sql).toBe('DELETE FROM `users` WHERE `deleted_at` IS NOT NULL');
    });

    test('场景8：统计符合条件的记录�?, () => {
        const result = new SqlBuilder()
            .from('users')
            .where({
                status: 'active',
                age$gte: 18
            })
            .toCountSql();

        expect(result.sql).toBe('SELECT COUNT(*) as total FROM `users` WHERE `status` = ? AND `age` >= ?');
        expect(result.params).toEqual(['active', 18]);
    });
});

describe('SqlBuilder - 错误码验�?, () => {
    test('参数错误应该返回 DB_INVALID_PARAMS', () => {
        const builder = new SqlBuilder().from('users');
        try {
            builder.where('status', undefined);
        } catch (error: any) {
            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe(DB_ERROR_CODES.INVALID_PARAMS);
        }
    });

    test('表名错误应该返回 DB_INVALID_TABLE_NAME', () => {
        const builder = new SqlBuilder();
        try {
            builder.from('');
        } catch (error: any) {
            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe(DB_ERROR_CODES.INVALID_TABLE_NAME);
        }
    });

    test('字段名错误应该返�?DB_INVALID_FIELD_NAME', () => {
        const builder = new SqlBuilder().from('users');
        try {
            builder.orderBy(['#ASC']);
        } catch (error: any) {
            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe(DB_ERROR_CODES.INVALID_FIELD_NAME);
        }
    });
});
