/**
 * 获取运行环境信息
 */

import { Yes } from '../../util.js';
import os from 'node:os';

export default {
    name: '获取运行环境信息',
    handler: async (befly, ctx) => {
        // 获取数据库版本
        let databaseVersion = 'Unknown';
        try {
            const versionResult = await befly.db.query({
                sql: 'SELECT VERSION() as version',
                type: 'one'
            });
            databaseVersion = versionResult.version || 'Unknown';
        } catch (error) {
            // 忽略错误
        }

        // 获取 Redis 版本
        let redisVersion = '未配置';
        if (befly.redis) {
            try {
                const info = await befly.redis.info('server');
                const match = info.match(/redis_version:([^\r\n]+)/);
                if (match) {
                    redisVersion = match[1];
                }
            } catch (error) {
                redisVersion = '未知';
            }
        }

        return Yes('获取成功', {
            os: `${os.type()} ${os.arch()}`,
            server: `${os.platform()} ${os.release()}`,
            nodeVersion: process.version,
            database: `MySQL ${databaseVersion}`,
            cache: `Redis ${redisVersion}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }
};
