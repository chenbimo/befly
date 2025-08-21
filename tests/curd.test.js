/**
 * CURD 数据库操作测试套件
 * 测试 SqlBuilder 类和 DatabaseManager 类的所有功能
 */

import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createQueryBuilder, SqlBuilder } from '../utils/curd.js';

describe('SqlBuilder 基础功能测试', () => {
    let builder;

    beforeEach(() => {
        builder = new SqlBuilder();
    });

    test('创建 SqlBuilder 实例', () => {
        expect(builder).toBeInstanceOf(SqlBuilder);
        expect(builder._select).toEqual([]);
        expect(builder._from).toBe('');
        expect(builder._where).toEqual([]);
    });

    test('createQueryBuilder 工厂函数', () => {
        const queryBuilder = createQueryBuilder();
        expect(queryBuilder).toBeInstanceOf(SqlBuilder);
    });
});

describe('SELECT 查询构建测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('基础 SELECT 查询', () => {
        const { sql, params } = builder.select('*').from('users').toSelectSql();

        expect(sql).toBe('SELECT * FROM `users`');
        expect(params).toEqual([]);
    });

    test('指定字段 SELECT 查询', () => {
        const { sql, params } = builder.select(['id', 'name', 'email']).from('users').toSelectSql();

        expect(sql).toBe('SELECT `id`, `name`, `email` FROM `users`');
        expect(params).toEqual([]);
    });

    test('添加多个字段', () => {
        const { sql, params } = builder.select('id').select(['name', 'email']).select('created_at').from('users').toSelectSql();

        expect(sql).toBe('SELECT `id`, `name`, `email`, `created_at` FROM `users`');
        expect(params).toEqual([]);
    });

    test('FROM 表名验证', () => {
        expect(() => {
            builder.from('').toSelectSql();
        }).toThrow('FROM table must be a non-empty string');

        expect(() => {
            builder.from('   ').toSelectSql();
        }).toThrow('FROM table must be a non-empty string');
    });
});

describe('WHERE 条件测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select('*').from('users');
    });

    test('简单等于条件', () => {
        const { sql, params } = builder.where({ name: 'John', status: 1 }).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `name` = ? AND `status` = ?');
        expect(params).toEqual(['John', 1]);
    });

    test('一级属性格式 - 比较操作符', () => {
        const { sql, params } = builder
            .where({
                age$gt: 18,
                score$gte: 60,
                level$lt: 10,
                points$lte: 1000,
                status$ne: 0
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `age` > ? AND `score` >= ? AND `level` < ? AND `points` <= ? AND `status` != ?');
        expect(params).toEqual([18, 60, 10, 1000, 0]);
    });

    test('一级属性格式 - IN 和 NOT IN', () => {
        const { sql, params } = builder
            .where({
                role$in: ['admin', 'user'],
                status$nin: [0, -1]
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `role` IN (?,?) AND `status` NOT IN (?,?)');
        expect(params).toEqual(['admin', 'user', 0, -1]);
    });

    test('一级属性格式 - LIKE 操作符', () => {
        const { sql, params } = builder
            .where({
                name$like: '%john%',
                email$notLike: '%@temp.com'
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `name` LIKE ? AND `email` NOT LIKE ?');
        expect(params).toEqual(['%john%', '%@temp.com']);
    });

    test('一级属性格式 - BETWEEN 操作符', () => {
        const { sql, params } = builder
            .where({
                age$between: [18, 65],
                score$notBetween: [0, 59]
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `age` BETWEEN ? AND ? AND `score` NOT BETWEEN ? AND ?');
        expect(params).toEqual([18, 65, 0, 59]);
    });

    test('一级属性格式 - NULL 检查', () => {
        const { sql, params } = builder
            .where({
                deleted_at$null: true,
                email$notNull: true
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `deleted_at` IS NULL AND `email` IS NOT NULL');
        expect(params).toEqual([]);
    });

    test('混合条件测试', () => {
        const { sql, params } = builder
            .where({
                status: 1,
                age$gte: 18,
                role$in: ['admin', 'user'],
                name$like: '%john%'
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND `age` >= ? AND `role` IN (?,?) AND `name` LIKE ?');
        expect(params).toEqual([1, 18, 'admin', 'user', '%john%']);
    });

    test('undefined 值过滤', () => {
        const { sql, params } = builder
            .where({
                status: 1,
                age$gt: 18,
                name$like: undefined, // 应该被忽略
                role$in: ['admin', 'user']
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND `age` > ? AND `role` IN (?,?)');
        expect(params).toEqual([1, 18, 'admin', 'user']);
    });

    test('字符串 WHERE 条件', () => {
        const { sql, params } = builder.where('id = 1').toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE id = 1');
        expect(params).toEqual([]);
    });

    test('链式 WHERE 条件', () => {
        const { sql, params } = builder.where('status', 1).where({ age$gte: 18 }).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND `age` >= ?');
        expect(params).toEqual([1, 18]);
    });
});

describe('OR 条件测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select('*').from('users');
    });

    test('简单 OR 条件', () => {
        const { sql, params } = builder
            .where({
                status: 1,
                $or: [{ role: 'admin' }, { level$gte: 5 }]
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND ((`role` = ?) OR (`level` >= ?))');
        expect(params).toEqual([1, 'admin', 5]);
    });

    test('复杂 OR 条件', () => {
        const { sql, params } = builder
            .where({
                $or: [{ role: 'admin' }, { permissions$like: '%manage%' }, { level$gte: 10 }]
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE ((`role` = ?) OR (`permissions` LIKE ?) OR (`level` >= ?))');
        expect(params).toEqual(['admin', '%manage%', 10]);
    });

    test('AND 和 OR 组合', () => {
        const { sql, params } = builder
            .where({
                $and: [
                    { status: 1 },
                    {
                        $or: [{ role: 'admin' }, { level$gte: 5 }]
                    }
                ]
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND ((`role` = ?) OR (`level` >= ?))');
        expect(params).toEqual([1, 'admin', 5]);
    });
});

describe('JOIN 操作测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select('*').from('users u');
    });

    test('单个 LEFT JOIN', () => {
        const { sql, params } = builder.leftJoin('user_profiles up', 'u.id = up.user_id').toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` u LEFT JOIN `user_profiles` up ON u.id = up.user_id');
        expect(params).toEqual([]);
    });

    test('多个 LEFT JOIN', () => {
        const { sql, params } = builder.leftJoin('user_profiles up', 'u.id = up.user_id').leftJoin('posts p', 'u.id = p.user_id').leftJoin('categories c', 'p.category_id = c.id').toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` u LEFT JOIN `user_profiles` up ON u.id = up.user_id LEFT JOIN `posts` p ON u.id = p.user_id LEFT JOIN `categories` c ON p.category_id = c.id');
        expect(params).toEqual([]);
    });

    test('JOIN 带 WHERE 条件', () => {
        const { sql, params } = builder.leftJoin('user_profiles up', 'u.id = up.user_id').where({ 'u.status': 1, 'up.verified': true }).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` u LEFT JOIN `user_profiles` up ON u.id = up.user_id WHERE `u`.`status` = ? AND `up`.`verified` = ?');
        expect(params).toEqual([1, true]);
    });
});

describe('ORDER BY 测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select('*').from('users');
    });

    test('一维数组格式排序', () => {
        const { sql, params } = builder.orderBy(['created_at#DESC', 'name#ASC', 'id#DESC']).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` ORDER BY `created_at` DESC, `name` ASC, `id` DESC');
        expect(params).toEqual([]);
    });

    test('单个字段排序', () => {
        const { sql, params } = builder.orderBy(['name#ASC']).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` ORDER BY `name` ASC');
        expect(params).toEqual([]);
    });

    test('无效格式验证 - 非数组', () => {
        expect(() => {
            builder.orderBy('name#ASC').toSelectSql();
        }).toThrow('orderBy must be an array of strings in "field#direction" format');
    });

    test('无效格式验证 - 缺少排序方向', () => {
        expect(() => {
            builder.orderBy(['name']).toSelectSql();
        }).toThrow('orderBy field must be a string in "field#direction" format');
    });

    test('无效格式验证 - 无效排序方向', () => {
        expect(() => {
            builder.orderBy(['name#INVALID']).toSelectSql();
        }).toThrow('ORDER BY direction must be ASC or DESC');
    });

    test('无效格式验证 - 空字段名', () => {
        expect(() => {
            builder.orderBy(['#ASC']).toSelectSql();
        }).toThrow('Field name cannot be empty in orderBy');
    });

    test('大小写不敏感', () => {
        const { sql, params } = builder.orderBy(['name#asc', 'id#desc']).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` ORDER BY `name` ASC, `id` DESC');
        expect(params).toEqual([]);
    });
});

describe('GROUP BY 和 HAVING 测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select(['role', 'COUNT(*) as count']).from('users');
    });

    test('GROUP BY 单个字段', () => {
        const { sql, params } = builder.groupBy('role').toSelectSql();

        expect(sql).toBe('SELECT `role`, COUNT(*) as count FROM `users` GROUP BY `role`');
        expect(params).toEqual([]);
    });

    test('GROUP BY 多个字段', () => {
        const { sql, params } = builder.groupBy(['role', 'department']).toSelectSql();

        expect(sql).toBe('SELECT `role`, COUNT(*) as count FROM `users` GROUP BY `role`, `department`');
        expect(params).toEqual([]);
    });

    test('GROUP BY 和 HAVING', () => {
        const { sql, params } = builder.groupBy('role').having('COUNT(*) > 5').toSelectSql();

        expect(sql).toBe('SELECT `role`, COUNT(*) as count FROM `users` GROUP BY `role` HAVING COUNT(*) > 5');
        expect(params).toEqual([]);
    });

    test('多个 HAVING 条件', () => {
        const { sql, params } = builder.groupBy('role').having('COUNT(*) > 5').having('AVG(age) < 40').toSelectSql();

        expect(sql).toBe('SELECT `role`, COUNT(*) as count FROM `users` GROUP BY `role` HAVING COUNT(*) > 5 AND AVG(age) < 40');
        expect(params).toEqual([]);
    });
});

describe('LIMIT 和 OFFSET 测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder().select('*').from('users');
    });

    test('仅 LIMIT', () => {
        const { sql, params } = builder.limit(10).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` LIMIT 10');
        expect(params).toEqual([]);
    });

    test('LIMIT 和 OFFSET', () => {
        const { sql, params } = builder.limit(10, 20).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` LIMIT 10 OFFSET 20');
        expect(params).toEqual([]);
    });

    test('单独设置 OFFSET', () => {
        const { sql, params } = builder.limit(10).offset(30).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` LIMIT 10 OFFSET 30');
        expect(params).toEqual([]);
    });

    test('无效 LIMIT 值', () => {
        expect(() => {
            builder.limit(-1);
        }).toThrow('LIMIT count must be a non-negative number');

        expect(() => {
            builder.limit('invalid');
        }).toThrow('LIMIT count must be a non-negative number');
    });

    test('无效 OFFSET 值', () => {
        expect(() => {
            builder.offset(-1);
        }).toThrow('OFFSET must be a non-negative number');
    });
});

describe('复杂查询组合测试', () => {
    test('完整的复杂查询', () => {
        const { sql, params } = createQueryBuilder()
            .select(['u.id', 'u.name', 'u.email', 'up.avatar', 'COUNT(p.id) as post_count'])
            .from('users u')
            .leftJoin('user_profiles up', 'u.id = up.user_id')
            .leftJoin('posts p', 'u.id = p.user_id AND p.status = 1')
            .where({
                'u.status': 1,
                'u.created_at$gte': '2024-01-01',
                'u.role$in': ['admin', 'user']
            })
            .groupBy(['u.id'])
            .having('COUNT(p.id) > 0')
            .orderBy(['u.created_at#DESC', 'u.name#ASC'])
            .limit(50)
            .toSelectSql();

        const expectedSql = 'SELECT `u`.`id`, `u`.`name`, `u`.`email`, `up`.`avatar`, COUNT(p.id) as post_count FROM `users` u ' + 'LEFT JOIN `user_profiles` up ON u.id = up.user_id ' + 'LEFT JOIN `posts` p ON u.id = p.user_id AND p.status = 1 ' + 'WHERE `u`.`status` = ? AND `u`.`created_at` >= ? AND `u`.`role` IN (?,?) ' + 'GROUP BY `u`.`id` ' + 'HAVING COUNT(p.id) > 0 ' + 'ORDER BY `u`.`created_at` DESC, `u`.`name` ASC ' + 'LIMIT 50';

        expect(sql).toBe(expectedSql);
        expect(params).toEqual([1, '2024-01-01', 'admin', 'user']);
    });
});

describe('INSERT 查询构建测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('单条记录插入', () => {
        const data = { name: 'John', email: 'john@example.com', age: 25 };
        const { sql, params } = builder.toInsertSql('users', data);

        expect(sql).toBe('INSERT INTO `users` (`name`, `email`, `age`) VALUES (?, ?, ?)');
        expect(params).toEqual(['John', 'john@example.com', 25]);
    });

    test('批量插入', () => {
        const data = [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane', email: 'jane@example.com' },
            { name: 'Bob', email: 'bob@example.com' }
        ];
        const { sql, params } = builder.toInsertSql('users', data);

        expect(sql).toBe('INSERT INTO `users` (`name`, `email`) VALUES (?, ?), (?, ?), (?, ?)');
        expect(params).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com', 'Bob', 'bob@example.com']);
    });

    test('空数据验证', () => {
        expect(() => {
            builder.toInsertSql('users', []);
        }).toThrow('Insert data cannot be empty');

        expect(() => {
            builder.toInsertSql('users', {});
        }).toThrow('Insert data must have at least one field');
    });

    test('无效表名验证', () => {
        expect(() => {
            builder.toInsertSql('', { name: 'John' });
        }).toThrow('Table name is required for INSERT');
    });
});

describe('UPDATE 查询构建测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('基础更新', () => {
        const data = { name: 'Updated Name', email: 'updated@example.com' };
        const { sql, params } = builder.where({ id: 1 }).toUpdateSql('users', data);

        expect(sql).toBe('UPDATE `users` SET `name` = ?, `email` = ? WHERE `id` = ?');
        expect(params).toEqual(['Updated Name', 'updated@example.com', 1]);
    });

    test('复杂条件更新', () => {
        const data = { status: 1, updated_at: new Date('2024-01-01') };
        const { sql, params } = builder.where({ age$gte: 18, role$in: ['user', 'admin'] }).toUpdateSql('users', data);

        expect(sql).toBe('UPDATE `users` SET `status` = ?, `updated_at` = ? WHERE `age` >= ? AND `role` IN (?,?)');
        expect(params).toEqual([1, new Date('2024-01-01'), 18, 'user', 'admin']);
    });

    test('无 WHERE 条件验证', () => {
        expect(() => {
            builder.toUpdateSql('users', { name: 'Updated' });
        }).toThrow('UPDATE requires WHERE condition for safety');
    });

    test('空数据验证', () => {
        expect(() => {
            builder.where({ id: 1 }).toUpdateSql('users', {});
        }).toThrow('Update data must have at least one field');
    });
});

describe('DELETE 查询构建测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('基础删除', () => {
        const { sql, params } = builder.where({ id: 1 }).toDeleteSql('users');

        expect(sql).toBe('DELETE FROM `users` WHERE `id` = ?');
        expect(params).toEqual([1]);
    });

    test('复杂条件删除', () => {
        const { sql, params } = builder.where({ status$in: [0, -1], created_at$lt: '2023-01-01' }).toDeleteSql('users');

        expect(sql).toBe('DELETE FROM `users` WHERE `status` IN (?,?) AND `created_at` < ?');
        expect(params).toEqual([0, -1, '2023-01-01']);
    });

    test('无 WHERE 条件验证', () => {
        expect(() => {
            builder.toDeleteSql('users');
        }).toThrow('DELETE requires WHERE condition for safety');
    });
});

describe('COUNT 查询构建测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('基础计数', () => {
        const { sql, params } = builder.from('users').where({ status: 1 }).toCountSql();

        expect(sql).toBe('SELECT COUNT(*) as total FROM `users` WHERE `status` = ?');
        expect(params).toEqual([1]);
    });

    test('带 JOIN 的计数', () => {
        const { sql, params } = builder.from('users u').leftJoin('user_profiles up', 'u.id = up.user_id').where({ 'u.status': 1, 'up.verified': true }).toCountSql();

        expect(sql).toBe('SELECT COUNT(*) as total FROM `users` u LEFT JOIN `user_profiles` up ON u.id = up.user_id WHERE `u`.`status` = ? AND `up`.`verified` = ?');
        expect(params).toEqual([1, true]);
    });

    test('无 FROM 表验证', () => {
        expect(() => {
            builder.toCountSql();
        }).toThrow('FROM table is required for COUNT');
    });
});

describe('参数验证测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('undefined 参数验证', () => {
        // 当在对象形式的where条件中使用undefined时，会被忽略
        const { sql, params } = builder.select('*').from('users').where({ name: undefined, status: 1 }).toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ?');
        expect(params).toEqual([1]);
    });

    test('字段验证', () => {
        // 空数组select应该正常工作，会使用默认的*
        const { sql } = builder.select([]).from('users').toSelectSql();
        expect(sql).toBe('SELECT * FROM `users`');
    });

    test('表名验证', () => {
        expect(() => {
            builder.select('*').from(null);
        }).toThrow('FROM table must be a non-empty string');

        expect(() => {
            builder.select('*').from(123);
        }).toThrow('FROM table must be a non-empty string');
    });
});

describe('重置功能测试', () => {
    test('reset 方法', () => {
        const builder = createQueryBuilder().select(['id', 'name']).from('users').where({ status: 1 }).orderBy(['name#ASC']).limit(10);

        // 重置前有内容
        expect(builder._select.length).toBeGreaterThan(0);
        expect(builder._from).toBeTruthy();
        expect(builder._where.length).toBeGreaterThan(0);

        // 重置后清空
        builder.reset();
        expect(builder._select).toEqual([]);
        expect(builder._from).toBe('');
        expect(builder._where).toEqual([]);
        expect(builder._joins).toEqual([]);
        expect(builder._orderBy).toEqual([]);
        expect(builder._groupBy).toEqual([]);
        expect(builder._having).toEqual([]);
        expect(builder._limit).toBeNull();
        expect(builder._offset).toBeNull();
        expect(builder._params).toEqual([]);
    });
});

describe('边界条件和错误处理测试', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    test('空数组 IN 条件', () => {
        const { sql, params } = builder.select('*').from('users').where({ role$in: [] }).toSelectSql();

        // 空数组应该被忽略
        expect(sql).toBe('SELECT * FROM `users`');
        expect(params).toEqual([]);
    });

    test('无效 BETWEEN 条件', () => {
        const { sql, params } = builder
            .select('*')
            .from('users')
            .where({ age$between: [18] }) // 只有一个值
            .toSelectSql();

        // 无效的 BETWEEN 应该被忽略
        expect(sql).toBe('SELECT * FROM `users`');
        expect(params).toEqual([]);
    });

    test('NULL 检查的非布尔值', () => {
        const { sql, params } = builder.select('*').from('users').where({ deleted_at$null: 'not_boolean' }).toSelectSql();

        // 非布尔值的 NULL 检查应该被忽略
        expect(sql).toBe('SELECT * FROM `users`');
        expect(params).toEqual([]);
    });

    test('混合有效和无效条件', () => {
        const { sql, params } = builder
            .select('*')
            .from('users')
            .where({
                status: 1, // 有效
                role$in: [], // 无效，应被忽略
                age$gt: 18, // 有效
                deleted_at$null: 'invalid' // 无效，应被忽略
            })
            .toSelectSql();

        expect(sql).toBe('SELECT * FROM `users` WHERE `status` = ? AND `age` > ?');
        expect(params).toEqual([1, 18]);
    });
});

describe('链式调用测试', () => {
    test('所有方法都返回 this 以支持链式调用', () => {
        const builder = createQueryBuilder();

        expect(builder.select('*')).toBe(builder);
        expect(builder.from('users')).toBe(builder);
        expect(builder.where({ status: 1 })).toBe(builder);
        expect(builder.leftJoin('profiles', 'users.id = profiles.user_id')).toBe(builder);
        expect(builder.orderBy(['name#ASC'])).toBe(builder);
        expect(builder.groupBy('role')).toBe(builder);
        expect(builder.having('COUNT(*) > 1')).toBe(builder);
        expect(builder.limit(10)).toBe(builder);
        expect(builder.offset(20)).toBe(builder);
        expect(builder.reset()).toBe(builder);
    });

    test('长链式调用', () => {
        const { sql, params } = createQueryBuilder().select(['u.*', 'p.title']).from('users u').leftJoin('posts p', 'u.id = p.user_id').where({ 'u.status': 1 }).where({ 'p.published': true }).orderBy(['u.created_at#DESC']).limit(20).toSelectSql();

        expect(sql).toBe('SELECT `u`.*, `p`.`title` FROM `users` u LEFT JOIN `posts` p ON u.id = p.user_id WHERE `u`.`status` = ? AND `p`.`published` = ? ORDER BY `u`.`created_at` DESC LIMIT 20');
        expect(params).toEqual([1, true]);
    });
});
