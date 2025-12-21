/**
 * 钩子加载器
 * 默认只加载核心钩子
 * 可选：通过配置开启组件/项目钩子（默认关闭以保持稳定性与可预期性）
 */

// 类型导入
import type { Hook } from "../types/hook.js";

import { beflyConfig } from "../befly.config.js";
import { Logger } from "../lib/logger.js";
import { coreHookDir, appHookDir } from "../paths.js";
import { scanModules } from "../utils/modules.js";
// 相对导入
import { scanAddons } from "../utils/scanAddons.js";

export async function loadHooks(hooks: Hook[]): Promise<void> {
    try {
        const allHooks: Hook[] = [];

        // 4. 过滤禁用的钩子
        const disableHooks = beflyConfig.disableHooks || [];
        const enabledHooks = allHooks.filter((hook) => hook.name && !disableHooks.includes(hook.name));

        if (disableHooks.length > 0) {
            Logger.info({ hooks: disableHooks }, "禁用钩子");
        }

        // 5. 按 order 排序
        const sortedHooks = enabledHooks.sort((a, b) => {
            const orderA = a.order ?? 999999;
            const orderB = b.order ?? 999999;
            return orderA - orderB;
        });

        hooks.push(...sortedHooks);
    } catch (error: any) {
        Logger.error({ err: error }, "加载钩子时发生错误");
        process.exit(1);
    }
}
