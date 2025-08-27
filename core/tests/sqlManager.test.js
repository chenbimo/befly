import { test, expect } from 'bun:test';
import SqlManager from '../utils/sqlManager.js';

function makeSqlStub() {
    const calls = [];
    const selectResponses = [];

    function clientTag(strings, ...values) {
        const text = Array.isArray(strings) ? strings[0] : String(strings || '');
        if (/ROW_COUNT\(\)/i.test(text)) return Promise.resolve([{ affectedRows: clientTag._rowCount || 0 }]);
        if (/LAST_INSERT_ID\(\)/i.test(text)) return Promise.resolve([{ insertId: clientTag._insertId || 0 }]);
        return Promise.resolve([]);
    }

    clientTag._rowCount = 0;
    clientTag._insertId = 0;
    clientTag.calls = calls;
    clientTag.selectResponses = selectResponses;

    clientTag.unsafe = async (query, params = []) => {
        calls.push({ query, params });
        if (/^\s*(with|select|show|desc|explain)\b/i.test(query)) {
            return clientTag.selectResponses.length ? clientTag.selectResponses.shift() : [];
        }
        // write returns empty; ROW_COUNT/LAST_INSERT_ID handled by template tag calls
        return [];
    };

    clientTag.begin = async (cb) => cb(clientTag);

    clientTag.reserve = async () => {
        const runner = function (strings, ...values) {
            return clientTag(strings, ...values);
        };
        runner.unsafe = clientTag.unsafe;
        runner.release = () => {};
        return runner;
    };

    clientTag.close = async () => {};

    return clientTag;
}

test('getList 默认添加 state != 2 过滤', async () => {
    const sql = makeSqlStub();
    sql.selectResponses.push([{ id: 1 }], [{ total: 1 }]);
    const db = new SqlManager(sql);

    const res = await db.getList('users', { where: { name: 'A' }, page: 1, pageSize: 10 });
    expect(res.total).toBe(1);
    expect(Array.isArray(res.rows)).toBe(true);

    const selectCall = sql.calls.find((c) => /select/i.test(c.query));
    expect(selectCall.query.includes('`state` != ?')).toBe(true);
    expect(selectCall.params.includes(2)).toBe(true);
});

test('getList 指定 state 时不追加默认过滤', async () => {
    const sql = makeSqlStub();
    sql.selectResponses.push([{ id: 1 }], [{ total: 1 }]);
    const db = new SqlManager(sql);

    await db.getList('users', { where: { state: 1 }, page: 1, pageSize: 10 });
    const selectCall = sql.calls.find((c) => /select/i.test(c.query));
    expect(selectCall.query.includes('`state` != ?')).toBe(false);
});

test('insData 自动添加 id/state 与时间戳，并返回 insertId/affectedRows', async () => {
    const sql = makeSqlStub();
    sql._rowCount = 1;
    sql._insertId = 999;

    const fixedNow = 1730000000000;
    const realNow = Date.now;
    Date.now = () => fixedNow;
    const befly = { redis: { genTimeID: async () => 999 } };
    const db = new SqlManager(sql, befly);

    const ret = await db.insData('users', { name: 'x' });
    Date.now = realNow;

    expect(ret.insertId).toBe(999);
    expect(ret.affectedRows).toBe(1);
    const insertCall = sql.calls.find((c) => /insert\s+into/i.test(c.query));
    expect(insertCall).toBeTruthy();
    expect(insertCall.query.includes('`users`')).toBe(true);
    expect(insertCall.query.includes('`id`')).toBe(true);
    expect(insertCall.query.includes('`state`')).toBe(true);
    expect(insertCall.query.includes('`created_at`')).toBe(true);
    expect(insertCall.query.includes('`updated_at`')).toBe(true);
});

test('updData 过滤保留字段并追加 updated_at', async () => {
    const sql = makeSqlStub();
    sql._rowCount = 1;
    const fixedNow = 1730000001234;
    const realNow = Date.now;
    Date.now = () => fixedNow;
    const db = new SqlManager(sql);

    await db.updData('users', { id: 1, created_at: 1, deleted_at: 1, name: 'B' }, { id: 123 });
    Date.now = realNow;

    const updateCall = sql.calls.find((c) => /update\s+`users`\s+set/i.test(c.query));
    const setSection = updateCall.query.split(/\bwhere\b/i)[0];
    expect(setSection.includes('`name` = ?')).toBe(true);
    expect(setSection.includes('`updated_at` = ?')).toBe(true);
    expect(setSection.includes('`id` = ?')).toBe(false); // 不应在 SET 中出现 id
    expect(setSection.includes('`created_at` = ?')).toBe(false);
    expect(setSection.includes('`deleted_at` = ?')).toBe(false);
});

test('delData2 执行软删除（state=2，并更新 updated_at）', async () => {
    const sql = makeSqlStub();
    sql._rowCount = 1;
    const fixedNow = 1730000002222;
    const realNow = Date.now;
    Date.now = () => fixedNow;
    const db = new SqlManager(sql);

    await db.delData2('users', { id: 1 });
    Date.now = realNow;

    const updateCall = sql.calls.find((c) => /update\s+`users`\s+set/i.test(c.query));
    expect(updateCall.query.includes('`state` = ?')).toBe(true);
    expect(updateCall.query.includes('`updated_at` = ?')).toBe(true);
});

test('trans 事务封装可用（在回调中调用 getCount）', async () => {
    const sql = makeSqlStub();
    sql.selectResponses.push([{ total: 0 }]);
    const db = new SqlManager(sql);

    const result = await db.trans(async (tx) => {
        return await tx.getCount('users', {});
    });
    expect(result).toBe(0);
});

test('getDetail 支持 leftJoins（字符串与对象格式）', async () => {
    const sql = makeSqlStub();
    sql.selectResponses.push([{ id: 1, name: 'A' }]);
    const db = new SqlManager(sql);

    await db.getDetail('users u', {
        where: { 'u.id': 1 },
        fields: ['u.id', 'p.title'],
        leftJoins: ['posts p ON u.id = p.user_id', { table: 'profiles pf', on: 'pf.uid = u.id' }]
    });

    const selectCall = sql.calls.find((c) => /select/i.test(c.query));
    expect(selectCall.query.includes('LEFT JOIN `posts` p ON u.id = p.user_id')).toBe(true);
    expect(selectCall.query.includes('LEFT JOIN `profiles` pf ON pf.uid = u.id')).toBe(true);
});

test('getCount 计数时也包含 leftJoins', async () => {
    const sql = makeSqlStub();
    sql.selectResponses.push([{ id: 1 }], [{ total: 5 }]);
    const db = new SqlManager(sql);

    await db.getList('users u', {
        where: { 'u.state$gte': 0 },
        leftJoins: ['posts p ON u.id = p.user_id'],
        page: 1,
        pageSize: 10
    });

    const countCall = sql.calls.reverse().find((c) => /count\(/i.test(c.query));
    expect(countCall.query.includes('LEFT JOIN `posts` p ON u.id = p.user_id')).toBe(true);
});
