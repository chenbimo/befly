/**
 * 日志插件 - TypeScript 版本
 * 提供全局日志功能
 */

import { Logger } from '../lib/logger.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 日志插件
 */
const loggerPlugin: Plugin = {
    after: [],
    async handler(this: Plugin, befly: BeflyContext): Promise<typeof Logger> {
        try {
            // 配置 Logger
            if (this.config) {
                Logger.configure(this.config);
            }
            return Logger;
        } catch (error: any) {
            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default loggerPlugin;
