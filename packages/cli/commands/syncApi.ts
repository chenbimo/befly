/**
 * SyncApi 命令 - 同步 API 接口数据到数据库
 * 说明：遍历所有 API 文件，收集接口路由信息并同步到 addon_admin_api 表
 *
 * 流程：
 * 1. 扫描项目 apis 目录下所有项目 API 文件
 * 2. 扫描 node_modules/@befly-addon/* 目录下所有组件 API 文件
 * 3. 提取每个 API 的 name、method、auth 等信息
 * 4. 根据接口路径检查是否存在
 * 5. 存在则更新，不存在则新增
 * 6. 删除配置中不存在的接口记录
 */
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'pathe';
import { Database, RedisHelper, utils } from 'befly';

import { Logger, projectDir } from '../util.js';

import type { SyncApiOptions, ApiInfo, SyncApiStats } from '../types.js';

/**
 * Glob 实例（模块级常量，复用）
 */
const tsGlob = new Bun.Glob('**/*.ts');

/**
 * 从 API 文件中提取接口信息
 */
async function extractApiInfo(filePath: string, apiRoot: string, type: 'app' | 'addon', addonName: string = '', addonTitle: string = ''): Promise<ApiInfo | null> {
    try {
        const apiModule = await import(filePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        let apiPath = '';

        if (type === 'addon') {
            // Addon 接口：保留完整目录层级
            // 例: apis/menu/list.ts → /api/addon/admin/menu/list
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.ts$/, '');
            apiPath = `/api/addon/${addonName}/${pathWithoutExt}`;
        } else {
            // 项目接口：保留完整目录层级
            // 例: apis/user/list.ts → /api/user/list
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.ts$/, '');
            apiPath = `/api/${pathWithoutExt}`;
        }

        return {
            name: apiConfig.name || '',
            path: apiPath,
            method: apiConfig.method || 'POST',
            description: apiConfig.description || '',
            addonName: addonName,
            addonTitle: addonTitle || addonName
        };
    } catch (error: any) {
        Logger.error(`解析 API 文件失败: ${filePath}`, error);
        return null;
    }
}

/**
 * 扫描所有 API 文件
 */
async function scanAllApis(projectRoot: string): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    // 1. 扫描项目 API（只扫描 apis 目录）
    try {
        const projectApisDir = join(projectDir, 'apis');

        // 扫描项目 API 文件
        const projectApiFiles: string[] = [];
        try {
            for await (const file of tsGlob.scan({
                cwd: projectApisDir,
                absolute: true,
                onlyFiles: true
            })) {
                if (!file.endsWith('.d.ts')) {
                    projectApiFiles.push(file);
                }
            }
        } catch (error: any) {
            Logger.warn(`扫描项目 API 目录失败: ${projectApisDir}`, error.message);
        }

        for (const filePath of projectApiFiles) {
            const apiInfo = await extractApiInfo(filePath, projectApisDir, 'app', '', '项目接口');
            if (apiInfo) {
                apis.push(apiInfo);
            }
        }

        // 2. 扫描组件 API (node_modules/@befly-addon/*)
        const addonNames = utils.scanAddons();

        for (const addonName of addonNames) {
            // addonName 格式: admin, demo 等

            // 检查 apis 子目录是否存在
            if (!utils.addonDirExists(addonName, 'apis')) {
                continue;
            }

            const addonApisDir = utils.getAddonDir(addonName, 'apis');

            // 读取 addon 配置
            const addonConfigPath = utils.getAddonDir(addonName, 'addon.config.json');
            let addonTitle = addonName;
            try {
                const configFile = Bun.file(addonConfigPath);
                const config = await configFile.json();
                addonTitle = config.title || addonName;
            } catch (error) {
                // 忽略配置读取错误
            }

            // 扫描 addon API 文件
            const addonApiFiles: string[] = [];
            try {
                for await (const file of tsGlob.scan({
                    cwd: addonApisDir,
                    absolute: true,
                    onlyFiles: true
                })) {
                    if (!file.endsWith('.d.ts')) {
                        addonApiFiles.push(file);
                    }
                }
            } catch (error: any) {
                Logger.warn(`扫描 addon API 目录失败: ${addonApisDir}`, error.message);
            }

            for (const filePath of addonApiFiles) {
                const apiInfo = await extractApiInfo(filePath, addonApisDir, 'addon', addonName, addonTitle);
                if (apiInfo) {
                    apis.push(apiInfo);
                }
            }
        }

        return apis;
    } catch (error: any) {
        Logger.error(`接口扫描失败:`, error);
        return apis;
    }
}

/**
 * 同步 API 数据到数据库
 */
async function syncApis(helper: any, apis: ApiInfo[]): Promise<{ created: number; updated: number; createdList: any[]; updatedList: any[] }> {
    const stats = { created: 0, updated: 0, createdList: [] as any[], updatedList: [] as any[] };

    for (const api of apis) {
        try {
            // 根据 path 查询是否存在
            const existing = await helper.getOne({
                table: 'addon_admin_api',
                where: { path: api.path }
            });

            if (existing) {
                // 对比差异
                const changes: { field: string; before: any; after: any }[] = [];

                if (existing.name !== api.name) {
                    changes.push({ field: 'name', before: existing.name, after: api.name });
                }
                if (existing.method !== api.method) {
                    changes.push({ field: 'method', before: existing.method, after: api.method });
                }
                if (existing.description !== api.description) {
                    changes.push({ field: 'description', before: existing.description, after: api.description });
                }
                if (existing.addonName !== api.addonName) {
                    changes.push({ field: 'addonName', before: existing.addonName, after: api.addonName });
                }
                if (existing.addonTitle !== api.addonTitle) {
                    changes.push({ field: 'addonTitle', before: existing.addonTitle, after: api.addonTitle });
                }

                if (changes.length > 0) {
                    await helper.updData({
                        table: 'addon_admin_api',
                        where: { id: existing.id },
                        data: {
                            name: api.name,
                            method: api.method,
                            description: api.description,
                            addonName: api.addonName,
                            addonTitle: api.addonTitle
                        }
                    });
                    stats.updated++;
                    stats.updatedList.push({
                        name: api.name,
                        path: api.path,
                        method: api.method,
                        description: api.description,
                        addonName: api.addonName,
                        addonTitle: api.addonTitle,
                        changes: changes
                    });
                }
            } else {
                await helper.insData({
                    table: 'addon_admin_api',
                    data: {
                        name: api.name,
                        path: api.path,
                        method: api.method,
                        description: api.description,
                        addonName: api.addonName,
                        addonTitle: api.addonTitle
                    }
                });
                stats.created++;
                stats.createdList.push({
                    name: api.name,
                    path: api.path,
                    method: api.method,
                    description: api.description,
                    addonName: api.addonName,
                    addonTitle: api.addonTitle
                });
            }
        } catch (error: any) {
            Logger.error(`同步接口 "${api.name}" 失败:`, error);
        }
    }

    return stats;
}

/**
 * 删除配置中不存在的记录
 */
async function deleteObsoleteRecords(helper: any, apiPaths: Set<string>): Promise<{ count: number; list: ApiDetail[] }> {
    const allRecords = await helper.getAll({
        table: 'addon_admin_api',
        fields: ['id', 'path', 'name', 'method', 'description', 'addonName', 'addonTitle'],
        where: { state$gte: 0 } // 查询所有状态（包括软删除的 state=0）
    });

    const deletedList: ApiDetail[] = [];
    let deletedCount = 0;

    for (const record of allRecords) {
        if (record.path && !apiPaths.has(record.path)) {
            deletedList.push({
                name: record.name || '',
                path: record.path,
                method: record.method || 'POST',
                description: record.description || '',
                addonName: record.addonName || '',
                addonTitle: record.addonTitle || ''
            });

            await helper.delForce({
                table: 'addon_admin_api',
                where: { id: record.id }
            });
            deletedCount++;
        }
    }

    return { count: deletedCount, list: deletedList };
}

/**
 * SyncApi 命令主函数
 */
export async function syncApiCommand(options: SyncApiOptions = {}): Promise<SyncApiStats> {
    try {
        if (options.plan) {
            Logger.info('[计划] 同步 API 接口到数据库（plan 模式不执行）');
            return { totalApis: 0, created: 0, updated: 0, deleted: 0 };
        }

        const projectRoot = process.cwd();

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 1. 检查表是否存在
        const exists = await helper.tableExists('addon_admin_api');

        if (!exists) {
            Logger.error(`表 addon_admin_api 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        // 2. 扫描所有 API 文件
        const apis = await scanAllApis(projectRoot);
        const apiPaths = new Set(apis.map((api) => api.path));

        // 3. 同步 API 数据
        const stats = await syncApis(helper, apis);

        // 4. 删除文件中不存在的接口
        const deleteResult = await deleteObsoleteRecords(helper, apiPaths);

        // 5. 缓存接口数据到 Redis
        try {
            const apiList = await helper.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                orderBy: ['addonName#ASC', 'path#ASC']
            });

            await RedisHelper.setObject('apis:all', apiList);
        } catch (error: any) {
            // 忽略缓存错误
        }

        return {
            totalApis: apis.length,
            created: stats.created,
            updated: stats.updated,
            deleted: deleteResult.count
        };
    } catch (error: any) {
        Logger.error('API 同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
