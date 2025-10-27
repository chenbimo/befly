/**
 * Cluster Manager - 集群管理器
 * 负责多进程启动、自动重启、优雅关闭
 */

import { join } from 'node:path';
import type { Subprocess } from 'bun';
import { Logger } from '../utils/logger.js';

export interface ClusterOptions {
    /** 实例数量（数字或 'max'） */
    instances: number | 'max';
    /** 起始端口 */
    startPort: number;
    /** 主机地址 */
    host: string;
    /** 项目根目录 */
    projectRoot: string;
    /** main.ts 文件路径 */
    mainFile: string;
    /** 环境变量 */
    env?: Record<string, string>;
}

interface WorkerInfo {
    id: number;
    port: number;
    process: Subprocess;
    restartCount: number;
    lastRestartTime: number;
}

export class ClusterManager {
    private workers: Map<number, WorkerInfo> = new Map();
    private isShuttingDown = false;
    private readonly MAX_RESTARTS = 10; // 最大重启次数
    private readonly RESTART_DELAY = 1000; // 重启延迟（毫秒）
    private readonly RESTART_WINDOW = 60000; // 重启计数窗口（1分钟）

    constructor(private options: ClusterOptions) {}

    /**
     * 启动集群
     */
    async start(): Promise<void> {
        const instances = this.getInstanceCount();
        const { startPort, host } = this.options;

        Logger.info(`启动集群模式: ${instances} 个实例\n`);
        Logger.info(`端口范围: ${startPort} - ${startPort + instances - 1}`);
        Logger.info(`主机地址: ${host}`);
        Logger.info(`环境: production\n`);

        // 启动所有 Worker
        for (let i = 0; i < instances; i++) {
            const port = startPort + i;
            this.spawnWorker(i, port);
        }

        // 监听进程信号
        this.setupSignalHandlers();

        Logger.info(`集群启动成功！\n`);
        this.printWorkerStatus();
    }

    /**
     * 获取实例数量
     */
    private getInstanceCount(): number {
        const { instances } = this.options;

        if (instances === 'max') {
            return navigator.hardwareConcurrency || 4;
        }

        const count = typeof instances === 'string' ? parseInt(instances) : instances;

        if (isNaN(count) || count < 1) {
            Logger.warn(`无效的实例数量 "${instances}"，使用默认值 4`);
            return 4;
        }

        return count;
    }

    /**
     * 启动单个 Worker
     */
    private spawnWorker(id: number, port: number): void {
        const { projectRoot, mainFile, host, env = {} } = this.options;

        Logger.info(`启动 Worker ${id} (端口 ${port})...`);

        // 检查环境变量文件
        const envFile = join(projectRoot, '.env.production');

        const proc = Bun.spawn(['bun', 'run', '--env-file=.env.production', mainFile], {
            cwd: projectRoot,
            stdout: 'inherit',
            stderr: 'inherit',
            stdin: 'inherit',
            env: {
                ...process.env,
                ...env,
                NODE_ENV: 'production',
                APP_PORT: port.toString(),
                APP_HOST: host,
                CLUSTER_MODE: '1',
                CLUSTER_WORKER_ID: id.toString(),
                CLUSTER_INSTANCES: this.getInstanceCount().toString(),
                FORCE_COLOR: '1'
            }
        });

        // 保存 Worker 信息
        this.workers.set(id, {
            id,
            port,
            process: proc,
            restartCount: 0,
            lastRestartTime: 0
        });

        // 监听进程退出
        this.watchWorker(id, port);
    }

    /**
     * 监听 Worker 退出并自动重启
     */
    private async watchWorker(id: number, port: number): Promise<void> {
        const worker = this.workers.get(id);
        if (!worker) return;

        const exitCode = await worker.process.exited;

        // 如果正在关闭，不重启
        if (this.isShuttingDown) {
            Logger.info(`Worker ${id} (端口 ${port}) 已退出`);
            return;
        }

        Logger.warn(`Worker ${id} (端口 ${port}) 异常退出，退出码: ${exitCode}`);

        // 检查重启次数
        if (!this.canRestart(worker)) {
            Logger.error(`Worker ${id} 重启次数过多，停止重启`);
            return;
        }

        // 延迟重启
        Logger.info(`${this.RESTART_DELAY / 1000} 秒后重启 Worker ${id}...`);
        await Bun.sleep(this.RESTART_DELAY);

        // 更新重启计数
        this.updateRestartCount(worker);

        // 重新启动
        this.spawnWorker(id, port);
    }

    /**
     * 检查是否可以重启
     */
    private canRestart(worker: WorkerInfo): boolean {
        const now = Date.now();
        const timeSinceLastRestart = now - worker.lastRestartTime;

        // 如果距离上次重启超过窗口期，重置计数
        if (timeSinceLastRestart > this.RESTART_WINDOW) {
            worker.restartCount = 0;
        }

        return worker.restartCount < this.MAX_RESTARTS;
    }

    /**
     * 更新重启计数
     */
    private updateRestartCount(worker: WorkerInfo): void {
        worker.restartCount++;
        worker.lastRestartTime = Date.now();
    }

    /**
     * 设置信号处理器
     */
    private setupSignalHandlers(): void {
        const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

        signals.forEach((signal) => {
            process.on(signal, () => {
                this.gracefulShutdown(signal);
            });
        });
    }

    /**
     * 优雅关闭
     */
    private async gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        Logger.info(`\n收到 ${signal} 信号，正在关闭集群...`);

        // 向所有 Worker 发送 SIGTERM
        for (const [id, worker] of this.workers.entries()) {
            Logger.info(`关闭 Worker ${id} (端口 ${worker.port})...`);
            worker.process.kill('SIGTERM');
        }

        // 等待所有进程退出，最多 5 秒
        const timeout = setTimeout(() => {
            Logger.warn('等待超时，强制关闭所有 Worker');
            for (const worker of this.workers.values()) {
                worker.process.kill('SIGKILL');
            }
            process.exit(1);
        }, 5000);

        // 等待所有进程退出
        await Promise.all(Array.from(this.workers.values()).map((w) => w.process.exited));

        clearTimeout(timeout);
        Logger.info('集群已安全关闭');
        process.exit(0);
    }

    /**
     * 打印 Worker 状态
     */
    private printWorkerStatus(): void {
        Logger.info('Worker 列表:');
        for (const worker of this.workers.values()) {
            Logger.info(`  - Worker ${worker.id}: http://${this.options.host}:${worker.port}`);
        }
        Logger.info('');
    }
}
