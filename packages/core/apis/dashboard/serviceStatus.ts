/**
 * 获取服务状态
 */

import { Yes } from '../../util.js';
import { Env } from '../../config/env.js';

export default {
    name: '获取服务状态',
    handler: async (befly, ctx) => {
        const services = [];

        // 数据库状态
        try {
            const startTime = Date.now();
            await befly.db.query('SELECT 1');
            const responseTime = Date.now() - startTime;
            services.push({
                name: '数据库',
                status: 'running',
                responseTime: `${responseTime}ms`
            });
        } catch (error) {
            befly.logger.error('数据库状态检测失败:', error);
            services.push({
                name: '数据库',
                status: 'stopped',
                responseTime: '-'
            });
        }

        // Redis 状态
        if (Env.REDIS_ENABLE === 1 && befly.redis) {
            try {
                const startTime = Date.now();
                await befly.redis.ping();
                const responseTime = Date.now() - startTime;
                services.push({
                    name: 'Redis',
                    status: 'running',
                    responseTime: `${responseTime}ms`
                });
            } catch (error) {
                befly.logger.error('Redis状态检测失败:', error);
                services.push({
                    name: 'Redis',
                    status: 'stopped',
                    responseTime: '-'
                });
            }
        } else {
            services.push({
                name: 'Redis',
                status: 'stopped',
                responseTime: '-'
            });
        }

        // 文件系统状态
        services.push({
            name: '文件系统',
            status: 'running',
            responseTime: '-'
        });

        // 邮件服务状态（示例）
        services.push({
            name: '邮件服务',
            status: 'unconfigured',
            responseTime: '-'
        });

        // OSS存储状态（示例）
        services.push({
            name: 'OSS存储',
            status: 'unconfigured',
            responseTime: '-'
        });

        return Yes('获取成功', { services });
    }
};
