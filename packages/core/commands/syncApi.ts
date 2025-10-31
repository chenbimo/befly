/**
 * SyncApi 命令 - 同步 API 接口数据到数据库
 * 说明：遍历所有 API 文件，收集接口路由信息并同步到 core_api 表
 *
 * 流程：
 * 1. 扫描 core/apis 目录下所有 Core API 文件
 * 2. 扫描项目 apis 目录下所有项目 API 文件
 * 3. 扫描 node_modules/@befly-addon/* 目录下所有组件 API 文件
 * 4. 提取每个 API 的 name、method、auth 等信息
 * 5. 根据接口路径检查是否存在
 * 6. 存在则更新，不存在则新增
 * 7. 删除配置中不存在的接口记录
 */

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import { RedisHelper } from '../lib/redisHelper.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'pathe';

interface SyncApiOptions {
    plan?: boolean;
}

interface ApiInfo {
    name: string;
    path: string;
    method: string;
    description: string;
    addonName: string;
    addonTitle: string;
}

export interface SyncApiStats {
    totalApis: number;
    created: number;
    updated: number;
    deleted: number;
}

/**
 * 递归扫描目录下的所有 .ts 文件
 */
function scanTsFiles(dir: string, fileList: string[] = []): string[] {
    try {
        const files = readdirSync(dir);

        for (const file of files) {
            const filePath = join(dir, file);
            const stat = statSync(filePath);

            if (stat.isDirectory()) {
                scanTsFiles(filePath, fileList);
            } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
                fileList.push(filePath);
            }
        }
    } catch (error: any) {
        Logger.warn(`扫描目录失败: ${dir}`, error.message);
    }

    return fileList;
}

/**
 * 从 API 文件中提取接口信息
 */
async function extractApiInfo(filePath: string, apiRoot: string, type: 'core' | 'app' | 'addon', addonName: string = '', addonTitle: string = ''): Promise<ApiInfo | null> {
    try {
        const apiModule = await import(filePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        let apiPath = '';

        if (type === 'core') {
            // Core 接口：保留完整目录层级
            // 例: apis/menu/all.ts → /api/core/menu/all
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.ts$/, '');
            apiPath = `/api/core/${pathWithoutExt}`;
        } else if (type === 'addon') {
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
            addonName: type === 'core' ? 'core' : addonName,
            addonTitle: type === 'core' ? '核心接口' : addonTitle || addonName
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

    // 1. 扫描 Core 框架 API
    const coreApisDir = join(dirname(projectRoot), 'core', 'apis');
    try {
        const coreApiFiles = scanTsFiles(coreApisDir);

        for (const filePath of coreApiFiles) {
            const apiInfo = await extractApiInfo(filePath, coreApisDir, 'core', '', '核心接口');
            if (apiInfo) {
                apis.push(apiInfo);
            }
        }

        // 2. 扫描项目 API
        const projectApisDir = join(projectRoot, 'apis');
        const projectApiFiles = scanTsFiles(projectApisDir);

        for (const filePath of projectApiFiles) {
            const apiInfo = await extractApiInfo(filePath, projectApisDir, 'app', '', '项目接口');
            if (apiInfo) {
                apis.push(apiInfo);
            }
        }

        // 3. 扫描组件 API (node_modules/@befly-addon/*)
        const addonNames = scanAddons();

        for (const addonName of addonNames) {
            // addonName 格式: admin, demo 等

            // 检查 apis 子目录是否存在
            if (!addonDirExists(addonName, 'apis')) {
                continue;
            }

            const addonApisDir = getAddonDir(addonName, 'apis');

            // 读取 addon 配置
            const addonConfigPath = getAddonDir(addonName, 'addon.config.json');
            let addonTitle = addonName;
            try {
                const configFile = Bun.file(addonConfigPath);
                const config = await configFile.json();
                addonTitle = config.title || addonName;
            } catch (error) {
                // 忽略配置读取错误
            }

            const addonApiFiles = scanTsFiles(addonApisDir);

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
async function syncApis(helper: any, apis: ApiInfo[]): Promise<{ created: number; updated: number }> {
    const stats = { created: 0, updated: 0 };

    for (const api of apis) {
        try {
            // 根据 path 查询是否存在
            const existing = await helper.getOne({
                table: 'core_api',
                where: { path: api.path }
            });

            if (existing) {
                await helper.updData({
                    table: 'core_api',
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
            } else {
                const id = await helper.insData({
                    table: 'core_api',
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
async function deleteObsoleteRecords(helper: any, apiPaths: Set<string>): Promise<number> {
    const allRecords = await helper.getAll({
        table: 'core_api',
        fields: ['id', 'path', 'name'],
        where: { state$gte: 0 } // 查询所有状态（包括软删除的 state=0）
    });

    let deletedCount = 0;
    for (const record of allRecords) {
        if (record.path && !apiPaths.has(record.path)) {
            await helper.delForce({
                table: 'core_api',
                where: { id: record.id }
            });
            deletedCount++;
        }
    }

    return deletedCount;
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
        const exists = await helper.tableExists('core_api');

        if (!exists) {
            Logger.error(`❌ 表 core_api 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        // 2. 扫描所有 API 文件
        const apis = await scanAllApis(projectRoot);
        const apiPaths = new Set(apis.map((api) => api.path));

        // 3. 同步 API 数据
        const stats = await syncApis(helper, apis);

        // 4. 删除文件中不存在的接口
        const deletedCount = await deleteObsoleteRecords(helper, apiPaths);

        // 5. 缓存接口数据到 Redis
        try {
            const apiList = await helper.getAll({
                table: 'core_api',
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
            deleted: deletedCount
        };
    } catch (error: any) {
        Logger.error('API 同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
