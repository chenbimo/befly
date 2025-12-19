/**
 * 钩子加载器
 * 默认只加载核心钩子
 * 可选：通过配置开启组件/项目钩子（默认关闭以保持稳定性与可预期性）
 */

// 类型导入
import type { Hook } from "../types/hook.js";

import { beflyConfig } from "../befly.config.js";
import { Logger } from "../lib/logger.js";
import { coreHookDir, projectHookDir } from "../paths.js";
// 相对导入
import { scanAddons } from "../utils/addonHelper.js";
import { scanModules } from "../utils/modules.js";

export async function loadHooks(hooks: Hook[]): Promise<void> {
    try {
        const allHooks: Hook[] = [];

        // 1. 扫描核心钩子
        const coreHooks = await scanModules<Hook>(coreHookDir, "core", "钩子");
        allHooks.push(...coreHooks);

        // 2. 可选：扫描组件钩子（默认关闭）
        const enableAddonHooks = Boolean((beflyConfig as any).enableAddonHooks);
        if (enableAddonHooks) {
            const addonHooks: Hook[] = [];
            const addons = scanAddons();
            for (const addon of addons) {
                const dir = addon.dirs.hooksDir;
                if (!dir) continue;
                const items = await scanModules<Hook>(dir, "addon", "钩子", addon.name);
                addonHooks.push(...items);
            }
            allHooks.push(...addonHooks);
        }

        // 3. 可选：扫描项目钩子（默认关闭）
        const enableAppHooks = Boolean((beflyConfig as any).enableAppHooks);
        if (enableAppHooks) {
            const appHooks = await scanModules<Hook>(projectHookDir, "app", "钩子");
            allHooks.push(...appHooks);
        }

        // 4. 过滤禁用的钩子
        const disableHooks = beflyConfig.disableHooks || [];
        const enabledHooks = allHooks.filter((hook) => hook.name && !disableHooks.includes(hook.name));

        if (disableHooks.length > 0) {
            Logger.info({ hooks: disableHooks }, "禁用钩子");
        }

        // 5. 按 order 排序
        const sortedHooks = enabledHooks.sort((a, b) => {
            const orderA = a.order ?? 999;
            const orderB = b.order ?? 999;
            return orderA - orderB;
        });

        hooks.push(...sortedHooks);
    } catch (error: any) {
        Logger.error({ err: error }, "加载钩子时发生错误");
        process.exit(1);
    }
}
