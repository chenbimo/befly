import type { ApiInfo } from "../../types/sync.js";
import type { SyncDataContext } from "./types.js";

import { join, relative } from "pathe";

import { Logger } from "../../lib/logger.js";
import { projectDir } from "../../paths.js";
import { scanAddons } from "../../utils/addonHelper.js";
import { scanFiles } from "../../utils/scanFiles.js";

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
            const relativePath = relative(apiRoot, filePath);
            const pathWithoutExt = relativePath.replace(/\.(ts|js)$/, "");
            apiPath = `/api/addon/${addonName}/${pathWithoutExt}`;
        } else {
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

async function scanAllApis(): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    try {
        const projectApisDir = join(projectDir, "apis");

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

        const addons = scanAddons();

        for (const addon of addons) {
            const addonApisDir = addon.apisDir;
            if (!addonApisDir) {
                continue;
            }

            const addonTitle = addon.name;

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
                const apiInfo = await extractApiInfo(filePath, addonApisDir, "addon", addon.name, addonTitle);
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

async function syncApis(helper: any, apis: ApiInfo[]): Promise<void> {
    for (const api of apis) {
        try {
            const existing = await helper.getOne({
                table: "addon_admin_api",
                where: { path: api.path }
            });

            if (existing) {
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

export async function syncApi(ctx: SyncDataContext): Promise<void> {
    const helper = ctx.helper as any;

    const exists = await helper.tableExists("addon_admin_api");
    if (!exists) {
        Logger.debug("表 addon_admin_api 不存在，跳过 API 同步（需要安装 addon-admin 组件）");
        return;
    }

    const apis = await scanAllApis();
    const apiPaths = new Set(apis.map((api) => api.path));

    await syncApis(helper, apis);
    await deleteObsoleteRecords(helper, apiPaths);

    await ctx.cacheHelper.cacheApis();

    // API 表发生变更后，重建角色接口权限缓存
    await ctx.cacheHelper.rebuildRoleApiPermissions();
}
