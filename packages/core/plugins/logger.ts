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
    async handler(befly: BeflyContext) {
        // 配置 Logger
        if (befly.config && befly.config.logger) {
            Logger.configure(befly.config.logger);
        }
        return Logger;
    }
};

export default loggerPlugin;
