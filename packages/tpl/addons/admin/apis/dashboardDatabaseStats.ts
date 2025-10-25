/**
 * 获取数据库统计信息
 */

import { Yes } from 'befly';

export default {
    name: '获取数据库统计',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // 查询数据库大小（MySQL）
        const dbSize = await befly.db.query({
            sql: `SELECT
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
                FROM information_schema.TABLES
                WHERE table_schema = DATABASE()`,
            type: 'one'
        });

        // 查询表数量
        const tableCount = await befly.db.query({
            sql: `SELECT COUNT(*) as count
                FROM information_schema.TABLES
                WHERE table_schema = DATABASE()`,
            type: 'one'
        });

        // 查询总记录数（示例：统计几个主要表）
        const recordCount = await befly.db.query({
            sql: `SELECT
                (SELECT COUNT(*) FROM addon_admin_menu) +
                (SELECT COUNT(*) FROM addon_admin_role) +
                (SELECT COUNT(*) FROM addon_admin_api) +
                (SELECT COUNT(*) FROM addon_admin_admin) as total`,
            type: 'one'
        });

        // 查询连接数（MySQL）
        const connections = await befly.db.query({
            sql: 'SHOW STATUS LIKE "Threads_connected"',
            type: 'one'
        });

        return Yes('获取成功', {
            dbSize: dbSize.size_mb || 0,
            tableCount: tableCount.count || 0,
            recordCount: recordCount.total || 0,
            connections: parseInt(connections?.Value || '0')
        });
    }
};
