/**
 * 钩子加载器
 * 默认加载所有来源钩子（core/addon/app）
 * 可通过 disableHooks 禁用指定钩子
 */

// 类型导入
import type { Hook } from "../types/hook.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { sortModules } from "../utils/sortModules.js";

export async function loadHooks(hookItems: ScanFileResult[], disableHooks: string[] = []): Promise<Hook[]> {
    const loadedHooks: Hook[] = [];

    if (disableHooks.length > 0) {
        Logger.info({ hooks: disableHooks }, "禁用钩子");
    }

    const enabledHookItems = hookItems.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }

        if (disableHooks.includes(moduleName)) {
            return false;
        }

        return true;
    });

    const sortedHookItems = sortModules(enabledHookItems, { moduleLabel: "钩子" });
    if (sortedHookItems === false) {
        throw new Error("钩子依赖关系错误");
    }

    for (const item of sortedHookItems) {
        const hookName = (item as any).moduleName as string;
        const hook = item as any as Hook;

        loadedHooks.push({
            name: hookName,
            deps: hook.deps,
            handler: hook.handler
        });
    }

    return loadedHooks;
}
