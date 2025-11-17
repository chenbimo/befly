import os from 'node:os';
import fs from 'node:fs';
import { Yes } from 'befly';
import { promisify } from 'node:util';

export default {
    name: '获取系统资源',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // CPU 使用率
        const cpus = os.cpus();
        const cpuCount = cpus.length; // 逻辑核心数（包括超线程）

        // 计算 CPU 使用率（需要两次采样）
        // 第一次采样
        const startMeasure = cpus.map((cpu) => {
            let total = 0;
            for (const type in cpu.times) {
                total += cpu.times[type];
            }
            return {
                idle: cpu.times.idle,
                total
            };
        });

        // 等待 100ms
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 第二次采样
        const endCpus = os.cpus();
        const endMeasure = endCpus.map((cpu) => {
            let total = 0;
            for (const type in cpu.times) {
                total += cpu.times[type];
            }
            return {
                idle: cpu.times.idle,
                total
            };
        });

        // 计算平均 CPU 使用率
        let totalIdle = 0;
        let totalTick = 0;
        for (let i = 0; i < startMeasure.length; i++) {
            const idleDiff = endMeasure[i].idle - startMeasure[i].idle;
            const totalDiff = endMeasure[i].total - startMeasure[i].total;
            totalIdle += idleDiff;
            totalTick += totalDiff;
        }

        const cpuUsage = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0;

        // 内存使用率
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryPercentage = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

        // 磁盘使用率（使用 fs.statfs 获取当前工作目录所在磁盘）
        let diskPercentage = 0;
        let diskUsed = 0;
        let diskTotal = 0;

        try {
            // 检查是否有 statfs 方法（Node.js 19+ 或 Bun）
            if (fs.statfs) {
                const statfsAsync = promisify(fs.statfs);
                const stats = await statfsAsync(process.cwd());

                // 计算磁盘使用情况
                // bsize: 文件系统块大小
                // blocks: 总块数
                // bfree: 可用块数
                const totalSpace = stats.blocks * stats.bsize;
                const freeSpace = stats.bfree * stats.bsize;
                const usedSpace = totalSpace - freeSpace;

                if (totalSpace > 0) {
                    diskTotal = Math.round(totalSpace / 1024 / 1024 / 1024);
                    diskUsed = Math.round(usedSpace / 1024 / 1024 / 1024);
                    diskPercentage = Math.round((usedSpace / totalSpace) * 100);
                }
            } else {
                // statfs 不可用，返回默认值
                befly.logger.warn('fs.statfs 不可用，无法获取磁盘信息');
            }
        } catch (error) {
            befly.logger.warn('获取磁盘信息失败', error);
            // 获取失败时返回 0
            diskPercentage = 0;
            diskUsed = 0;
            diskTotal = 0;
        }

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
