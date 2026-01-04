/**
 * 钩子加载器
 * 默认加载所有来源钩子（core/addon/app）
 * 可通过 disableHooks 禁用指定钩子
 */

// 类型导入
import type { Hook } from "../types/hook.ts";
import type { ScanFileResult } from "../utils/scanFiles.ts";

import { Logger } from "../lib/logger.ts";
import { sortModules } from "../utils/sortModules.ts";

export async function loadHooks(hooks: ScanFileResult[], disableHooks: string[] = []): Promise<Hook[]> {
    const hooksMap: Hook[] = [];

    if (disableHooks.length > 0) {
        Logger.info({ hooks: disableHooks }, "禁用钩子");
    }

    const enabledHooks = hooks.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }

        if (disableHooks.includes(moduleName)) {
            return false;
        }

        return true;
    });

    const sortedHooks = sortModules(enabledHooks, { moduleLabel: "钩子" });
    if (sortedHooks === false) {
        throw new Error("钩子依赖关系错误");
    }

    for (const item of sortedHooks) {
        const hookName = (item as any).moduleName as string;
        const hook = item as any as Hook;

        hooksMap.push({
            name: hookName,
            deps: hook.deps,
            handler: hook.handler
        });
    }

    return hooksMap;
}
