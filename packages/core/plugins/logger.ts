/**
 * 日志插件
 * 提供全局日志功能
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { Logger } from "../lib/logger.js";

/**
 * 日志插件
 */
export default {
    deps: [],
    async handler(context: BeflyContext): Promise<typeof Logger> {
        // 配置 Logger
        if (context.config && context.config.logger) {
            Logger.configure(context.config.logger);
        }
        return Logger;
    }
} satisfies Plugin;
