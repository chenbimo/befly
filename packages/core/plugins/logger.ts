/**
 * 日志插件
 * 提供全局日志功能
 */

import { Logger } from '../lib/logger.js';
import { beflyConfig } from '../befly.config.js';

import type { Plugin } from '../types/plugin.js';

/**
 * 日志插件
 */
const loggerPlugin: Plugin = {
    after: [],
    async handler(): Promise<typeof Logger> {
        // 配置 Logger
        if (beflyConfig.logger) {
            Logger.configure(beflyConfig.logger);
        }
        return Logger;
    }
};

export default loggerPlugin;
