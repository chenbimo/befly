/**
 * 获取系统信息
 */

import { Yes } from 'befly';
import { Env } from '../../env.js';

export default {
    name: '获取系统信息',
    handler: async (befly, ctx) => {
        // 系统启动时间（从进程启动时间计算）
        const startTime = Date.now() - Math.floor(process.uptime() * 1000);

        // 运行时长（毫秒）
        const uptime = Math.floor(process.uptime() * 1000);

        // 环境
        const environment = Env.NODE_ENV || 'development';

        return Yes('获取成功', {
            environment: environment,
            startTime: startTime,
            uptime: uptime
        });
    }
};
