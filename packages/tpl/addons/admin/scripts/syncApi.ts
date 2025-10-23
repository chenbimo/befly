#!/usr/bin/env bun
/**
 * 同步 API 接口数据到数据库
 * 说明：遍历所有 API 文件，收集接口路由信息并同步到 addon_admin_api 表
 *
 * 流程：
 * 1. 扫描 tpl/apis 目录下所有 API 文件
 * 2. 扫描 tpl/addons/组件/apis 目录下所有 API 文件
 * 3. 提取每个 API 的 name、method、auth 等信息
 * 4. 根据接口路径检查是否存在
 * 5. 存在则更新，不存在则新增
 * 6. 删除配置中不存在的接口记录
 */

import { Env, Logger, initDatabase, closeDatabase } from 'befly';
import { RedisHelper } from 'befly/utils/redisHelper';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';
import { scanTsFiles, checkTableExists, deleteObsoleteRecords, logSyncStats, getAddonDirs } from '../util';

// CLI 参数类型
interface CliArgs {
    DRY_RUN: boolean;
}

// API 信息类型
interface ApiInfo {
    name: string;
    path: string;
    method: string;
    description: string;
    addonName: string;
}

// 解析命令行参数
const CLI: CliArgs = {
    DRY_RUN: process.argv.includes('--plan')
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tplDir = path.resolve(__dirname, '../../../');

/**
 * 从 API 文件中提取接口信息
 * @param filePath - API 文件路径
 * @param addonName - 插件名称
 * @returns API 信息对象或 null
 */
async function extractApiInfo(filePath: string, addonName: string = ''): Promise<ApiInfo | null> {
    try {
        // 动态导入 API 文件
        const apiModule = await import(filePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        // 构建接口路径
        let apiPath = '';
        if (addonName) {
            // 插件接口：/addon/{addonName}/{fileName}
            const fileName = path.basename(filePath, '.ts');
            apiPath = `/addon/${addonName}/${fileName}`;
        } else {
            // 项目接口：/api/{dirName}/{fileName}
            const relativePath = path.relative(path.join(tplDir, 'apis'), filePath);
            const parts = relativePath.replace(/\\/g, '/').split('/');
            const dirName = parts[0];
            const fileName = path.basename(filePath, '.ts');
            apiPath = `/api/${dirName}/${fileName}`;
        }

        return {
            name: apiConfig.name || '',
            path: apiPath,
            method: apiConfig.method || 'POST',
            description: apiConfig.description || '',
            addonName: addonName
        };
    } catch (error: any) {
        Logger.warn(`解析 API 文件失败: ${filePath}`, error.message);
        return null;
    }
}

/**
 * 扫描所有 API 文件
 * @returns API 信息数组
 */
async function scanAllApis(): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    // 1. 扫描项目 API (tpl/apis)
    Logger.info('=== 扫描项目 API (tpl/apis) ===');
    const projectApisDir = path.join(tplDir, 'apis');
    const projectApiFiles = scanTsFiles(projectApisDir);
    Logger.info(`  找到 ${projectApiFiles.length} 个项目 API 文件`);

    for (const filePath of projectApiFiles) {
        const apiInfo = await extractApiInfo(filePath, '');
        if (apiInfo) {
            apis.push(apiInfo);
            Logger.info(`  └ ${apiInfo.path} - ${apiInfo.name}`);
        }
    }

    // 2. 扫描插件 API (tpl/addons/*/apis)
    Logger.info('\n=== 扫描插件 API (tpl/addons/*/apis) ===');
    const addonsDir = path.join(tplDir, 'addons');
    const addonDirs = getAddonDirs(addonsDir);

    for (const addonName of addonDirs) {
        const addonApisDir = path.join(addonsDir, addonName, 'apis');
        try {
            const addonApiFiles = scanTsFiles(addonApisDir);
            Logger.info(`  [${addonName}] 找到 ${addonApiFiles.length} 个 API 文件`);

            for (const filePath of addonApiFiles) {
                const apiInfo = await extractApiInfo(filePath, addonName);
                if (apiInfo) {
                    apis.push(apiInfo);
                    Logger.info(`    └ ${apiInfo.path} - ${apiInfo.name}`);
                }
            }
        } catch (error: any) {
            Logger.warn(`  [${addonName}] 扫描失败:`, error.message);
        }
    }

    return apis;
}

/**
 * 同步 API 数据到数据库
 * @param helper - DbHelper 实例
 * @param apis - API 信息数组
 * @returns 同步统计信息
 */
async function syncApis(helper: any, apis: ApiInfo[]): Promise<{ created: number; updated: number }> {
    const stats = { created: 0, updated: 0 };

    for (const api of apis) {
        try {
            const existing = await helper.getOne({
                table: 'addon_admin_api',
                where: { path: api.path }
            });

            if (existing) {
                // 存在则更新
                await helper.updData({
                    table: 'addon_admin_api',
                    where: { id: existing.id },
                    data: {
                        name: api.name,
                        method: api.method,
                        description: api.description,
                        addonName: api.addonName
                    }
                });
                stats.updated++;
                Logger.info(`  └ 更新接口: ${api.name} (ID: ${existing.id}, Path: ${api.path})`);
            } else {
                // 不存在则新增
                const id = await helper.insData({
                    table: 'addon_admin_api',
                    data: {
                        name: api.name,
                        path: api.path,
                        method: api.method,
                        description: api.description,
                        addonName: api.addonName
                    }
                });
                stats.created++;
                Logger.info(`  └ 新增接口: ${api.name} (ID: ${id}, Path: ${api.path})`);
            }
        } catch (error: any) {
            Logger.error(`同步接口 "${api.name}" 失败:`, error.message || String(error));
        }
    }

    return stats;
}

/**
 * 同步 API 主函数
 */
async function syncApi(): Promise<boolean> {
    let dbInitialized = false;

    try {
        if (CLI.DRY_RUN) {
            Logger.info('[计划] 同步 API 接口到数据库（plan 模式不执行）');
            Logger.info('[计划] 1. 扫描 tpl/apis 和 tpl/addons/*/apis 目录');
            Logger.info('[计划] 2. 提取每个 API 的配置信息');
            Logger.info('[计划] 3. 根据 path 检查接口是否存在');
            Logger.info('[计划] 4. 存在则更新，不存在则新增');
            Logger.info('[计划] 5. 删除文件中不存在的接口记录');
            return true;
        }

        Logger.info('开始同步 API 接口到数据库...\n');

        // 初始化数据库连接
        const { helper } = await initDatabase({ max: 1 });
        dbInitialized = true;

        // 1. 检查表是否存在
        if (!(await checkTableExists(helper, 'addon_admin_api'))) {
            return false;
        }

        Logger.info('');

        // 2. 扫描所有 API 文件
        Logger.info('=== 步骤 2: 扫描 API 文件 ===');
        const apis = await scanAllApis();
        const apiPaths = new Set(apis.map((api) => api.path));
        Logger.info(`\n✅ 共扫描到 ${apis.length} 个 API 接口\n`);

        // 3. 同步 API 数据（新增和更新）
        Logger.info('=== 步骤 3: 同步 API 数据（新增/更新） ===');
        const stats = await syncApis(helper, apis);

        // 4. 删除文件中不存在的接口
        const deletedCount = await deleteObsoleteRecords(helper, 'addon_admin_api', apiPaths);

        // 5. 输出统计信息
        logSyncStats(stats, deletedCount, '接口');
        Logger.info(`当前总接口数: ${apis.length} 个`);

        // 6. 缓存接口到 Redis
        Logger.info('\n=== 步骤 5: 缓存接口到 Redis ===');
        try {
            const { lists } = await helper.getAll({
                table: 'addon_admin_api',
                fields: ['id', 'name', 'path', 'method', 'description', 'addonName']
            });

            await RedisHelper.setObject('befly:apis:all', lists);
            Logger.info(`✅ 已缓存 ${lists.length} 个接口到 Redis (Key: befly:apis:all)`);
        } catch (cacheError: any) {
            Logger.warn('⚠️ 接口缓存失败（不影响同步）:', cacheError?.message || String(cacheError));
        }

        return true;
    } catch (error: any) {
        Logger.error('API 同步失败:', { message: error.message, stack: error.stack });
        return false;
    } finally {
        if (dbInitialized) {
            await closeDatabase();
        }
    }
}

// 执行同步
syncApi()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        Logger.error('执行失败:', error);
        process.exit(1);
    });
