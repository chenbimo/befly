import type { ApiInfo } from "../../types/sync.js";
import type { AddonInfo } from "../../utils/scanAddons.js";
import type { SyncDataContext } from "./types.js";

import { existsSync } from "node:fs";

import { isPlainObject } from "es-toolkit/compat";
import { relative } from "pathe";

import { Logger } from "../../lib/logger.js";
import { projectApiDir } from "../../paths.js";
import { scanFiles } from "../../utils/scanFiles.js";
import { assertTablesExist } from "./assertTablesExist.js";

async function extractApi(filePath: string, apiRoot: string, type: "app" | "addon", addonName: string = "", addonTitle: string = ""): Promise<ApiInfo | null> {
    try {
        const normalizedFilePath = filePath.replace(/\\/g, "/");
        const apiModule = await import(normalizedFilePath);
        const apiConfig = apiModule.default;

        if (!apiConfig || !apiConfig.name) {
            return null;
        }

        const relativePath = relative(apiRoot, filePath).replace(/\\/g, "/");
        const pathWithoutExt = relativePath.replace(/\.(ts|js)$/, "");
        const apiPrefix = type === "addon" ? `/api/addon/${addonName}/` : "/api/";
        const apiPath = `${apiPrefix}${pathWithoutExt}`;

        return {
            name: apiConfig.name,
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

async function checkApi(addons: AddonInfo[]): Promise<void> {
    try {
        const allApiFiles: Array<{ file: string; scope: "app" | "addon"; apiPath: string; addonName: string; addonSource: string; dir: string }> = [];

        if (existsSync(projectApiDir)) {
            const files = await scanFiles(projectApiDir);
            for (const item of files) {
                allApiFiles.push({
                    file: item.filePath,
                    scope: "app",
                    apiPath: item.relativePath,
                    addonName: "",
                    addonSource: "",
                    dir: projectApiDir
                });
            }
        }

        for (const addon of addons) {
            if (!addon.apisDir) {
                continue;
            }

            const files = await scanFiles(addon.apisDir);
            for (const item of files) {
                allApiFiles.push({
                    file: item.filePath,
                    scope: "addon",
                    apiPath: item.relativePath,
                    addonName: addon.name,
                    addonSource: addon.source,
                    dir: addon.apisDir
                });
            }
        }

        for (const item of allApiFiles) {
            try {
                const filePath = item.file.replace(/\\/g, "/");
                const apiImport = await import(filePath);
                const api = apiImport.default;

                if (typeof api?.name !== "string" || api.name.trim() === "") {
                    Logger.warn(item, "接口的 name 属性必须是非空字符串");
                    continue;
                }

                if (typeof api?.handler !== "function") {
                    Logger.warn(item, "接口的 handler 属性必须是函数");
                    continue;
                }

                const validMethods = ["GET", "POST", "GET,POST", "POST,GET"];
                if (api.method && !validMethods.includes(String(api.method).toUpperCase())) {
                    Logger.warn(item, "接口的 method 属性必须是有效的 HTTP 方法 (GET, POST, GET,POST, POST,GET)");
                }

                if (api.auth !== undefined && typeof api.auth !== "boolean") {
                    Logger.warn(item, "接口的 auth 属性必须是布尔值 (true=需登录, false=公开)");
                }

                if (api.fields && !isPlainObject(api.fields)) {
                    Logger.warn(item, "接口的 fields 属性必须是对象");
                }

                if (api.required && !Array.isArray(api.required)) {
                    Logger.warn(item, "接口的 required 属性必须是数组");
                }

                if (api.required && api.required.some((reqItem: any) => typeof reqItem !== "string")) {
                    Logger.warn(item, "接口的 required 属性必须是字符串数组");
                }
            } catch (error: any) {
                Logger.error(
                    {
                        err: error,
                        item: item
                    },
                    "接口解析失败"
                );
            }
        }
    } catch (error: any) {
        Logger.error({ err: error }, "API 定义检查过程中出错");
        throw error;
    }
}

async function scanApi(ctx: SyncDataContext): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    try {
        const projectFiles = await scanFiles(projectApiDir);

        for (const item of projectFiles) {
            const apiInfo = await extractApi(item.filePath, projectApiDir, "app", "", "项目接口");
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
                const apiInfo = await extractApi(item.filePath, addon.apisDir, "addon", addon.name, addon.name);
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
    await checkApi(ctx.addons);

    const tablesOk = await assertTablesExist(ctx.dbHelper, ["addon_admin_api"]);
    if (!tablesOk) {
        return;
    }

    const allApis = await scanApi(ctx);

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
