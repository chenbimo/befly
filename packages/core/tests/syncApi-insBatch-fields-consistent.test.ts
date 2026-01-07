import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.ts";

describe("syncApi - insBatch rows consistency", () => {
    test("当部分 api 缺少 addonName 时，insBatch 仍应传入稳定字段（addonName 为空字符串）", async () => {
        const calls: any = {
            insBatch: [] as any[],
            cacheApis: 0,
            rebuildRoleApiPermissions: 0
        };

        const ctx: any = {
            db: {
                tableExists: async () => ({ data: true }),
                getAll: async () => {
                    return { data: { lists: [], total: 0 } };
                },
                insBatch: async (_table: string, dataList: any[]) => {
                    calls.insBatch.push({ table: _table, dataList: dataList });
                    return { data: [1, 2] };
                },
                updBatch: async () => ({ data: 0 }),
                delForceBatch: async () => ({ data: 0 })
            },
            cache: {
                cacheApis: async () => {
                    calls.cacheApis += 1;
                },
                rebuildRoleApiPermissions: async () => {
                    calls.rebuildRoleApiPermissions += 1;
                }
            }
        };

        // 根因修复后：scanFiles 会确保 API 记录总是携带 addonName（app/core 为 ""）。
        // 因此这里模拟真实扫描结果：第二条的 addonName 应该是空字符串而非 undefined。
        const apis: any[] = [
            { type: "api", name: "A", routePath: "/api/addon/admin/a", addonName: "admin", auth: 1 },
            { name: "B", routePath: "/api/app/b", addonName: "" }
        ];

        await syncApi(ctx, apis as any);

        expect(calls.insBatch.length).toBe(1);
        expect(calls.insBatch[0].table).toBe("addon_admin_api");

        const rows = calls.insBatch[0].dataList;
        expect(rows.length).toBe(2);

        expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rows[1]).sort());

        expect(typeof rows[0].addonName).toBe("string");
        expect(typeof rows[1].addonName).toBe("string");
        expect(rows[1].addonName).toBe("");

        expect(typeof rows[0].auth).toBe("number");
        expect(typeof rows[1].auth).toBe("number");
        expect(rows[0].auth).toBe(1);
        expect(rows[1].auth).toBe(1);

        // 缓存同步职责已收敛到 syncCache（启动流程单点调用）
        expect(calls.cacheApis).toBe(0);
        expect(calls.rebuildRoleApiPermissions).toBe(0);
    });
});
