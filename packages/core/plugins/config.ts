/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

const configPlugin: Plugin = {
    name: "config",
    enable: true,
    deps: [],
    handler: (befly: BeflyContext) => {
        return befly.config;
    }
};

export default configPlugin;
