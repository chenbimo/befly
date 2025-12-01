/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import { config } from '../config.js';

import type { Plugin } from '../types/plugin.js';

const plugin: Plugin = {
    handler: () => {
        return config;
    }
};

export default plugin;
