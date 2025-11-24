/**
 * 钩子加载器
 * 负责扫描和初始化所有钩子（核心、组件、项目）
 */

// 外部依赖
import { scanAddons, getAddonDir } from 'befly-util';

// 相对导入
import { Logger } from '../lib/logger.js';
import { coreHookDir, projectHookDir } from '../paths.js';
import { sortModules, scanModules } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

export async function loadHooks(befly: {
    //
    hookLists: Hook[];
    pluginsConfig?: Record<string, any>;
}): Promise<void> {
    try {
        const allHooks: Hook[] = [];

        // 1. 扫描核心钩子
        const coreHooks = await scanModules<Hook>(coreHookDir, 'core', '钩子', befly.pluginsConfig);

        // 2. 扫描组件钩子
        const addonHooks: Hook[] = [];
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = getAddonDir(addon, 'hooks');
            const hooks = await scanModules<Hook>(dir, 'addon', '钩子', befly.pluginsConfig, addon);
            addonHooks.push(...hooks);
        }

        // 3. 扫描项目钩子
        const appHooks = await scanModules<Hook>(projectHookDir, 'app', '钩子', befly.pluginsConfig);

        // 4. 合并所有钩子
        allHooks.push(...coreHooks);
        allHooks.push(...addonHooks);
        allHooks.push(...appHooks);

        // 5. 排序
        const sortedHooks = sortModules(allHooks);
        if (sortedHooks === false) {
            Logger.error('钩子依赖关系错误，请检查 after 属性');
            process.exit(1);
        }

        befly.hookLists.push(...sortedHooks);
    } catch (error: any) {
        Logger.error('加载钩子时发生错误', error);
        process.exit(1);
    }
}
