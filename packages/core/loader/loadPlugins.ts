/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import { existsSync } from 'node:fs';
import { camelCase } from 'es-toolkit/string';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from 'befly-util';
import { scanFiles } from 'befly-util';
import { corePluginDir, projectPluginDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from 'befly-util';
import type { Plugin } from '../types/plugin.js';
import type { Hook } from '../types/hook.js';
import type { BeflyContext } from '../types/befly.js';

// ==================== 通用工具函数 ====================

/**
 * 统一导入并注册模块（插件或钩子）
 */
export async function importAndRegister<T extends Plugin | Hook>(files: Array<{ filePath: string; fileName: string }>, loadedNames: Set<string>, nameGenerator: (fileName: string, filePath: string) => string, errorLabelGenerator: (fileName: string, filePath: string) => string, config?: Record<string, Record<string, any>>): Promise<T[]> {
    const items: T[] = [];

    for (const { filePath, fileName } of files) {
        const name = nameGenerator(fileName, filePath);

        if (loadedNames.has(name)) {
            continue;
        }

        try {
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            const moduleImport = await import(normalizedFilePath);
            const item = moduleImport.default;

            // 兼容直接导出函数的情况
            if (typeof item === 'function') {
                // 如果是函数，包装成对象
                // 注意：这里无法获取 after 依赖，除非函数上有静态属性
                // 假设直接导出函数没有依赖
                // @ts-ignore
                items.push({
                    name: name,
                    handler: item,
                    config: config?.[name] || {}
                });
            } else {
                item.name = name;
                // 注入配置
                if (config && config[name]) {
                    item.config = config[name];
                }
                items.push(item);
            }

            loadedNames.add(name);
        } catch (err: any) {
            const label = errorLabelGenerator(fileName, filePath);
            Logger.error(`${label} 导入失败`, err);
            process.exit(1);
        }
    }

    return items;
}

/**
 * 排序模块（根据依赖关系）
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

// ==================== 插件加载逻辑 ====================

async function scanPlugins(dir: string, type: 'core' | 'addon' | 'app', loadedNames: Set<string>, config?: Record<string, any>, addonName?: string): Promise<Plugin[]> {
    if (!existsSync(dir)) return [];

    const files = await scanFiles(dir, '*.{ts,js}');
    return importAndRegister<Plugin>(
        files,
        loadedNames,
        (fileName) => {
            const name = camelCase(fileName);
            if (type === 'core') return name;
            if (type === 'addon') return `addon_${camelCase(addonName!)}_${name}`;
            return `app_${name}`;
        },
        (fileName) => `${type === 'core' ? '核心' : type === 'addon' ? `组件${addonName}` : '项目'}插件 ${fileName}`,
        config
    );
}

async function initPlugin(befly: { pluginLists: Plugin[]; appContext: BeflyContext }, plugin: Plugin): Promise<void> {
    befly.pluginLists.push(plugin);

    if (typeof plugin.handler === 'function') {
        befly.appContext[plugin.name!] = await plugin.handler(befly.appContext);
    } else {
        befly.appContext[plugin.name!] = {};
    }
}

export async function loadPlugins(befly: {
    //
    pluginLists: Plugin[];
    appContext: BeflyContext;
    pluginsConfig?: Record<string, any>;
}): Promise<void> {
    try {
        const loadedNames = new Set<string>();
        const allPlugins: Plugin[] = [];

        // 1. 核心插件
        allPlugins.push(...(await scanPlugins(corePluginDir, 'core', loadedNames, befly.pluginsConfig)));

        // 2. 组件插件
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = getAddonDir(addon, 'plugins');
            allPlugins.push(...(await scanPlugins(dir, 'addon', loadedNames, befly.pluginsConfig, addon)));
        }

        // 3. 项目插件
        allPlugins.push(...(await scanPlugins(projectPluginDir, 'app', loadedNames, befly.pluginsConfig)));

        // 4. 排序与初始化
        const sortedPlugins = sortModules(allPlugins);
        if (sortedPlugins === false) {
            Logger.error('插件依赖关系错误，请检查 after 属性');
            process.exit(1);
        }

        for (const plugin of sortedPlugins) {
            try {
                await initPlugin(befly, plugin);
            } catch (error: any) {
                Logger.error(`插件 ${plugin.name} 初始化失败`, error);
                process.exit(1);
            }
        }
    } catch (error: any) {
        Logger.error('加载插件时发生错误', error);
        process.exit(1);
    }
}

// ==================== 钩子加载逻辑 ====================
// 已移动到 loadHooks.ts
