/**
 * 核心工具函数
 */

// 内部依赖
import { existsSync } from 'node:fs';

// 外部依赖
import { camelCase } from 'es-toolkit/string';
import { scanFiles } from 'befly-util';

// 相对导入
import { Logger } from './lib/logger.js';

// 类型导入
import type { Plugin } from './types/plugin.js';
import type { Hook } from './types/hook.js';

/**
 * 扫描并加载模块（插件或钩子）
 * @param dir - 目录路径
 * @param type - 模块类型
 * @param loadedNames - 已加载的模块名称集合
 * @param moduleLabel - 模块标签（如"插件"、"钩子"）
 * @param config - 配置对象
 * @param addonName - 组件名称（仅 type='addon' 时需要）
 * @returns 模块列表
 */
export async function scanModules<T extends Plugin | Hook>(dir: string, type: 'core' | 'addon' | 'app', loadedNames: Set<string>, moduleLabel: string, config?: Record<string, any>, addonName?: string): Promise<T[]> {
    if (!existsSync(dir)) return [];

    const items: T[] = [];
    const files = await scanFiles(dir, '*.{ts,js}');

    for (const { filePath, fileName } of files) {
        // 生成模块名称
        const name = camelCase(fileName);
        const moduleName = type === 'core' ? name : type === 'addon' ? `addon_${camelCase(addonName!)}_${name}` : `app_${name}`;

        if (loadedNames.has(moduleName)) {
            continue;
        }

        try {
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            const moduleImport = await import(normalizedFilePath);
            const item = moduleImport.default;

            // 兼容直接导出函数的情况
            if (typeof item === 'function') {
                // @ts-ignore
                items.push({
                    name: moduleName,
                    handler: item,
                    config: config?.[moduleName] || {}
                });
            } else {
                item.name = moduleName;
                // 注入配置
                if (config && config[moduleName]) {
                    item.config = config[moduleName];
                }
                items.push(item);
            }

            loadedNames.add(moduleName);
        } catch (err: any) {
            const typeLabel = type === 'core' ? '核心' : type === 'addon' ? `组件${addonName}` : '项目';
            Logger.error(`${typeLabel}${moduleLabel} ${fileName} 导入失败`, err);
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
                    Logger.error(`模块 ${module.name} 依赖的模块 ${dep} 未找到`);
                    isPass = false;
                }
            }
        }
    }

    if (!isPass) return false;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error(`模块循环依赖: ${name}`);
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
