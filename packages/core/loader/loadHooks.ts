/**
 * 钩子加载器
 * 默认只加载核心钩子
 * 可选：通过配置开启组件/项目钩子（默认关闭以保持稳定性与可预期性）
 */

// 类型导入
import type { Hook } from "../types/hook.js";

import { beflyConfig } from "../befly.config.js";
import { Logger } from "../lib/logger.js";

export async function loadHooks(hooks: Hook[]): Promise<void> {
    try {
        const allHooks: Hook[] = [];

        // 4. 过滤禁用的钩子
        const disableHooks = beflyConfig.disableHooks || [];
        const enabledHooks = allHooks.filter((hook) => hook.name && !disableHooks.includes(hook.name));

        if (disableHooks.length > 0) {
            Logger.info({ hooks: disableHooks }, "禁用钩子");
        }

        // 5. 按 deps 拓扑排序
        const sortedHooks = (() => {
            const result: Hook[] = [];
            const visited = new Set<string>();
            const visiting = new Set<string>();

            const hookMap: Record<string, Hook> = Object.fromEntries(enabledHooks.map((h) => [h.name, h]));
            let isPass = true;

            // 检查依赖是否存在
            for (const hook of enabledHooks) {
                for (const dep of hook.deps) {
                    if (!hookMap[dep]) {
                        Logger.error({ hook: hook.name, dependency: dep }, "依赖的钩子未找到");
                        isPass = false;
                    }
                }
            }

            if (!isPass) return false as const;

            const visit = (name: string): void => {
                if (visited.has(name)) return;
                if (visiting.has(name)) {
                    Logger.error({ hook: name }, "钩子循环依赖");
                    isPass = false;
                    return;
                }

                const hook = hookMap[name];
                if (!hook) return;

                visiting.add(name);
                hook.deps.forEach(visit);
                visiting.delete(name);
                visited.add(name);
                result.push(hook);
            };

            enabledHooks.forEach((h) => visit(h.name));

            return isPass ? result : (false as const);
        })();

        if (sortedHooks === false) {
            Logger.error("钩子依赖关系错误，请检查 deps 属性");
            process.exit(1);
        }

        hooks.push(...sortedHooks);
    } catch (error: any) {
        Logger.error({ err: error }, "加载钩子时发生错误");
        process.exit(1);
    }
}
