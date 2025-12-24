import type { ScanFileResult } from "../utils/scanFiles.js";

import { keyBy } from "es-toolkit/array";

import { Logger } from "../lib/logger.js";

export async function syncApi(ctx: any, apis: ScanFileResult[]): Promise<void> {
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

    const dbLists = allDbApis.lists || [];
    const allDbApiMap = keyBy(dbLists, (item: any) => item.routePath);

    const insData: ScanFileResult[] = [];
    const updData: Array<{ id: number; api: ScanFileResult }> = [];
    const delData: number[] = [];

    // 1) 先构建当前扫描到的 routePath 集合（用于删除差集）
    const apiRouteKeys = new Set<string>();

    // 2) 插入 / 更新（存在不一定更新：仅当 name/routePath/addonName 任一不匹配时更新）
    for (const api of apis) {
        const routePath = (api as any).routePath;
        apiRouteKeys.add((api as any).routePath);
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
        if (!apiRouteKeys.has(record.routePath)) {
            delData.push(record.id);
        }
    }

    if (updData.length > 0) {
        try {
            await ctx.dbHelper.updBatch(
                tableName,
                updData.map((item) => {
                    return {
                        id: item.id,
                        data: {
                            name: (item.api as any).name,
                            routePath: (item.api as any).routePath,
                            addonName: (item.api as any).addonName
                        }
                    };
                })
            );
        } catch (error: any) {
            Logger.error({ err: error }, "同步接口批量更新失败");
        }
    }

    if (insData.length > 0) {
        try {
            await ctx.dbHelper.insBatch(
                tableName,
                insData.map((api) => {
                    return {
                        name: (api as any).name,
                        routePath: (api as any).routePath,
                        addonName: (api as any).addonName
                    };
                })
            );
        } catch (error: any) {
            Logger.error({ err: error }, "同步接口批量新增失败");
        }
    }

    if (delData.length > 0) {
        try {
            await ctx.dbHelper.delForceBatch(tableName, delData);
        } catch (error: any) {
            Logger.error({ err: error }, "同步接口批量删除失败");
        }
    }
    await ctx.cacheHelper.cacheApis();

    // API 表发生变更后，重建角色接口权限缓存
    await ctx.cacheHelper.rebuildRoleApiPermissions();
}
