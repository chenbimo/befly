/**
 * 钩子加载器
 * 只加载核心钩子
 */

// 相对导入
import { Logger } from '../lib/logger.js';
import { coreHookDir } from '../paths.js';
import { scanModules } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

export async function loadHooks(befly: {
    //
    hookLists: Hook[];
    pluginsConfig?: Record<string, any>;
}): Promise<void> {
    try {
        // 1. 扫描核心钩子
        const coreHooks = await scanModules<Hook>(coreHookDir, 'core', '钩子', befly.pluginsConfig);

        // 2. 过滤禁用的钩子
        const disableHooks = (befly as any).config?.disableHooks || [];
        const enabledHooks = coreHooks.filter((hook) => !disableHooks.includes(hook.name));

        if (disableHooks.length > 0) {
            Logger.info(`禁用钩子: ${disableHooks.join(', ')}`);
        }

        // 3. 按 order 排序
        const sortedHooks = enabledHooks.sort((a, b) => {
            const orderA = a.order ?? 999;
            const orderB = b.order ?? 999;
            return orderA - orderB;
        });

        befly.hookLists.push(...sortedHooks);
    } catch (error: any) {
        Logger.error('加载钩子时发生错误', error);
        process.exit(1);
    }
}
