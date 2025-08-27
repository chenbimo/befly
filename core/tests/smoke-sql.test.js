import { test, expect } from 'bun:test';
import { SQL } from 'bun';

// 无条件、无环境变量的冒烟：断言使用无效配置时连接失败
test('SQL 客户端使用无效 URL 连接应失败（不依赖环境变量）', async () => {
    const sql = new SQL({ url: 'mysql://u:p@127.0.0.1:1/db', max: 1, bigint: true });
    let error = null;
    try {
        await sql`SELECT 1`;
    } catch (e) {
        error = e;
    } finally {
        try {
            await sql.close();
        } catch {}
    }
    expect(!!error).toBe(true);
});
