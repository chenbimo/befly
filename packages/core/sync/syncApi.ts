import type { ApiInfo } from "../types/sync.js";
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
        fields: ["id", "path", "name"],
        where: { state$gte: 0 }
    } as any);

    const allDbApiMap = keyBy(allDbApis, (item) => item.routePath);

    const insData: ApiInfo[] = [];
    const updData: Array<{ id: number; api: ApiInfo }> = [];
    const delData: number[] = [];

    for (const api of apis) {
        const item = allDbApiMap[api.routePath];
        if (item) {
            // 更新
            if (api.name !== item.name || api.routePath !== item.routePath || api.addonName !== item.addonName) {
                updData.push({ id: item.id, ...api });
            }
        } else {
            // 添加
            insData.push(api);
        }
    }

    for (const [path, record] of existingByPath) {
        if (!apiKeys.has(path)) {
            toDelete.push(record.id);
        }
    }

    for (const item of updData) {
        try {
            await ctx.dbHelper.updData({
                table: tableName,
                where: { id: item.id },
                data: {
                    name: item.api.name,
                    description: item.api.description,
                    addonName: item.api.addonName,
                    addonTitle: item.api.addonTitle
                }
            });
        } catch (error: any) {
            Logger.error({ err: error, api: item.api.name }, "同步接口更新失败");
        }
    }

    for (const api of insData) {
        try {
            await ctx.dbHelper.insData({
                table: tableName,
                data: {
                    name: api.name,
                    path: api.path,
                    description: api.description,
                    addonName: api.addonName,
                    addonTitle: api.addonTitle
                }
            });
        } catch (error: any) {
            Logger.error({ err: error, api: api.name }, "同步接口新增失败");
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
