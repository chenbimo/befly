import type { BeflyContext } from "../types/befly";
import type { SyncApiItem } from "../types/sync";

import { keyBy } from "es-toolkit/array";

import { Logger } from "../lib/logger";

export async function syncApi(ctx: Pick<BeflyContext, "db" | "cache">, apis: SyncApiItem[]): Promise<void> {
    const tableName = "addon_admin_api";

    if (!ctx.db) {
        throw new Error("syncApi: ctx.db 未初始化（Db 插件未加载或注入失败）");
    }

    if (!ctx.cache) {
        throw new Error("syncApi: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    }

    if (!(await ctx.db.tableExists(tableName)).data) {
        Logger.debug(`${tableName} 表不存在`);
        return;
    }

    const allDbApis = await ctx.db.getAll({
        table: tableName,
        fields: ["id", "routePath", "name", "addonName", "state"],
        where: { state$gte: 0 }
    } as any);

    const dbLists = allDbApis.data.lists || [];
    const allDbApiMap = keyBy(dbLists, (item: any) => item.routePath);

    const insData: SyncApiItem[] = [];
    const updData: Array<{ id: number; api: SyncApiItem }> = [];
    const delData: number[] = [];

    // 1) 先构建当前扫描到的 routePath 集合（用于删除差集）
    const apiRouteKeys = new Set<string>();

    // 2) 插入 / 更新（存在不一定更新：仅当 name/routePath/addonName 任一不匹配时更新）
    for (const api of apis) {
        const apiType = api.type;
        // 兼容：历史/测试构造的数据可能没有 type 字段；此时应按 API 处理。
        // 因此仅当 type **显式存在** 且不为 "api" 时才跳过，避免误把真实 API 条目过滤掉。
        if (apiType && apiType !== "api") {
            continue;
        }

        const routePath = api.routePath;
        apiRouteKeys.add(api.routePath);
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
            await ctx.db.updBatch(
                tableName,
                updData.map((item) => {
                    return {
                        id: item.id,
                        data: {
                            name: item.api.name,
                            routePath: item.api.routePath,
                            addonName: item.api.addonName
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
            await ctx.db.insBatch(
                tableName,
                insData.map((api) => {
                    return {
                        name: api.name,
                        routePath: api.routePath,
                        addonName: api.addonName
                    };
                })
            );
        } catch (error: any) {
            Logger.error({ err: error }, "同步接口批量新增失败");
        }
    }

    if (delData.length > 0) {
        try {
            await ctx.db.delForceBatch(tableName, delData);
        } catch (error: any) {
            Logger.error({ err: error }, "同步接口批量删除失败");
        }
    }
    // 缓存同步职责已收敛到 syncCache（启动流程单点调用），此处只负责 DB 同步。
}
