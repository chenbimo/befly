import type { ApiInfo } from "../../types/sync.js";
import type { SyncDataContext } from "./types.js";

import { join, relative } from "pathe";

import { Logger } from "../../lib/logger.js";
import { projectDir } from "../../paths.js";
import { scanFiles } from "../../utils/scanFiles.js";
import { assertTablesExist } from "./assertTablesExist.js";

async function extractApiInfo(filePath: string, apiRoot: string, type: "app" | "addon", addonName: string = "", addonTitle: string = ""): Promise<ApiInfo | null> {
    try {
        const normalizedFilePath = filePath.replace(/\\/g, "/");
        const apiModule = await import(normalizedFilePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        const relativePath = relative(apiRoot, filePath);
        const pathWithoutExt = relativePath.replace(/\.(ts|js)$/, "");
        const apiPrefix = type === "addon" ? `/api/addon/${addonName}/` : "/api/";
        const apiPath = `${apiPrefix}${pathWithoutExt}`;

        return {
            name: apiConfig.name || "",
            path: apiPath,
            method: apiConfig.method || "POST",
            description: apiConfig.description || "",
            addonName: addonName,
            addonTitle: addonTitle || addonName
        };
    } catch (error: any) {
        Logger.warn(
            {
                err: error,
                scope: type,
                dir: apiRoot,
                file: filePath,
                addon: addonName
            },
            "加载 API 模块失败，已跳过该文件"
        );
        return null;
    }
}

async function scanAllApis(ctx: SyncDataContext): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    try {
        const projectApisDir = join(projectDir, "apis");

        const projectFiles = await scanFiles(projectApisDir);

        for (const item of projectFiles) {
            const apiInfo = await extractApiInfo(item.filePath, projectApisDir, "app", "", "项目接口");
            if (apiInfo) {
                apis.push(apiInfo);
            }
        }

        for (const addon of ctx.addons) {
            if (!addon.apisDir) {
                continue;
            }

            const addonFiles = await scanFiles(addon.apisDir).catch((error: any) => {
                Logger.warn(
                    {
                        err: error,
                        scope: "addon",
                        addon: addon.name,
                        addonSource: addon.source,
                        dir: addon.apisDir
                    },
                    "扫描 addon API 目录失败"
                );
                return null;
            });

            if (!addonFiles) {
                continue;
            }

            for (const item of addonFiles) {
                const apiInfo = await extractApiInfo(item.filePath, addon.apisDir, "addon", addon.name, addon.name);
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

export async function syncApi(ctx: SyncDataContext): Promise<void> {
    const tablesOk = await assertTablesExist(ctx.dbHelper, ["addon_admin_api"]);
    if (!tablesOk) {
        return;
    }

    const allApis = await scanAllApis(ctx);

    const apiPaths = new Set(allApis.map((api) => api.path));

    for (const api of allApis) {
        try {
            const existing = await ctx.dbHelper.getOne({
                table: "addon_admin_api",
                where: { path: api.path }
            });

            if (existing) {
                const needUpdate = existing.name !== api.name || existing.method !== api.method || existing.description !== api.description || existing.addonName !== api.addonName || existing.addonTitle !== api.addonTitle;

                if (needUpdate) {
                    await ctx.dbHelper.updData({
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
                await ctx.dbHelper.insData({
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

    const allRecords = await ctx.dbHelper.getAll({
        table: "addon_admin_api",
        fields: ["id", "path", "state"],
        where: { state$gte: 0 }
    } as any);

    for (const record of allRecords.lists) {
        if (typeof record?.state !== "number" || record.state < 0) {
            continue;
        }

        if (typeof record?.path !== "string" || !record.path) {
            continue;
        }

        if (!apiPaths.has(record.path)) {
            await ctx.dbHelper.delForce({
                table: "addon_admin_api",
                where: { id: record.id }
            });
        }
    }

    await ctx.cacheHelper.cacheApis();

    // API 表发生变更后，重建角色接口权限缓存
    await ctx.cacheHelper.rebuildRoleApiPermissions();
}
