/**
 * 获取系统配置状态
 */

import { Yes } from '../../util.js';

export default {
    name: '获取配置状态',
    handler: async (befly, ctx) => {
        const status = {
            database: { status: 'ok', latency: 0 },
            redis: { status: 'ok', latency: 0 },
            fileSystem: { status: 'ok' },
            email: { status: 'warning', message: '未配置' },
            oss: { status: 'warning', message: '未配置' }
        };

        // 检查数据库连接
        try {
            const startTime = Date.now();
            await befly.db.query('SELECT 1');
            status.database.latency = Date.now() - startTime;
            status.database.status = 'ok';
        } catch (error) {
            status.database.status = 'error';
            status.database.message = '连接失败';
        }

        // 检查 Redis 连接
        try {
            const startTime = Date.now();
            await befly.redis.ping();
            status.redis.latency = Date.now() - startTime;
            status.redis.status = 'ok';
        } catch (error) {
            status.redis.status = 'error';
            status.redis.message = '连接失败';
        }

        // 检查邮件配置
        if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
            status.email.status = 'ok';
            status.email.message = '已配置';
        }

        // 检查 OSS 配置
        if (process.env.OSS_ACCESS_KEY && process.env.OSS_SECRET_KEY) {
            status.oss.status = 'ok';
            status.oss.message = '已配置';
        }

        return Yes('获取成功', status);
    }
};
