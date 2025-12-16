/**
 * 进程角色信息
 */
export interface ProcessRole {
    /** 进程角色：primary（主进程）或 worker（工作进程） */
    role: 'primary' | 'worker';
    /** 实例 ID（PM2 或 Bun Worker） */
    instanceId: string | null;
    /** 运行环境：bun-cluster、pm2-cluster 或 standalone */
    env: 'bun-cluster' | 'pm2-cluster' | 'standalone';
}

/**
 * 获取当前进程角色信息
 * @returns 进程角色、实例 ID 和运行环境
 */
export function getProcessRole(): ProcessRole {
    const bunWorkerId = process.env.BUN_WORKER_ID;
    const pm2InstanceId = process.env.PM2_INSTANCE_ID;

    // Bun 集群模式
    if (bunWorkerId !== undefined) {
        return {
            role: bunWorkerId === '' ? 'primary' : 'worker',
            instanceId: bunWorkerId || '0',
            env: 'bun-cluster'
        };
    }

    // PM2 集群模式
    if (pm2InstanceId !== undefined) {
        return {
            role: pm2InstanceId === '0' ? 'primary' : 'worker',
            instanceId: pm2InstanceId,
            env: 'pm2-cluster'
        };
    }

    // 单进程模式
    return {
        role: 'primary',
        instanceId: null,
        env: 'standalone'
    };
}

/**
 * 检测当前进程是否为主进程
 * 用于集群模式下避免重复执行同步任务
 * - Bun 集群：BUN_WORKER_ID 为空时是主进程
 * - PM2 集群：PM2_INSTANCE_ID 为 '0' 或不存在时是主进程
 * @returns 是否为主进程
 */
export function isPrimaryProcess(): boolean {
    return getProcessRole().role === 'primary';
}
