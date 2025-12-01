/**
 * 日志插件
 * 提供全局日志功能
 */

import { Logger } from '../lib/logger.js';
import { config } from '../config.js';

import type { Plugin } from '../types/plugin.js';

/**
 * 日志插件
 */
const loggerPlugin: Plugin = {
    after: [],
    async handler(): Promise<typeof Logger> {
        try {
            // 配置 Logger
            if (config.logger) {
                Logger.configure(config.logger);
            }
            return Logger;
        } catch (error: any) {
            throw error;
        }
    }
};

export default loggerPlugin;
