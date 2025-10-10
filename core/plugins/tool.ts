/**
 * Tool 插件 - TypeScript 版本
 * 提供数据处理工具
 */

import { Tool } from '../utils/tool.js';
import { Logger } from '../utils/logger.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * Tool 插件
 */
const toolPlugin: Plugin = {
    name: '_tool',
    after: ['_redis', '_db'],

    async onInit(befly: BeflyContext): Promise<Tool> {
        try {
            const tool = new Tool(befly);
            Logger.info('Tool 插件初始化成功');
            return tool;
        } catch (error: any) {
            Logger.error({
                msg: 'Tool 初始化失败',
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
};

export default toolPlugin;
