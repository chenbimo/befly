/**
 * 资源冲突检测
 * 在系统启动前检测表名、API 路由、插件名等资源是否存在冲突
 */

import { relative, basename } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { projectPluginDir, coreTableDir, projectTableDir, projectApiDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';

/**
 * 保留名称配置
 */
const RESERVED_NAMES = {
    tablePrefix: ['sys_'],
    plugins: ['db', 'logger', 'redis', 'tool'],
    addonNames: ['app', 'api']
} as const;

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
 * 收集核心插件
 */
async function collectCorePlugins(registry: ResourceRegistry): Promise<void> {
    // 检查插件目录是否存在
    if (!existsSync(projectPluginDir)) {
        return;
    }

    try {
        const glob = new Bun.Glob('*.ts');
        for await (const file of glob.scan({
            cwd: projectPluginDir,
            onlyFiles: true,
            absolute: true
        })) {
            const pluginName = basename(file).replace(/\.ts$/, '');
            if (pluginName.startsWith('_')) continue;

            if (registry.plugins.has(pluginName)) {
                Logger.warn(`核心插件 "${pluginName}" 重复定义`);
            } else {
                registry.plugins.set(pluginName, 'core');
            }
        }
    } catch (error: any) {
        Logger.error('收集插件时出错:', error);
    }
}

/**
 * 收集 addon 资源
 */
async function collectAddonResources(addonName: string, registry: ResourceRegistry): Promise<string[]> {
    const conflicts: string[] = [];

    // 检查 addon 名称是否使用保留名称
    if (RESERVED_NAMES.addonNames.includes(addonName.toLowerCase())) {
        conflicts.push(`组件名称 "${addonName}" 使用了保留名称，保留名称包括: ${RESERVED_NAMES.addonNames.join(', ')}`);
        return conflicts;
    }

    // 收集 addon 表定义
    if (addonDirExists(addonName, 'tables')) {
        const addonTablesDir = getAddonDir(addonName, 'tables');
        const glob = new Bun.Glob('*.json');

        for await (const file of glob.scan({
            cwd: addonTablesDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = basename(file, '.json');
            if (fileName.startsWith('_')) continue;

            try {
                const tableDefine = await Bun.file(file).json();
                const tableName = tableDefine.tableName || `${addonName}_${fileName}`;

                // 检查是否使用保留前缀
                if (RESERVED_NAMES.tablePrefix.some((prefix) => tableName.startsWith(prefix))) {
                    conflicts.push(`组件 ${addonName} 表 "${tableName}" 使用了保留前缀，保留前缀包括: ${RESERVED_NAMES.tablePrefix.join(', ')}`);
                    continue;
                }

                // 检查是否与已有表冲突
                if (registry.tables.has(tableName)) {
                    conflicts.push(`组件 ${addonName} 表 "${tableName}" 与 ${registry.tables.get(tableName)} 冲突`);
                } else {
                    registry.tables.set(tableName, `组件${addonName}`);
                }
            } catch (error: any) {
                // 表定义解析错误会在 table.ts 中处理，这里跳过
            }
        }
    }

    // 收集 addon API 路由
    if (addonDirExists(addonName, 'apis')) {
        const addonApisDir = getAddonDir(addonName, 'apis');
        const glob = new Bun.Glob('**/*.ts');

        for await (const file of glob.scan({
            cwd: addonApisDir,
            onlyFiles: true,
            absolute: true
        })) {
            const apiPath = relative(addonApisDir, file).replace(/\.ts$/, '');
            if (apiPath.indexOf('_') !== -1) continue;

            try {
                const api = (await import(file)).default;
                const route = `${(api.method || 'POST').toUpperCase()}/api/${addonName}/${apiPath}`;

                // 检查是否使用保留路由前缀 /api
                if (route.includes('/api/api/') || route.includes('/api/api')) {
                    conflicts.push(`组件 [${addonName}] 路由 "${route}" 使用了保留路径前缀 "/api"`);
                    continue;
                }

                // 检查是否与已有路由冲突
                if (registry.routes.has(route)) {
                    conflicts.push(`组件 [${addonName}] 路由 "${route}" 与 ${registry.routes.get(route)} 冲突`);
                } else {
                    registry.routes.set(route, `组件${addonName}`);
                }
            } catch (error: any) {
                // API 加载错误会在 loader.ts 中处理，这里跳过
            }
        }
    }

    // 收集 addon 插件
    if (addonDirExists(addonName, 'plugins')) {
        const addonPluginsDir = getAddonDir(addonName, 'plugins');
        const glob = new Bun.Glob('*.ts');

        for await (const file of glob.scan({
            cwd: addonPluginsDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = basename(file).replace(/\.ts$/, '');
            if (fileName.startsWith('_')) continue;

            // Addon 插件使用点号命名空间
            const pluginName = `${addonName}.${fileName}`;

            // 检查是否使用保留名称（检测核心插件名或点号前缀是保留名称）
            const isReserved = RESERVED_NAMES.plugins.includes(pluginName) || (pluginName.includes('.') && RESERVED_NAMES.plugins.includes(pluginName.split('.')[0]));
            if (isReserved) {
                conflicts.push(`组件 ${addonName} 插件 "${pluginName}" 使用了保留名称，保留名称包括: ${RESERVED_NAMES.plugins.join(', ')}`);
                continue;
            }

            // 检查是否与已有插件冲突
            if (registry.plugins.has(pluginName)) {
                conflicts.push(`组件 [${addonName}] 插件 "${pluginName}" 与 ${registry.plugins.get(pluginName)} 冲突`);
            } else {
                registry.plugins.set(pluginName, `组件${addonName}`);
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
    const userTablesDir = projectTableDir;
    if (existsSync(userTablesDir)) {
        try {
            const glob = new Bun.Glob('*.json');
            for await (const file of glob.scan({
                cwd: userTablesDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = basename(file, '.json');
                if (fileName.startsWith('_')) continue;

                try {
                    const tableDefine = await Bun.file(file).json();
                    const tableName = tableDefine.tableName || fileName;

                    // 检查是否使用保留前缀
                    if (RESERVED_NAMES.tablePrefix.some((prefix) => tableName.startsWith(prefix))) {
                        conflicts.push(`用户表 "${tableName}" 使用了保留前缀，保留前缀包括: ${RESERVED_NAMES.tablePrefix.join(', ')}`);
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
            Logger.error('收集用户表定义时出错:', error);
        }
    }

    // 收集用户 API 路由
    const userApisDir = projectApiDir;
    if (existsSync(userApisDir)) {
        try {
            const glob = new Bun.Glob('**/*.ts');
            for await (const file of glob.scan({
                cwd: userApisDir,
                onlyFiles: true,
                absolute: true
            })) {
                const apiPath = relative(userApisDir, file).replace(/\.ts$/, '');
                if (apiPath.indexOf('_') !== -1) continue;

                try {
                    const api = (await import(file)).default;
                    const route = `${(api.method || 'POST').toUpperCase()}/api/${apiPath}`;

                    // 检查是否使用保留路由前缀 /api
                    if (apiPath.startsWith('api/') || apiPath === 'api') {
                        conflicts.push(`用户路由 "${route}" 使用了保留路径前缀 "/api"`);
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
            Logger.error('收集用户 API 路由时出错:', error);
        }
    }

    // 收集用户插件
    const userPluginsDir = projectPluginDir;
    if (existsSync(userPluginsDir)) {
        try {
            const glob = new Bun.Glob('*.ts');
            for await (const file of glob.scan({
                cwd: userPluginsDir,
                onlyFiles: true,
                absolute: true
            })) {
                const pluginName = basename(file).replace(/\.ts$/, '');
                if (pluginName.startsWith('_')) continue;

                // 检查是否使用保留名称（检测核心插件名或点号前缀是保留名称）
                const isReserved = RESERVED_NAMES.plugins.includes(pluginName) || (pluginName.includes('.') && RESERVED_NAMES.plugins.includes(pluginName.split('.')[0]));
                if (isReserved) {
                    conflicts.push(`用户插件 "${pluginName}" 使用了保留名称，保留名称包括: ${RESERVED_NAMES.plugins.join(', ')}`);
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
            Logger.error('收集用户插件时出错:', error);
        }
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

        // 1. 收集核心插件
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
            Logger.warn('检测到资源冲突:');
            allConflicts.forEach((conflict, index) => {
                Logger.warn(`  ${index + 1}. ${conflict}`);
            });
            Logger.warn('请解决以上冲突后再启动服务器');
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
