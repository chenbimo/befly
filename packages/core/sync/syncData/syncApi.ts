import type { DbHelper } from "../../lib/dbHelper.js";
import type { ApiInfo } from "../../types/sync.js";
import type { SyncDataContext } from "./types.js";

import { join, relative } from "pathe";

import { Logger } from "../../lib/logger.js";
import { projectDir } from "../../paths.js";
import { assertTablesExist } from "./assertTablesExist.js";
import { checkApi } from "./checkApi.js";
import { forEachAddonFile } from "./forEachAddonFile.js";
import { forEachFileInDir } from "./forEachFileInDir.js";

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
        Logger.warn({ err: error, filePath: filePath }, "加载 API 模块失败，已跳过该文件");
        return null;
    }
}

async function scanAllApis(ctx: SyncDataContext): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    let projectApiFileCount = 0;
    let projectApiCount = 0;
    let projectApiSkippedCount = 0;

    let addonApiFileCount = 0;
    let addonApiCount = 0;
    let addonApiSkippedCount = 0;

    try {
        const projectApisDir = join(projectDir, "apis");

        await forEachFileInDir({
            dirPath: projectApisDir,
            warnMessage: "扫描项目 API 目录失败",
            onFile: async (filePath) => {
                projectApiFileCount += 1;
                const apiInfo = await extractApiInfo(filePath, projectApisDir, "app", "", "项目接口");
                if (apiInfo) {
                    apis.push(apiInfo);
                    projectApiCount += 1;
                } else {
                    projectApiSkippedCount += 1;
                }
            }
        });

        await forEachAddonFile({
            addons: ctx.addons,
            pickDir: (addon) => addon.apisDir,
            warnMessage: "扫描 addon API 目录失败",
            onFile: async (addon, addonApisDir, filePath) => {
                addonApiFileCount += 1;
                const apiInfo = await extractApiInfo(filePath, addonApisDir, "addon", addon.name, addon.name);
                if (apiInfo) {
                    apis.push(apiInfo);
                    addonApiCount += 1;
                } else {
                    addonApiSkippedCount += 1;
                }
            }
        });

        Logger.info(
            {
                projectApiFiles: projectApiFileCount,
                projectApis: projectApiCount,
                projectApiSkipped: projectApiSkippedCount,
                addonApiFiles: addonApiFileCount,
                addonApis: addonApiCount,
                addonApiSkipped: addonApiSkippedCount,
                totalApis: apis.length
            },
            "接口扫描完成"
        );

        return apis;
    } catch (error: any) {
        Logger.error({ err: error }, "接口扫描失败");
        return apis;
    }
}

async function syncApis(dbHelper: DbHelper, apis: ApiInfo[]): Promise<void> {
    const apiPaths = new Set(apis.map((api) => api.path));

    for (const api of apis) {
        try {
            const existing = await dbHelper.getOne({
                table: "addon_admin_api",
                where: { path: api.path }
            });

            if (existing) {
                const needUpdate = existing.name !== api.name || existing.method !== api.method || existing.description !== api.description || existing.addonName !== api.addonName || existing.addonTitle !== api.addonTitle;

                if (needUpdate) {
                    await dbHelper.updData({
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
                await dbHelper.insData({
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

    const allRecords = await dbHelper.getAll({
        table: "addon_admin_api",
        fields: ["id", "path"],
        where: { state$gte: 0 }
    } as any);

    for (const record of allRecords.lists) {
        if (record.path && !apiPaths.has(record.path)) {
            await dbHelper.delForce({
                table: "addon_admin_api",
                where: { id: record.id }
            });
        }
    }
}

export async function syncApi(ctx: SyncDataContext): Promise<void> {
    const dbHelper = ctx.dbHelper;

    const tablesOk = await assertTablesExist({
        dbHelper: dbHelper,
        tables: [
            {
                table: "addon_admin_api",
                skipMessage: "表 addon_admin_api 不存在，跳过 API 同步（需要安装 addon-admin 组件）"
            }
        ]
    });
    if (!tablesOk) {
        return;
    }

    await checkApi(ctx.addons);

    const apis = await scanAllApis(ctx);
    await syncApis(dbHelper, apis);

    await ctx.cacheHelper.cacheApis();

    // API 表发生变更后，重建角色接口权限缓存
    await ctx.cacheHelper.rebuildRoleApiPermissions();
}

// 仅测试用（避免将内部同步逻辑变成稳定 API）
export const __test__ = {
    syncApis: syncApis
};
