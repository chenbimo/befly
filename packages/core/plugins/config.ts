/**
 * 配置插件
 * 提供访问项目配置的能力
 */
import { beflyConfig } from '../befly.config.js';

import type { Plugin } from '../types/plugin.js';

const plugin: Plugin = {
    handler: () => {
        return beflyConfig;
    }
};

export default plugin;
