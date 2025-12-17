import type { Hook } from "../types/hook.js";
import type { Plugin } from "../types/plugin.js";

import { existsSync } from "node:fs";

import { camelCase } from "es-toolkit/string";

import { Logger } from "../lib/logger.js";
import { scanFiles } from "./scanFiles.js";

/**
 * 扫描模块（插件或钩子）
 * @param dir - 目录路径
 * @param type - 模块类型（core/addon/app）
 * @param moduleLabel - 模块标签（如"插件"、"钩子"）
 * @param addonName - 组件名称（仅 type='addon' 时需要）
 * @returns 模块列表
 */
export async function scanModules<T extends Plugin | Hook>(dir: string, type: "core" | "addon" | "app", moduleLabel: string, addonName?: string): Promise<T[]> {
    if (!existsSync(dir)) return [];

    const items: T[] = [];
    const files = await scanFiles(dir, "*.ts");

    for (const { filePath, fileName } of files) {
        // 生成模块名称
        const name = camelCase(fileName);
        const moduleName = type === "core" ? name : type === "addon" ? `addon_${camelCase(addonName!)}_${name}` : `app_${name}`;

        try {
            const normalizedFilePath = filePath.replace(/\\/g, "/");
            const moduleImport = await import(normalizedFilePath);
            const item = moduleImport.default;

            item.name = moduleName;
            // 为 addon 模块记录 addon 名称
            if (type === "addon" && addonName) {
                item.addonName = addonName;
            }
            items.push(item);
        } catch (err: any) {
            const typeLabel = type === "core" ? "核心" : type === "addon" ? `组件${addonName}` : "项目";
            Logger.error({ err: err, module: fileName }, `${typeLabel}${moduleLabel} 导入失败`);
            process.exit(1);
        }
    }

    return items;
}

/**
 * 排序模块（根据依赖关系）
 * @param modules - 待排序的模块列表
 * @returns 排序后的模块列表，如果存在循环依赖或依赖不存在则返回 false
 */
export function sortModules<T extends { name?: string; after?: string[] }>(modules: T[]): T[] | false {
    const result: T[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const moduleMap: Record<string, T> = Object.fromEntries(modules.map((m) => [m.name!, m]));
    let isPass = true;

    // 检查依赖是否存在
    for (const module of modules) {
        if (module.after) {
            for (const dep of module.after) {
                if (!moduleMap[dep]) {
                    Logger.error({ module: module.name, dependency: dep }, "依赖的模块未找到");
                    isPass = false;
                }
            }
        }
    }

    if (!isPass) return false;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error({ module: name }, "模块循环依赖");
            isPass = false;
            return;
        }

        const module = moduleMap[name];
        if (!module) return;

        visiting.add(name);
        (module.after || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(module);
    };

    modules.forEach((m) => visit(m.name!));

    return isPass ? result : false;
}
