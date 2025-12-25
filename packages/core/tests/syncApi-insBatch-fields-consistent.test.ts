import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.js";

describe("syncApi - insBatch rows consistency", () => {
    test("当部分 api 缺少 addonName 时，insBatch 仍应传入稳定字段（addonName 为空字符串）", async () => {
        const calls: any = {
            insBatch: [] as any[],
            cacheApis: 0,
            rebuildRoleApiPermissions: 0
        };

        const ctx: any = {
            db: {
                tableExists: async () => true,
                getAll: async () => {
                    return { lists: [], total: 0 };
                },
                insBatch: async (_table: string, dataList: any[]) => {
                    calls.insBatch.push({ table: _table, dataList: dataList });
                    return [1, 2];
                },
                updBatch: async () => 0,
                delForceBatch: async () => 0
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

        const apis: any[] = [
            { type: "api", name: "A", routePath: "POST/api/a", addonName: "admin" },
            { name: "B", routePath: "POST/api/b" }
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

        expect(calls.cacheApis).toBe(1);
        expect(calls.rebuildRoleApiPermissions).toBe(1);
    });
});
