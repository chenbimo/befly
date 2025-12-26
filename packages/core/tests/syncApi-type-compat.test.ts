import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.js";

describe("syncApi - type compatibility", () => {
    test("缺少 type 时应视为 api；非 api type 应被跳过", async () => {
        const existingRecords = [
            { id: 1, routePath: "/api/app/keep", name: "Keep", addonName: "", state: 0 },
            { id: 2, routePath: "/api/app/skip", name: "Skip", addonName: "", state: 0 }
        ];

        const calls = {
            delForceBatch: [] as any[],
            getAllArgs: null as any
        };

        const dbHelper = {
            tableExists: async () => true,
            updBatch: async () => 0,
            insBatch: async () => [],
            getAll: async (options: any) => {
                calls.getAllArgs = options;
                return { lists: existingRecords };
            },
            delForceBatch: async (_table: any, ids: any[]) => {
                calls.delForceBatch.push(ids);
                return ids.length;
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            cache: {
                cacheApis: async () => {},
                rebuildRoleApiPermissions: async () => {}
            }
        } as any;

        const apiItems = [
            // 不带 type：应按 api 处理，保留 keep
            {
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "keep",
                fileName: "keep",
                moduleName: "app_keep",
                name: "Keep",
                routePath: "/api/app/keep",
                addonName: "",
                fileBaseName: "keep.ts",
                fileDir: "DUMMY",
                content: { name: "Keep", handler: async () => {} }
            },
            // 带非 api type：应被跳过，因此 DB 中的 skip 会被当作“配置不存在”而删除
            {
                type: "menu",
                name: "Skip",
                routePath: "/api/app/skip",
                addonName: ""
            }
        ] as any;

        await syncApi(ctx, apiItems);

        expect(calls.getAllArgs?.fields).toEqual(["id", "routePath", "name", "addonName", "state"]);

        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0]).toEqual([2]);
    });
});
