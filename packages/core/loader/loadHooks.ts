/**
 * 钩子加载器
 * 默认加载所有来源钩子（core/addon/app）
 */

import type { Hook } from "../types/hook";
import type { ScanFileResult } from "../utils/scanFiles";

import { sortModules } from "../utils/sortModules";

export async function loadHooks(hooks: ScanFileResult[]): Promise<Hook[]> {
    const hooksMap: Hook[] = [];

    const enabledHooks = hooks.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }

        // enable=false 表示禁用（替代 disableHooks 列表）。
        // enable 仅允许 boolean；缺失 enable 的默认值应在 checkHook 阶段被补全为 true。
        if (item?.enable === false) {
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
            enable: true,
            deps: hook.deps,
            handler: hook.handler
        });
    }

    return hooksMap;
}
