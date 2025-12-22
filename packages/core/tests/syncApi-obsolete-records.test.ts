import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.js";

describe("syncApi - delete obsolete records", () => {
    test("应删除不在配置中的接口记录", async () => {
        const existingRecords = [
            { id: 1, path: "/api/app/testSyncKeep", method: "POST", state: 0 },
            { id: 2, path: "/api/app/testSyncRemove", method: "POST", state: 0 }
        ];

        const existingByPath = new Map<string, any>();
        for (const record of existingRecords) {
            existingByPath.set(record.path, record);
        }

        const calls = {
            delForce: [] as any[],
            getAllArgs: null as any
        };

        const dbHelper = {
            getOne: async (options: any) => {
                return existingByPath.get(options.where.path) ?? null;
            },
            updData: async () => {},
            insData: async () => 999,
            getAll: async (options: any) => {
                calls.getAllArgs = options;
                return { lists: existingRecords };
            },
            delForce: async (options: any) => {
                calls.delForce.push(options);
            }
        } as any;

        const ctx = {
            db: { tableExists: async () => true },
            dbHelper: dbHelper,
            addons: [],
            cacheHelper: {
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
                fileBaseName: "testSyncKeep.ts",
                fileDir: "DUMMY",
                content: { name: "Keep", handler: async () => {} }
            }
        ] as any;

        await syncApi(apiItems, ctx);

        expect(calls.getAllArgs?.fields).toEqual(["id", "path", "method", "state"]);

        expect(calls.delForce).toHaveLength(1);
        expect(calls.delForce[0].where.id).toBe(2);
    });
});
