/**
 * 日志插件
 * 提供全局日志功能
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { Logger } from "../lib/logger";

/**
 * 日志插件
 */
export default {
    name: "logger",
    deps: [],
    async handler(context: BeflyContext): Promise<typeof Logger> {
        // 配置 Logger
        if (context.config && context.config.logger) {
            Logger.configure(context.config.logger);
        }
        return Logger;
    }
} satisfies Plugin;
