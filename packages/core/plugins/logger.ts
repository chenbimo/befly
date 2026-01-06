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
const loggerPlugin: Plugin = {
    name: "logger",
    enable: true,
    deps: [],
    async handler(context: BeflyContext) {
        // 配置 Logger
        if (context.config && context.config.logger) {
            Logger.configure(context.config.logger);
        }
        return Logger;
    }
};

export default loggerPlugin;
