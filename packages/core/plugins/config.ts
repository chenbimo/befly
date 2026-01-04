/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import type { BeflyContext } from "../types/befly.ts";
import type { Plugin } from "../types/plugin.ts";

export default {
    deps: [],
    handler: (context: BeflyContext) => {
        return context.config;
    }
} satisfies Plugin;
