/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

export default {
    name: "config",
    enable: true,
    deps: [],
    handler: (context: BeflyContext) => {
        return context.config;
    }
} satisfies Plugin;
