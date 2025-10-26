/**
 * 获取系统信息
 */

import { Yes } from 'befly';
import { version } from '../../../../../package.json';

export default {
    name: '获取系统信息',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // 系统启动时间（从进程启动时间计算）
        const startTime = Date.now() - Math.floor(process.uptime() * 1000);

        // 运行时长（毫秒）
        const uptime = Math.floor(process.uptime() * 1000);

        // 环境
        const environment = process.env.NODE_ENV || 'development';

        // 技术栈
        const techStack = ['Vue 3', 'TypeScript', 'TDesign', 'Vite 5', 'Befly', 'Bun', 'MySQL 8', 'Redis'];

        return Yes('获取成功', {
            systemName: 'Befly Admin',
            version: version,
            environment: environment,
            startTime: startTime,
            uptime: uptime,
            techStack: techStack
        });
    }
};
