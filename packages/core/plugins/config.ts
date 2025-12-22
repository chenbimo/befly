/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import type { Plugin } from "../types/plugin.js";

import { beflyConfig } from "../befly.config.js";

export default {
    deps: [],
    handler: () => {
        return beflyConfig;
    }
} as Plugin;
