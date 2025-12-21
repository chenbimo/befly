import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncData/syncApi.js";

describe("syncApi - delete obsolete records", () => {
    test("应删除不在配置中的接口记录", async () => {
        const existingRecords = [
            { id: 1, path: "/api/a", state: 0 },
            { id: 2, path: "/api/b", state: 0 }
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
            tableExists: async () => true,
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

        const apis = [
            {
                name: "A",
                path: "/api/a",
                method: "POST",
                description: "",
                addonName: "",
                addonTitle: ""
            }
        ];

        const ctx = {
            dbHelper: dbHelper,
            addons: [],
            cacheHelper: {
                cacheApis: async () => {},
                rebuildRoleApiPermissions: async () => {}
            }
        } as any;

        await syncApi(ctx, apis as any);

        expect(calls.getAllArgs?.fields).toEqual(["id", "path", "state"]);

        expect(calls.delForce).toHaveLength(1);
        expect(calls.delForce[0].where.id).toBe(2);
    });
});
