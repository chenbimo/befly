import type { ApiInfo } from "../types/sync.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { makeRouteKey } from "../utils/route.js";

function getAddonTitleFromCtx(ctx: any, addonName: string): string {
    const addons = ctx?.addons;
    if (!Array.isArray(addons) || addons.length === 0) {
        return "";
    }

    const addon = addons.find((a: any) => a?.name === addonName);
    const title = addon?.title ?? addon?.addonTitle;
    if (typeof title !== "string") {
        return "";
    }
    return title;
}

export async function syncApi(apis: ScanFileResult[], ctx: any): Promise<void> {
    const tableName = "addon_admin_api";

    if (!(await ctx.db.tableExists(tableName))) {
        Logger.debug(`${tableName} 表不存在`);
        return;
    }

    const allApis: ApiInfo[] = [];

    for (const item of apis) {
        const api = item?.content || {};

        const methodStr = (api.method || "POST").toUpperCase();
        const methods = methodStr
            .split(",")
            .map((m: string) => m.trim())
            .filter((m: string) => m);

        const sourcePrefix = item.source === "core" ? "/core/" : item.source === "app" ? "/app/" : "/addon/";
        const routePath = `/api${sourcePrefix}${item.relativePath}`;

        const description = typeof api.description === "string" ? api.description : "";
        const addonName = item.source === "addon" ? item.addonName || "" : "";
        const addonTitle = addonName ? getAddonTitleFromCtx(ctx, addonName) : "";

        for (const method of methods) {
            allApis.push({
                name: api.name,
                path: makeRouteKey(method, routePath),
                description: description,
                addonName: addonName,
                addonTitle: addonTitle
            });
        }
    }

    const apiKeys = new Set(allApis.map((api) => api.path));

    const existingRecordsResult = await ctx.dbHelper.getAll({
        table: tableName,
        fields: ["id", "path", "name", "description", "addonName", "addonTitle", "state"],
        where: { state$gte: 0 }
    } as any);

    const existingByPath = new Map<string, any>();
    for (const record of existingRecordsResult.lists) {
        if (typeof record?.state !== "number" || record.state < 0) {
            continue;
        }
        if (typeof record?.path !== "string" || !record.path) {
            continue;
        }
        existingByPath.set(record.path, record);
    }

    const toInsert: ApiInfo[] = [];
    const toUpdate: Array<{ id: number; api: ApiInfo }> = [];
    const toDelete: number[] = [];

    for (const api of allApis) {
        const existing = existingByPath.get(api.path);
        if (!existing) {
            toInsert.push(api);
            continue;
        }

        const needUpdate = existing.name !== api.name || existing.description !== api.description || existing.addonName !== api.addonName || existing.addonTitle !== api.addonTitle;

        if (needUpdate) {
            toUpdate.push({ id: existing.id, api: api });
        }
    }

    for (const [path, record] of existingByPath) {
        if (!apiKeys.has(path)) {
            toDelete.push(record.id);
        }
    }

    for (const item of toUpdate) {
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

    for (const api of toInsert) {
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

    for (const id of toDelete) {
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

    return;
}
