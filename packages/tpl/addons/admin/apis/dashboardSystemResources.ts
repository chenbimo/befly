/**
 * 获取系统资源使用情况
 */

import { Yes } from 'befly';
import os from 'node:os';

export default {
    name: '获取系统资源',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // CPU 使用率
        const cpus = os.cpus();
        const cpuCount = cpus.length;
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const cpuUsage = Math.round(((totalTick - totalIdle) / totalTick) * 100);

        // 内存使用率
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryPercentage = Math.round((usedMem / totalMem) * 100);

        // 磁盘使用率（示例数据，实际需要使用 node-disk-info 等库）
        const diskPercentage = 50;
        const diskUsed = 256;
        const diskTotal = 512;

        return Yes('获取成功', {
            cpu: {
                usage: cpuUsage,
                cores: cpuCount
            },
            memory: {
                used: (usedMem / 1024 / 1024 / 1024).toFixed(1),
                total: (totalMem / 1024 / 1024 / 1024).toFixed(1),
                percentage: memoryPercentage
            },
            disk: {
                used: diskUsed,
                total: diskTotal,
                percentage: diskPercentage
            }
        });
    }
};
