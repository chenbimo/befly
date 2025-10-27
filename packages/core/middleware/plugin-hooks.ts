/**
 * 插件钩子中间件
 * 执行插件的请求处理钩子
 */

import { Logger } from '../lib/logger.js';;
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';
import type { RequestContext } from '../types/context.js';

/**
 * 执行所有插件的onGet钩子
 */
export async function executePluginHooks(pluginLists: Plugin[], appContext: BeflyContext, ctx: RequestContext): Promise<void> {
    for await (const plugin of pluginLists) {
        try {
            if (typeof plugin?.onGet === 'function') {
                await plugin?.onGet(appContext, ctx, ctx.request);
            }
        } catch (error: any) {
            Logger.error('插件处理请求时发生错误', error);
        }
    }
}
