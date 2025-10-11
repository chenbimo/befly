/**
 * 资源冲突检测
 * 在系统启动前检测表名、API 路由、插件名等资源是否存在冲突
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { scanAddons, getAddonDir, hasAddonDir } from '../utils/addonHelper.js';
import { __dirtables, __dirapis, __dirplugins, getProjectDir } from '../system.js';
import { isReservedTableName, isReservedRoute, isReservedPluginName, isReservedAddonName, getReservedTablePrefixes, getReservedRoutes, getReservedPlugins, getReservedAddonNames } from '../config/reserved.js';

/**
 * 资源注册表
 */
interface ResourceRegistry {
    tables: Map<string, string>; // 表名 -> 来源
    routes: Map<string, string>; // 路由 -> 来源
    plugins: Map<string, string>; // 插件名 -> 来源
}

/**
 * 冲突检测结果
 */
interface ConflictResult {
    hasConflicts: boolean;
    conflicts: string[];
}

/**
 * 收集核心表定义
 */
async function collectCoreTables(registry: ResourceRegistry): Promise<void> {
    try {
        const glob = new Bun.Glob('*.json');
        for await (const file of glob.scan({
            cwd: __dirtables,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = path.basename(file, '.json');
            if (fileName.startsWith('_')) continue;

            try {
                const tableDefine = await Bun.file(file).json();
                const tableName = tableDefine.tableName || `sys_${fileName}`;

                if (registry.tables.has(tableName)) {
                    Logger.error(`核心表 "${tableName}" 重复定义`);
                } else {
                    registry.tables.set(tableName, 'core');
                }
            } catch (error: any) {
                // 表定义解析错误会在 table.ts 中处理，这里跳过
            }
        }
    } catch (error: any) {
        Logger.error('收集核心表定义时出错:', error);
    }
}

/**
 * 收集核心 API 路由
 */
async function collectCoreApis(registry: ResourceRegistry): Promise<void> {
    try {
        const glob = new Bun.Glob('**/*.ts');
        for await (const file of glob.scan({
            cwd: __dirapis,
            onlyFiles: true,
            absolute: true
        })) {
            const apiPath = path
                .relative(__dirapis, file)
                .replace(/\.(js|ts)$/, '')
                .replace(/\\/g, '/');
            if (apiPath.indexOf('_') !== -1) continue;

            try {
                const api = (await import(file)).default;
                const route = `${(api.method || 'POST').toUpperCase()}/api/${apiPath}`;

                if (registry.routes.has(route)) {
                    Logger.error(`核心路由 "${route}" 重复定义`);
                } else {
                    registry.routes.set(route, 'core');
                }
            } catch (error: any) {
                // API 加载错误会在 loader.ts 中处理，这里跳过
            }
        }
    } catch (error: any) {
        Logger.error('收集核心 API 路由时出错:', error);
    }
}

/**
 * 收集核心插件
 */
async function collectCorePlugins(registry: ResourceRegistry): Promise<void> {
    try {
        const glob = new Bun.Glob('*.ts');
        for await (const file of glob.scan({
            cwd: __dirplugins,
            onlyFiles: true,
            absolute: true
        })) {
            const pluginName = path.basename(file).replace(/\.(js|ts)$/, '');
            if (pluginName.startsWith('_')) continue;

            if (registry.plugins.has(pluginName)) {
                Logger.error(`核心插件 "${pluginName}" 重复定义`);
            } else {
                registry.plugins.set(pluginName, 'core');
            }
        }
    } catch (error: any) {
        Logger.error('收集核心插件时出错:', error);
    }
}

/**
 * 收集 addon 资源
 */
async function collectAddonResources(addonName: string, registry: ResourceRegistry): Promise<string[]> {
    const conflicts: string[] = [];

    // 检查 addon 名称是否使用保留名称
    if (isReservedAddonName(addonName)) {
        conflicts.push(`Addon 名称 "${addonName}" 使用了保留名称，保留名称包括: ${getReservedAddonNames().join(', ')}`);
        return conflicts;
    }

    // 收集 addon 表定义
    if (hasAddonDir(addonName, 'tables')) {
        const addonTablesDir = getAddonDir(addonName, 'tables');
        const glob = new Bun.Glob('*.json');

        for await (const file of glob.scan({
            cwd: addonTablesDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = path.basename(file, '.json');
            if (fileName.startsWith('_')) continue;

            try {
                const tableDefine = await Bun.file(file).json();
                const tableName = tableDefine.tableName || `${addonName}_${fileName}`;

                // 检查是否使用保留前缀
                if (isReservedTableName(tableName)) {
                    conflicts.push(`Addon [${addonName}] 表 "${tableName}" 使用了保留前缀，保留前缀包括: ${getReservedTablePrefixes().join(', ')}`);
                    continue;
                }

                // 检查是否与已有表冲突
                if (registry.tables.has(tableName)) {
                    conflicts.push(`Addon [${addonName}] 表 "${tableName}" 与 ${registry.tables.get(tableName)} 冲突`);
                } else {
                    registry.tables.set(tableName, `addon[${addonName}]`);
                }
            } catch (error: any) {
                // 表定义解析错误会在 table.ts 中处理，这里跳过
            }
        }
    }

    // 收集 addon API 路由
    if (hasAddonDir(addonName, 'apis')) {
        const addonApisDir = getAddonDir(addonName, 'apis');
        const glob = new Bun.Glob('**/*.ts');

        for await (const file of glob.scan({
            cwd: addonApisDir,
            onlyFiles: true,
            absolute: true
        })) {
            const apiPath = path
                .relative(addonApisDir, file)
                .replace(/\.(js|ts)$/, '')
                .replace(/\\/g, '/');
            if (apiPath.indexOf('_') !== -1) continue;

            try {
                const api = (await import(file)).default;
                const route = `${(api.method || 'POST').toUpperCase()}/api/${addonName}/${apiPath}`;

                // 检查是否使用保留路由
                if (isReservedRoute(route)) {
                    conflicts.push(`Addon [${addonName}] 路由 "${route}" 使用了保留路径，保留路径包括: ${getReservedRoutes().join(', ')}`);
                    continue;
                }

                // 检查是否与已有路由冲突
                if (registry.routes.has(route)) {
                    conflicts.push(`Addon [${addonName}] 路由 "${route}" 与 ${registry.routes.get(route)} 冲突`);
                } else {
                    registry.routes.set(route, `addon[${addonName}]`);
                }
            } catch (error: any) {
                // API 加载错误会在 loader.ts 中处理，这里跳过
            }
        }
    }

    // 收集 addon 插件
    if (hasAddonDir(addonName, 'plugins')) {
        const addonPluginsDir = getAddonDir(addonName, 'plugins');
        const glob = new Bun.Glob('*.ts');

        for await (const file of glob.scan({
            cwd: addonPluginsDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
            if (fileName.startsWith('_')) continue;

            // Addon 插件使用点号命名空间
            const pluginName = `${addonName}.${fileName}`;

            // 检查是否使用保留名称
            if (isReservedPluginName(pluginName)) {
                conflicts.push(`Addon [${addonName}] 插件 "${pluginName}" 使用了保留名称，保留名称包括: ${getReservedPlugins().join(', ')}`);
                continue;
            }

            // 检查是否与已有插件冲突
            if (registry.plugins.has(pluginName)) {
                conflicts.push(`Addon [${addonName}] 插件 "${pluginName}" 与 ${registry.plugins.get(pluginName)} 冲突`);
            } else {
                registry.plugins.set(pluginName, `addon[${addonName}]`);
            }
        }
    }

    return conflicts;
}

/**
 * 收集用户资源
 */
async function collectUserResources(registry: ResourceRegistry): Promise<string[]> {
    const conflicts: string[] = [];

    // 收集用户表定义
    const userTablesDir = getProjectDir('tables');
    try {
        const glob = new Bun.Glob('*.json');
        for await (const file of glob.scan({
            cwd: userTablesDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = path.basename(file, '.json');
            if (fileName.startsWith('_')) continue;

            try {
                const tableDefine = await Bun.file(file).json();
                const tableName = tableDefine.tableName || fileName;

                // 检查是否使用保留前缀
                if (isReservedTableName(tableName)) {
                    conflicts.push(`用户表 "${tableName}" 使用了保留前缀，保留前缀包括: ${getReservedTablePrefixes().join(', ')}`);
                    continue;
                }

                // 检查是否与已有表冲突
                if (registry.tables.has(tableName)) {
                    conflicts.push(`用户表 "${tableName}" 与 ${registry.tables.get(tableName)} 冲突`);
                } else {
                    registry.tables.set(tableName, 'user');
                }
            } catch (error: any) {
                // 表定义解析错误会在 table.ts 中处理，这里跳过
            }
        }
    } catch (error: any) {
        // 用户可能没有 tables 目录，这是正常的
    }

    // 收集用户 API 路由
    const userApisDir = getProjectDir('apis');
    try {
        const glob = new Bun.Glob('**/*.ts');
        for await (const file of glob.scan({
            cwd: userApisDir,
            onlyFiles: true,
            absolute: true
        })) {
            const apiPath = path
                .relative(userApisDir, file)
                .replace(/\.(js|ts)$/, '')
                .replace(/\\/g, '/');
            if (apiPath.indexOf('_') !== -1) continue;

            try {
                const api = (await import(file)).default;
                const route = `${(api.method || 'POST').toUpperCase()}/api/${apiPath}`;

                // 检查是否使用保留路由
                if (isReservedRoute(route)) {
                    conflicts.push(`用户路由 "${route}" 使用了保留路径，保留路径包括: ${getReservedRoutes().join(', ')}`);
                    continue;
                }

                // 检查是否与已有路由冲突
                if (registry.routes.has(route)) {
                    conflicts.push(`用户路由 "${route}" 与 ${registry.routes.get(route)} 冲突`);
                } else {
                    registry.routes.set(route, 'user');
                }
            } catch (error: any) {
                // API 加载错误会在 loader.ts 中处理，这里跳过
            }
        }
    } catch (error: any) {
        // 用户可能没有 apis 目录，这是正常的
    }

    // 收集用户插件
    const userPluginsDir = getProjectDir('plugins');
    try {
        const glob = new Bun.Glob('*.ts');
        for await (const file of glob.scan({
            cwd: userPluginsDir,
            onlyFiles: true,
            absolute: true
        })) {
            const pluginName = path.basename(file).replace(/\.(js|ts)$/, '');
            if (pluginName.startsWith('_')) continue;

            // 检查是否使用保留名称
            if (isReservedPluginName(pluginName)) {
                conflicts.push(`用户插件 "${pluginName}" 使用了保留名称，保留名称包括: ${getReservedPlugins().join(', ')}`);
                continue;
            }

            // 检查是否与已有插件冲突
            if (registry.plugins.has(pluginName)) {
                conflicts.push(`用户插件 "${pluginName}" 与 ${registry.plugins.get(pluginName)} 冲突`);
            } else {
                registry.plugins.set(pluginName, 'user');
            }
        }
    } catch (error: any) {
        // 用户可能没有 plugins 目录，这是正常的
    }

    return conflicts;
}

/**
 * 执行资源冲突检测
 */
export default async function checkConflict(): Promise<boolean> {
    try {
        // 初始化资源注册表
        const registry: ResourceRegistry = {
            tables: new Map(),
            routes: new Map(),
            plugins: new Map()
        };

        const allConflicts: string[] = [];

        // 1. 收集核心资源
        await collectCoreTables(registry);
        await collectCoreApis(registry);
        await collectCorePlugins(registry);

        // 2. 收集 addon 资源
        const addons = scanAddons();
        for (const addon of addons) {
            const addonConflicts = await collectAddonResources(addon, registry);
            allConflicts.push(...addonConflicts);
        }

        // 3. 收集用户资源
        const userConflicts = await collectUserResources(registry);
        allConflicts.push(...userConflicts);

        // 4. 报告冲突
        if (allConflicts.length > 0) {
            Logger.error('');
            Logger.error('❌ 检测到资源冲突:');
            Logger.error('');
            allConflicts.forEach((conflict, index) => {
                Logger.error(`  ${index + 1}. ${conflict}`);
            });
            Logger.error('');
            Logger.error('请解决以上冲突后再启动服务器');
            Logger.error('');
            return false;
        }

        // 5. 统计信息
        Logger.info(`资源冲突检测通过 ✓`);
        Logger.info(`  - 表: ${registry.tables.size} 个`);
        Logger.info(`  - 路由: ${registry.routes.size} 个`);
        Logger.info(`  - 插件: ${registry.plugins.size} 个`);

        return true;
    } catch (error: any) {
        Logger.error('资源冲突检测时发生错误:', error);
        return false;
    }
}
