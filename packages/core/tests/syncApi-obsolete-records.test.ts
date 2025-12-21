import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { syncApi } from "../sync/syncApi.js";

describe("syncApi - delete obsolete records", () => {
    test("应删除不在配置中的接口记录", async () => {
        const apisDir = join(process.cwd(), "apis");
        const testFilePath = join(apisDir, "testSyncKeep.ts");

        const apisDirExisted = existsSync(apisDir);
        if (!apisDirExisted) {
            mkdirSync(apisDir, { recursive: true });
        }

        writeFileSync(testFilePath, "export default { name: 'Keep', handler: async () => {} };\n", { encoding: "utf8" });

        const existingRecords = [
            { id: 1, path: "/api/testSyncKeep", state: 0 },
            { id: 2, path: "/api/testSyncRemove", state: 0 }
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

        const ctx = {
            dbHelper: dbHelper,
            addons: [],
            cacheHelper: {
                cacheApis: async () => {},
                rebuildRoleApiPermissions: async () => {}
            }
        } as any;

        try {
            await syncApi(ctx);
        } finally {
            if (existsSync(testFilePath)) {
                rmSync(testFilePath, { force: true });
            }

            if (!apisDirExisted && existsSync(apisDir)) {
                const entries = readdirSync(apisDir);
                if (entries.length === 0) {
                    rmSync(apisDir, { recursive: true, force: true });
                }
            }
        }

        expect(calls.getAllArgs?.fields).toEqual(["id", "path", "state"]);

        expect(calls.delForce).toHaveLength(1);
        expect(calls.delForce[0].where.id).toBe(2);
    });
});
