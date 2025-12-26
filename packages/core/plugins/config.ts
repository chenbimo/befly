/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

export default {
    deps: [],
    handler: (context: BeflyContext) => {
        return context.config;
    }
} satisfies Plugin;
