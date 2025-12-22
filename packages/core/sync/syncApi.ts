import type { ScanFileResult } from "../utils/scanFiles.js";

import { keyBy } from "es-toolkit/array";

import { Logger } from "../lib/logger.js";

export async function syncApi(apis: ScanFileResult[], ctx: any): Promise<void> {
    const tableName = "addon_admin_api";

    if (!(await ctx.db.tableExists(tableName))) {
        Logger.debug(`${tableName} 表不存在`);
        return;
    }

    const allDbApis = await ctx.dbHelper.getAll({
        table: tableName,
        fields: ["id", "routePath", "name", "addonName", "state"],
        where: { state$gte: 0 }
    } as any);

    const dbLists = allDbApis.lists || allDbApis;
    const allDbApiMap = keyBy(dbLists, (item: any) => item.routePath);

    const insData: ScanFileResult[] = [];
    const updData: Array<{ id: number; api: ScanFileResult }> = [];
    const delData: number[] = [];

    // 1) 先构建当前扫描到的 routePath 集合（用于删除差集）
    const apiRouteKeys = new Set<string>();
    for (const api of apis) {
        apiRouteKeys.add((api as any).routePath);
    }

    // 2) 插入 / 更新（存在不一定更新：仅当 name/routePath/addonName 任一不匹配时更新）
    for (const api of apis) {
        const routePath = (api as any)?.routePath;
        if (typeof routePath !== "string" || !routePath) {
            Logger.warn({ api: api }, "同步接口失败：缺少 routePath");
            continue;
        }

        const item = (allDbApiMap as any)[routePath];
        if (item) {
            const shouldUpdate = api.name !== item.name || api.routePath !== item.routePath || api.addonName !== item.addonName;
            if (shouldUpdate) {
                updData.push({ id: item.id, api: api });
            }
        } else {
            insData.push(api);
        }
    }

    // 3) 删除：用差集（DB - 当前扫描）得到要删除的 id
    for (const record of dbLists) {
        if (typeof record?.routePath !== "string" || !record.routePath) continue;
        if (!apiRouteKeys.has(record.routePath)) {
            delData.push(record.id);
        }
    }

    for (const item of updData) {
        try {
            await ctx.dbHelper.updData({
                table: tableName,
                where: { id: item.id },
                data: {
                    name: (item.api as any).name,
                    routePath: (item.api as any).routePath,
                    addonName: (item.api as any).addonName
                }
            });
        } catch (error: any) {
            Logger.error({ err: error, api: (item.api as any)?.name }, "同步接口更新失败");
        }
    }

    for (const api of insData) {
        try {
            await ctx.dbHelper.insData({
                table: tableName,
                data: {
                    name: (api as any).name,
                    routePath: (api as any).routePath,
                    addonName: (api as any).addonName
                }
            });
        } catch (error: any) {
            Logger.error({ err: error, api: (api as any)?.name }, "同步接口新增失败");
        }
    }

    for (const id of delData) {
        try {
            await ctx.dbHelper.delForce({
                table: tableName,
                where: { id: id }
            });
        } catch (error: any) {
            Logger.error({ err: error, id: id }, "同步接口删除失败");
        }
    }
    await ctx.cacheHelper.cacheApis();

    // API 表发生变更后，重建角色接口权限缓存
    await ctx.cacheHelper.rebuildRoleApiPermissions();
}
