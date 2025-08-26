import { test, expect } from 'bun:test';
import { SqlBuilder } from '../utils/sqlBuilder.js';

test('字段转义 - 别名与函数保留', () => {
    const b = new SqlBuilder();
    const { sql } = b.select(['users.name AS n', 'COUNT(*) as c', '*']).from('users u').toSelectSql();
    expect(sql.includes('`users`.`name` AS n')).toBe(true);
    expect(sql.includes('COUNT(*) as c')).toBe(true);
});

test('orderBy 错误分支覆盖 - 非数组', () => {
    const b = new SqlBuilder();
    expect(() => b.from('t').orderBy('created_at#DESC')).toThrow();
});

test('orderBy 错误分支覆盖 - 缺少方向', () => {
    const b = new SqlBuilder();
    expect(() => b.from('t').orderBy(['created_at'])).toThrow();
});

test('where 操作符 - notBetween/不添加空 IN', () => {
    const b = new SqlBuilder();
    const { sql, params } = b
        .select('*')
        .from('t')
        .where({ a$notBetween: [1, 2], b$in: [] })
        .toSelectSql();
    expect(sql.includes('`a` NOT BETWEEN ? AND ?')).toBe(true);
    expect(params).toEqual([1, 2]);
});
