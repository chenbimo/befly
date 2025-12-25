import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.js";
import { setMockLogger } from "../lib/logger.js";
import { syncMenu } from "../sync/syncMenu.js";

// Mock pino logger
const mockPino = {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    fatal: mock(() => {}),
    trace: mock(() => {}),
    silent: mock(() => {}),
    child: mock(() => mockPino),
    level: "info"
};

describe("syncMenu - duplicate path records", () => {
    beforeEach(() => {
        setMockLogger(mockPino as any);
        mockPino.warn.mockClear();
    });

    afterEach(() => {
        setMockLogger(null);
    });

    test("应检测重复 path 并删除多余记录（保留 id 最大的一条）", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-duplicate-path-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const existingMenus = [
            { id: 10, path: "/keep", parentPath: "", name: "Keep", sort: 999, state: 0 },
            { id: 20, path: "/keep", parentPath: "", name: "Keep", sort: 999, state: 0 }
        ];

        const calls = {
            delForceBatch: [] as any[],
            updBatchCount: 0,
            insBatchCount: 0
        };

        const dbHelper = {
            tableExists: async () => true,
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async (options: any) => {
                const stateGte = options?.where?.state$gte;
                if (typeof stateGte === "number") {
                    return { lists: existingMenus.filter((m) => typeof m.state === "number" && m.state >= stateGte) };
                }
                return { lists: existingMenus };
            },
            updBatch: async () => {
                calls.updBatchCount += 1;
                return 0;
            },
            insBatch: async () => {
                calls.insBatchCount += 1;
                return [];
            },
            delForceBatch: async (table: string, ids: number[]) => {
                calls.delForceBatch.push({ table: table, ids: ids });
                return ids.length;
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            cacheHelper: {
                cacheMenus: async () => {}
            }
        } as any;

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        {
                            name: "Keep",
                            path: "/keep",
                            sort: 999
                        }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            const menus = await checkMenu(ctx.addons);
            await syncMenu(ctx, menus);
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }

        expect(mockPino.warn).toHaveBeenCalledTimes(1);
        expect(calls.updBatchCount).toBe(0);
        expect(calls.insBatchCount).toBe(0);

        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");

        // 只应删除较小 id 的重复记录，保留 id=20
        expect(calls.delForceBatch[0].ids).toEqual([10]);
    });
});
