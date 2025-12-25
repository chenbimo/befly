import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.js";

describe("syncApi - delete obsolete records", () => {
    test("应删除不在配置中的接口记录", async () => {
        const existingRecords = [
            { id: 1, routePath: "POST/api/app/testSyncKeep", name: "Keep", addonName: "", state: 0 },
            { id: 2, routePath: "POST/api/app/testSyncRemove", name: "Remove", addonName: "", state: 0 }
        ];

        const existingByPath = new Map<string, any>();
        for (const record of existingRecords) {
            existingByPath.set(record.routePath, record);
        }

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
            {
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: "testSyncKeep",
                fileName: "testSyncKeep",
                moduleName: "app_testSyncKeep",
                name: "Keep",
                routePath: "POST/api/app/testSyncKeep",
                addonName: "",
                fileBaseName: "testSyncKeep.ts",
                fileDir: "DUMMY",
                content: { name: "Keep", handler: async () => {} }
            }
        ] as any;

        await syncApi(ctx, apiItems);

        expect(calls.getAllArgs?.fields).toEqual(["id", "routePath", "name", "addonName", "state"]);

        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0]).toEqual([2]);
    });
});
