import type { ApiInfo } from "../types/sync.js";
import type { SyncDataContext } from "./syncData/types.js";

import { isPlainObject } from "es-toolkit/compat";
import { relative } from "pathe";

import { Logger } from "../lib/logger.js";
import { appApiDir } from "../paths.js";
import { scanFiles } from "../utils/scanFiles.js";
import { isTablesExist } from "./syncData/isTablesExist.js";

async function checkApi(allApiFiles): Promise<void> {
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

            if (api.method && !["GET", "POST", "GET,POST", "POST,GET"].includes(String(api.method).toUpperCase())) {
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
}

async function scanApi(ctx: SyncDataContext): Promise<ApiInfo[]> {
    const apis: ApiInfo[] = [];

    try {
        // 获取所有项目接口文件数据
        const appApiFiles = await scanFiles(appApiDir, "app");

        // 获取所有组件接口文件数据
        const addonApiFiles = [];
        for (const addon of ctx.addons) {
            if (!addon.apisDir) {
                continue;
            }

            const apiFiles = await scanFiles(addon.apisDir, "addon");

            if (!apiFiles || apiFiles.length === 0) {
                continue;
            }

            addonApiFiles.push(...apiFiles);
        }

        // 获取所有接口元数据
        const allApiFiles = [...appApiFiles, ...addonApiFiles];
        for (const item of allApiFiles) {
            const apiModule = await import(item.filePath);
            const apiConfig = apiModule?.default || {};

            if (!apiConfig || !apiConfig.name) {
                continue;
            }

            // const apiPrefix = type === "addon" ? `/api/addon/${addonName}/` : "/api/";

            apis.push({
                name: apiConfig.name,
                apiPath: item.relativePath,
                method: apiConfig.method || "POST",
                description: apiConfig.description || ""
                // addonName: addonName,
                // addonTitle: addonTitle || addonName
            });
        }
        console.log("🔥[ apis ]-107", apis);

        return apis;
    } catch (error: any) {
        Logger.error({ err: error }, "接口扫描失败");
        return apis;
    }
}

export async function syncApi(ctx: SyncDataContext): Promise<void> {
    const tablesOk = await isTablesExist(ctx.dbHelper, ["addon_admin_api"]);
    if (!tablesOk) {
        return;
    }

    const allApis = await scanApi(ctx);

    // await checkApi(allApis);

    // const apiPaths = new Set(allApis.map((api) => api.path));

    // for (const api of allApis) {
    //     try {
    //         const existing = await ctx.dbHelper.getOne({
    //             table: "addon_admin_api",
    //             where: { path: api.path }
    //         });

    //         if (existing) {
    //             const needUpdate = existing.name !== api.name || existing.method !== api.method || existing.description !== api.description || existing.addonName !== api.addonName || existing.addonTitle !== api.addonTitle;

    //             if (needUpdate) {
    //                 await ctx.dbHelper.updData({
    //                     table: "addon_admin_api",
    //                     where: { id: existing.id },
    //                     data: {
    //                         name: api.name,
    //                         method: api.method,
    //                         description: api.description,
    //                         addonName: api.addonName,
    //                         addonTitle: api.addonTitle
    //                     }
    //                 });
    //             }
    //         } else {
    //             await ctx.dbHelper.insData({
    //                 table: "addon_admin_api",
    //                 data: {
    //                     name: api.name,
    //                     path: api.path,
    //                     method: api.method,
    //                     description: api.description,
    //                     addonName: api.addonName,
    //                     addonTitle: api.addonTitle
    //                 }
    //             });
    //         }
    //     } catch (error: any) {
    //         Logger.error({ err: error, api: api.name }, "同步接口失败");
    //     }
    // }

    // const allRecords = await ctx.dbHelper.getAll({
    //     table: "addon_admin_api",
    //     fields: ["id", "path", "state"],
    //     where: { state$gte: 0 }
    // } as any);

    // for (const record of allRecords.lists) {
    //     if (typeof record?.state !== "number" || record.state < 0) {
    //         continue;
    //     }

    //     if (typeof record?.path !== "string" || !record.path) {
    //         continue;
    //     }

    //     if (!apiPaths.has(record.path)) {
    //         await ctx.dbHelper.delForce({
    //             table: "addon_admin_api",
    //             where: { id: record.id }
    //         });
    //     }
    // }

    // await ctx.cacheHelper.cacheApis();

    // // API 表发生变更后，重建角色接口权限缓存
    // await ctx.cacheHelper.rebuildRoleApiPermissions();

    return allApis;
}
