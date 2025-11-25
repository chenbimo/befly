/**
 * 配置插件
 * 提供访问项目配置的能力
 */

// 类型导入
import type { Plugin } from '../types/plugin.js';

const plugin: Plugin = {
    handler: (context, config) => {
        // 直接返回第二个参数中的配置
        return config || {};
    }
};

export default plugin;
