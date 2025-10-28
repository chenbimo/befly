/**
 * SyncApi 命令 - 同步 API 接口数据到数据库
 * 说明：遍历所有 API 文件，收集接口路由信息并同步到 addon_admin_api 表
 *
 * 流程：
 * 1. 扫描 apis 目录下所有 API 文件
 * 2. 扫描 addons/组件/apis 目录下所有 API 文件
 * 3. 提取每个 API 的 name、method、auth 等信息
 * 4. 根据接口路径检查是否存在
 * 5. 存在则更新，不存在则新增
 * 6. 删除配置中不存在的接口记录
 */

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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

/**
 * 递归扫描目录下的所有 .ts 文件
 */
function scanTsFiles(dir: string, fileList: string[] = []): string[] {
    try {
        const files = readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
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
 * 获取插件目录列表
 */
function getAddonDirs(addonsDir: string): string[] {
    try {
        return readdirSync(addonsDir).filter((name) => {
            const addonPath = path.join(addonsDir, name);
            return statSync(addonPath).isDirectory() && !name.startsWith('_');
        });
    } catch (error: any) {
        Logger.warn(`读取插件目录失败: ${addonsDir}`, error.message);
        return [];
    }
}

/**
 * 读取 Addon 配置文件
 */
async function loadAddonConfig(addonDir: string): Promise<{ name: string; title: string } | null> {
    try {
        const configPath = path.join(addonDir, 'addon.config.json');
        const file = Bun.file(configPath);
        const config = await file.json();
        return {
            name: config.name || '',
            title: config.title || config.name || ''
        };
    } catch (error) {
        return null;
    }
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
            // Core 接口：core_{fileName}
            const fileName = path.basename(filePath, '.ts');
            apiPath = `/api/core_${fileName}`;
        } else if (type === 'addon') {
            // Addon 接口：addon/{addonName}/{fileName}
            const fileName = path.basename(filePath, '.ts');
            apiPath = `/api/addon_${addonName}_${fileName}`;
        } else {
            // 项目接口：{dirName}/{fileName}
            const relativePath = path.relative(apiRoot, filePath);
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
    Logger.info('=== 扫描 Core 框架 API (core/apis) ===');
    const coreApisDir = path.join(path.dirname(projectRoot), 'core', 'apis');
    try {
        const coreApiFiles = scanTsFiles(coreApisDir);
        Logger.info(`  找到 ${coreApiFiles.length} 个核心 API 文件`);

        for (const filePath of coreApiFiles) {
            const apiInfo = await extractApiInfo(filePath, coreApisDir, 'core', '', '核心接口');
            if (apiInfo) {
                apis.push(apiInfo);
                Logger.info(`  └ ${apiInfo.path} - ${apiInfo.name}`);
            }
        }

        // 2. 扫描项目 API
        Logger.info('\n=== 扫描项目 API (apis) ===');
        const projectApisDir = path.join(projectRoot, 'apis');
        const projectApiFiles = scanTsFiles(projectApisDir);
        Logger.info(`  找到 ${projectApiFiles.length} 个项目 API 文件`);

        for (const filePath of projectApiFiles) {
            const apiInfo = await extractApiInfo(filePath, projectApisDir, 'app', '', '项目接口');
            if (apiInfo) {
                apis.push(apiInfo);
                Logger.info(`  └ ${apiInfo.path} - ${apiInfo.name}`);
            }
        }

        // 3. 扫描组件 API
        Logger.info('\n=== 扫描组件 API (addons/*/apis) ===');
        const addonsDir = path.join(projectRoot, 'addons');
        const addonDirs = getAddonDirs(addonsDir);

        for (const addonName of addonDirs) {
            const addonDir = path.join(addonsDir, addonName);
            const addonApisDir = path.join(addonDir, 'apis');

            const addonConfig = await loadAddonConfig(addonDir);
            const addonTitle = addonConfig?.title || addonName;

            const addonApiFiles = scanTsFiles(addonApisDir);
            Logger.info(`  [${addonName}] 找到 ${addonApiFiles.length} 个 API 文件`);

            for (const filePath of addonApiFiles) {
                const apiInfo = await extractApiInfo(filePath, addonApisDir, 'addon', addonName, addonTitle);
                if (apiInfo) {
                    apis.push(apiInfo);
                    Logger.info(`    └ ${apiInfo.path} - ${apiInfo.name}`);
                }
            }
        }

        return apis;
    } catch (error: any) {
        Logger.error(`接口扫描失败:`, error);
    }
}

/**
 * 同步 API 数据到数据库
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
                Logger.info(`  └ 更新接口: ${api.name} (ID: ${existing.id}, Path: ${api.path})`);
            } else {
                const id = await helper.insData({
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
                Logger.info(`  └ 新增接口: ${api.name} (ID: ${id}, Path: ${api.path})`);
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
    Logger.info(`\n=== 删除配置中不存在的记录 ===`);

    const allRecords = await helper.getAll({
        table: 'addon_admin_api',
        fields: ['id', 'path', 'name']
    });

    let deletedCount = 0;
    for (const record of allRecords) {
        if (record.path && !apiPaths.has(record.path)) {
            await helper.delData({
                table: 'addon_admin_api',
                where: { id: record.id }
            });
            deletedCount++;
            Logger.info(`  └ 删除记录: ${record.name} (ID: ${record.id}, path: ${record.path})`);
        }
    }

    if (deletedCount === 0) {
        Logger.info('  ✅ 无需删除的记录');
    }

    return deletedCount;
}

/**
 * SyncApi 命令主函数
 */
export async function syncApiCommand(options: SyncApiOptions = {}) {
    try {
        if (options.plan) {
            Logger.info('[计划] 同步 API 接口到数据库（plan 模式不执行）');
            Logger.info('[计划] 1. 扫描 apis 和 addons/*/apis 目录');
            Logger.info('[计划] 2. 提取每个 API 的配置信息');
            Logger.info('[计划] 3. 根据 path 检查接口是否存在');
            Logger.info('[计划] 4. 存在则更新，不存在则新增');
            Logger.info('[计划] 5. 删除文件中不存在的接口记录');
            return;
        }

        Logger.info('开始同步 API 接口到数据库...\n');

        const projectRoot = process.cwd();

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 1. 检查表是否存在
        Logger.info('=== 检查数据表 ===');
        const exists = await helper.tableExists('addon_admin_api');

        if (!exists) {
            Logger.error(`❌ 表 addon_admin_api 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        Logger.info(`✅ 表 addon_admin_api 存在\n`);

        // 2. 扫描所有 API 文件
        Logger.info('=== 步骤 2: 扫描 API 文件 ===');
        const apis = await scanAllApis(projectRoot);
        const apiPaths = new Set(apis.map((api) => api.path));
        Logger.info(`\n✅ 共扫描到 ${apis.length} 个 API 接口\n`);

        // 3. 同步 API 数据
        Logger.info('=== 步骤 3: 同步 API 数据（新增/更新） ===');
        const stats = await syncApis(helper, apis);

        // 4. 删除文件中不存在的接口
        const deletedCount = await deleteObsoleteRecords(helper, apiPaths);

        // 5. 输出统计信息
        Logger.info(`\n=== 接口同步完成 ===`);
        Logger.info(`新增接口: ${stats.created} 个`);
        Logger.info(`更新接口: ${stats.updated} 个`);
        Logger.info(`删除接口: ${deletedCount} 个`);
        Logger.info(`当前总接口数: ${apis.length} 个`);
        Logger.info('提示: 接口缓存将在服务器启动时自动完成');
    } catch (error: any) {
        Logger.error('API 同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
