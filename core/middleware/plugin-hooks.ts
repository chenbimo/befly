/**
 * 插件钩子中间件
 * 执行插件的请求处理钩子
 */

import { Logger } from '../utils/logger.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

export interface HookContext {
    headers: Record<string, string>;
    body: any;
    user: any;
}

/**
 * 执行所有插件的onGet钩子
 */
export async function executePluginHooks(pluginLists: Plugin[], appContext: BeflyContext, ctx: HookContext, req: Request): Promise<void> {
    for await (const plugin of pluginLists) {
        try {
            if (typeof plugin?.onGet === 'function') {
                await plugin?.onGet(appContext, ctx, req);
            }
        } catch (error: any) {
            Logger.error({
                msg: '插件处理请求时发生错误',
                error: error.message,
                stack: error.stack
            });
        }
    }
}
