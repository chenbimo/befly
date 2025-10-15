/**
 * Addon 插件示例
 * 用于扩展 befly 对象功能
 */

import type { BeflyPlugin, BeflyContext } from 'befly/types';
import { Logger } from 'befly';

export default {
    name: 'example', // 实际插件名会是：{addonName}.example
    version: '1.0.0',
    priority: 100, // 优先级（数字越大越先加载）

    /**
     * 插件加载时执行
     */
    async onLoad(befly: BeflyContext) {
        Logger.info('Addon 示例插件加载中...');
    },

    /**
     * 插件初始化时执行
     * 这里可以扩展 befly 对象
     */
    async onInit(befly: BeflyContext) {
        // 扩展 befly 对象
        return {
            // 添加自定义方法或属性
            sayHello: (name: string) => {
                return `Hello, ${name}!`;
            },

            // 添加配置
            config: {
                apiKey: process.env.ADDON_API_KEY || '',
                timeout: 30000
            }
        };
    }
} as BeflyPlugin;
