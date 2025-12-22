import type { ApiInfo } from "../types/sync.js";

import { isPlainObject } from "es-toolkit/compat";
import { relative } from "pathe";

import { Logger } from "../lib/logger.js";
import { appApiDir } from "../paths.js";
import { scanFiles } from "../utils/scanFiles.js";

export async function syncApi(ctx): Promise<void> {
    if (!(await ctx.db.tableExists("addon_admin_api"))) {
        Logger.debug(`addon_admin_api 表不存在`);
        return;
    }

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

    return allApis;
}
