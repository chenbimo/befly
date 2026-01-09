import type { BeflyContext } from "../types/befly";
import type { ScanFileResult } from "../utils/scanFiles";

import { Logger } from "../lib/logger";
import { keyBy } from "../utils/util";

const getApiParentPath = (apiPath: string): string => {
    const segments = apiPath
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // segments 示例：
    // - /api/addon/admin/sysConfig/list -> ["api","addon","admin","sysConfig","list"]
    // - /api/app/test/hi -> ["api","app","test","hi"]
    const seg2 = segments[1] || "";
    const take = seg2 === "addon" ? 4 : 3;
    const parentSegments = segments.slice(0, Math.min(take, segments.length));
    if (parentSegments.length === 0) return "";
    return `/${parentSegments.join("/")}`;
};

export async function syncApi(ctx: Pick<BeflyContext, "db" | "cache">, apis: ScanFileResult[]): Promise<void> {
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

    const allDbApis = await ctx.db.getAll<{ id: number; path: string; parentPath?: string | null; name?: string | null; addonName?: string | null; auth?: number | null; state?: number | null }>({
        table: tableName,
        fields: ["id", "path", "parentPath", "name", "addonName", "auth", "state"],
        where: { state$gte: 0 }
    });

    const dbLists = allDbApis.data.lists || [];
    const allDbApiMap = keyBy(dbLists, (item) => item.path);

    type SyncApiDbWrite = {
        name: string;
        path: string;
        parentPath: string;
        addonName: string;
        auth: 0 | 1;
    };

    const insData: SyncApiDbWrite[] = [];
    const updData: Array<SyncApiDbWrite & { id: number }> = [];
    const delData: number[] = [];

    // 1) 先构建当前扫描到的 path 集合（用于删除差集）
    const apiRouteKeys = new Set<string>();

    // 2) 插入 / 更新（存在不一定更新：仅当 name/path/addonName/auth 任一不匹配时更新）
    for (const api of apis) {
        // 仅当 type **显式存在** 且不为 "api" 时才跳过，避免误把真实 API 条目过滤掉。
        if (api.type !== "api") {
            continue;
        }

        const record = api as Record<string, unknown>;
        const path = record["path"];
        const name = record["name"];
        const addonNameRaw = record["addonName"];

        if (typeof path !== "string" || path.trim() === "") {
            continue;
        }

        if (typeof name !== "string" || name.trim() === "") {
            continue;
        }

        const addonName = typeof addonNameRaw === "string" ? addonNameRaw : "";

        // auth：运行时 API 定义使用 boolean；DB 字段使用 0/1。
        // 统一在 syncApi 写库前做归一化，避免类型不一致导致每次启动都触发更新。
        const authRaw = record["auth"];
        const auth: 0 | 1 = authRaw === false || authRaw === 0 ? 0 : 1;
        const parentPath = getApiParentPath(path);

        apiRouteKeys.add(path);
        const item = allDbApiMap[path];
        if (item) {
            const shouldUpdate = name !== item.name || path !== item.path || addonName !== item.addonName || parentPath !== item.parentPath || auth !== item.auth;
            if (shouldUpdate) {
                updData.push({
                    id: item.id,
                    name: name,
                    path: path,
                    parentPath: parentPath,
                    addonName: addonName,
                    auth: auth
                });
            }
        } else {
            insData.push({
                name: name,
                path: path,
                parentPath: parentPath,
                addonName: addonName,
                auth: auth
            });
        }
    }

    // 3) 删除：用差集（DB - 当前扫描）得到要删除的 id
    for (const record of dbLists) {
        if (!apiRouteKeys.has(record.path)) {
            delData.push(record.id);
        }
    }

    if (updData.length > 0) {
        try {
            await ctx.db.updBatch(
                tableName,
                updData.map((api) => {
                    return {
                        id: api.id,
                        data: {
                            name: api.name,
                            path: api.path,
                            parentPath: api.parentPath,
                            addonName: api.addonName,
                            auth: api.auth
                        }
                    };
                })
            );
        } catch (error: unknown) {
            Logger.error({ err: error, msg: "同步接口批量更新失败" });
        }
    }

    if (insData.length > 0) {
        try {
            await ctx.db.insBatch(
                tableName,
                insData.map((api) => {
                    return {
                        name: api.name,
                        path: api.path,
                        parentPath: api.parentPath,
                        addonName: api.addonName,
                        auth: api.auth
                    };
                })
            );
        } catch (error: unknown) {
            Logger.error({ err: error, msg: "同步接口批量新增失败" });
        }
    }

    if (delData.length > 0) {
        try {
            await ctx.db.delForceBatch(tableName, delData);
        } catch (error: unknown) {
            Logger.error({ err: error, msg: "同步接口批量删除失败" });
        }
    }
    // 缓存同步职责已收敛到 syncCache（启动流程单点调用），此处只负责 DB 同步。
}
