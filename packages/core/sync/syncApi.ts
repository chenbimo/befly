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
import type { SyncApiOptions, ApiInfo } from "../types/sync.js";

import { join, relative } from "pathe";

import { CacheHelper } from "../lib/cacheHelper.js";
import { Connect } from "../lib/connect.js";
import { DbHelper } from "../lib/dbHelper.js";
import { Logger } from "../lib/logger.js";
import { RedisHelper } from "../lib/redisHelper.js";
import { projectDir } from "../paths.js";
import { scanAddons, addonDirExists, getAddonDir } from "../utils/addonHelper.js";
import { scanFiles } from "../utils/scanFiles.js";

/**
 * 从 API 文件中提取接口信息
 */
async function extractApiInfo(filePath: string, apiRoot: string, type: "app" | "addon", addonName: string = "", addonTitle: string = ""): Promise<ApiInfo | null> {
    try {
        const normalizedFilePath = filePath.replace(/\\/g, "/");
        const apiModule = await import(normalizedFilePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        let apiPath = "";

        if (type === "addon") {
            // Addon 接口：保留完整目录层级
            // 例: apis/menu/list.ts → /api/addon/admin/menu/list
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.(ts|js)$/, "");
            apiPath = `/api/addon/${addonName}/${pathWithoutExt}`;
        } else {
            // 项目接口：保留完整目录层级
            // 例: apis/user/list.ts → /api/user/list
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.(ts|js)$/, "");
            apiPath = `/api/${pathWithoutExt}`;
        }

        return {
            name: apiConfig.name || "",
            path: apiPath,
            method: apiConfig.method || "POST",
            description: apiConfig.description || "",
            addonName: addonName,
            addonTitle: addonTitle || addonName
        };
    } catch (error: any) {
        Logger.error({ err: error }, "同步 API 失败");
        throw error;
    }
}

/**
 * 扫描所有 API 文件
 */
async function scanAllApis(): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    // 1. 扫描项目 API（只扫描 apis 目录）
    try {
        const projectApisDir = join(projectDir, "apis");

        // 扫描项目 API 文件
        const projectApiFiles: string[] = [];
        try {
            const files = await scanFiles(projectApisDir);
            for (const { filePath } of files) {
                projectApiFiles.push(filePath);
            }
        } catch (error: any) {
            Logger.warn(`扫描项目 API 目录失败: ${projectApisDir} - ${error.message}`);
        }

        for (const filePath of projectApiFiles) {
            const apiInfo = await extractApiInfo(filePath, projectApisDir, "app", "", "项目接口");
            if (apiInfo) {
                apis.push(apiInfo);
            }
        }

        // 2. 扫描组件 API (node_modules/@befly-addon/*)
        const addonNames = scanAddons();

        for (const addonName of addonNames) {
            // addonName 格式: admin, demo 等

            // 检查 apis 子目录是否存在
            if (!addonDirExists(addonName, "apis")) {
                continue;
            }

            const addonApisDir = getAddonDir(addonName, "apis");

            // 读取 addon 配置
            const addonPackageJsonPath = getAddonDir(addonName, "package.json");
            let addonTitle = addonName;
            try {
                const packageJson = await import(addonPackageJsonPath, { with: { type: "json" } });
                addonTitle = packageJson.default?.title || addonName;
            } catch {
                // 忽略配置读取错误
            }

            // 扫描 addon API 文件
            const addonApiFiles: string[] = [];
            try {
                const files = await scanFiles(addonApisDir);
                for (const { filePath } of files) {
                    addonApiFiles.push(filePath);
                }
            } catch (error: any) {
                Logger.warn(`扫描 addon API 目录失败: ${addonApisDir} - ${error.message}`);
            }

            for (const filePath of addonApiFiles) {
                const apiInfo = await extractApiInfo(filePath, addonApisDir, "addon", addonName, addonTitle);
                if (apiInfo) {
                    apis.push(apiInfo);
                }
            }
        }

        return apis;
    } catch (error: any) {
        Logger.error({ err: error }, "接口扫描失败");
        return apis;
    }
}

/**
 * 同步 API 数据到数据库
 */
async function syncApis(helper: any, apis: ApiInfo[]): Promise<void> {
    for (const api of apis) {
        try {
            // 根据 path 查询是否存在
            const existing = await helper.getOne({
                table: "addon_admin_api",
                where: { path: api.path }
            });

            if (existing) {
                // 检查是否需要更新
                const needUpdate = existing.name !== api.name || existing.method !== api.method || existing.description !== api.description || existing.addonName !== api.addonName || existing.addonTitle !== api.addonTitle;

                if (needUpdate) {
                    await helper.updData({
                        table: "addon_admin_api",
                        where: { id: existing.id },
                        data: {
                            name: api.name,
                            method: api.method,
                            description: api.description,
                            addonName: api.addonName,
                            addonTitle: api.addonTitle
                        }
                    });
                }
            } else {
                await helper.insData({
                    table: "addon_admin_api",
                    data: {
                        name: api.name,
                        path: api.path,
                        method: api.method,
                        description: api.description,
                        addonName: api.addonName,
                        addonTitle: api.addonTitle
                    }
                });
            }
        } catch (error: any) {
            Logger.error({ err: error, api: api.name }, "同步接口失败");
        }
    }
}

/**
 * 删除配置中不存在的记录
 */
async function deleteObsoleteRecords(helper: any, apiPaths: Set<string>): Promise<void> {
    const allRecords = await helper.getAll({
        table: "addon_admin_api",
        where: { state$gte: 0 }
    });

    for (const record of allRecords.lists) {
        if (record.path && !apiPaths.has(record.path)) {
            await helper.delForce({
                table: "addon_admin_api",
                where: { id: record.id }
            });
        }
    }
}

/**
 * SyncApi 命令主函数
 */
export async function syncApiCommand(options: SyncApiOptions = {}): Promise<void> {
    try {
        if (options.plan) {
            Logger.debug("[计划] 同步 API 接口到数据库（plan 模式不执行）");
            return;
        }

        // 连接数据库（SQL + Redis）
        await Connect.connect();

        const redisHelper = new RedisHelper();
        const helper = new DbHelper({ redis: redisHelper } as any, Connect.getSql());
        const cacheHelper = new CacheHelper({ db: helper, redis: redisHelper } as any);

        // 1. 检查表是否存在（addon_admin_api 来自 addon-admin 组件）
        const exists = await helper.tableExists("addon_admin_api");

        if (!exists) {
            Logger.debug("表 addon_admin_api 不存在，跳过 API 同步（需要安装 addon-admin 组件）");
            return;
        }

        // 2. 扫描所有 API 文件
        const apis = await scanAllApis();
        const apiPaths = new Set(apis.map((api) => api.path));

        // 3. 同步 API 数据
        await syncApis(helper, apis);

        // 4. 删除文件中不存在的接口
        await deleteObsoleteRecords(helper, apiPaths);

        // 5. 缓存接口数据到 Redis
        try {
            await cacheHelper.cacheApis();
        } catch {
            // 忽略缓存错误
        }

        // 6. API 表发生变更后，重建角色接口权限缓存（不使用定时器）
        // 说明：role permission set 的成员是 METHOD/path，API 的 method/path 变更会影响所有角色权限。
        try {
            await cacheHelper.rebuildRoleApiPermissions();
        } catch (error: any) {
            // 不阻塞 syncApi 主流程，但记录日志
            Logger.warn({ err: error }, "API 同步完成，但重建角色权限缓存失败");
        }
    } catch (error: any) {
        Logger.error({ err: error }, "API 同步失败");
        throw error;
    } finally {
        await Connect.disconnect();
    }
}
