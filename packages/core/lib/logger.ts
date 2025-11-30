/**
 * 日志系统 - 基于 pino 实现
 */

import pino from 'pino';
import { join } from 'pathe';

import type { LoggerConfig } from 'befly-shared/types';

let instance: pino.Logger | null = null;
let mockInstance: pino.Logger | null = null;
let config: LoggerConfig = {
    debug: 0,
    dir: './logs',
    console: 1,
    maxSize: 10
};

/**
 * 配置日志
 */
export function configure(cfg: LoggerConfig): void {
    config = { ...config, ...cfg };
    instance = null;
}

/**
 * 设置 Mock Logger（用于测试）
 * @param mock - Mock pino 实例，传 null 清除 mock
 */
export function setMockLogger(mock: pino.Logger | null): void {
    mockInstance = mock;
}

/**
 * 获取 pino 日志实例
 */
export function getLogger(): pino.Logger {
    // 优先返回 mock 实例（用于测试）
    if (mockInstance) return mockInstance;

    if (instance) return instance;

    const level = config.debug === 1 ? 'debug' : 'info';
    const targets: pino.TransportTargetOptions[] = [];

    // 文件输出
    targets.push({
        target: 'pino-roll',
        level: level,
        options: {
            file: join(config.dir || './logs', 'app'),
            frequency: 'daily',
            size: `${config.maxSize || 10}m`,
            mkdir: true,
            dateFormat: 'yyyy-MM-dd'
        }
    });

    // 控制台输出
    if (config.console === 1) {
        targets.push({
            target: 'pino/file',
            level: level,
            options: { destination: 1 }
        });
    }

    instance = pino({
        level: level,
        transport: { targets: targets }
    });

    return instance;
}

/**
 * 日志实例（延迟初始化）
 */
export const Logger = {
    get info() {
        return getLogger().info.bind(getLogger());
    },
    get warn() {
        return getLogger().warn.bind(getLogger());
    },
    get error() {
        return getLogger().error.bind(getLogger());
    },
    get debug() {
        return getLogger().debug.bind(getLogger());
    },
    configure: configure,
    setMock: setMockLogger
};
