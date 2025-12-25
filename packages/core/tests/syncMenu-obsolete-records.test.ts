import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.js";
import { syncMenu } from "../sync/syncMenu.js";

describe("syncMenu - delete obsolete records", () => {
    test("应删除不在配置中的菜单记录（仅 state>=0）", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-obsolete-records-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const existingMenus = [
            { id: 1, path: "/a", parentPath: "", state: 0 },
            { id: 2, path: "/b", parentPath: "", state: -1 },
            { id: 3, path: "", parentPath: "", state: 0 }
        ];

        const calls = {
            getAllCount: 0,
            delForceBatch: [] as any[]
        };

        const dbHelper = {
            tableExists: async () => true,
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async (options: any) => {
                calls.getAllCount += 1;
                const stateGte = options?.where?.state$gte;
                if (typeof stateGte === "number") {
                    return { lists: existingMenus.filter((m) => typeof m.state === "number" && m.state >= stateGte) };
                }
                return { lists: existingMenus };
            },
            updBatch: async () => {
                return 0;
            },
            insBatch: async () => {
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

            writeFileSync(menusJsonPath, "[]", { encoding: "utf8" });
            const menus = await checkMenu(ctx.addons);
            await syncMenu(ctx, menus);
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }

        expect(calls.getAllCount).toBe(1);
        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");
        expect(calls.delForceBatch[0].ids).toEqual([1]);
    });

    test("不应删除仍在配置中的菜单记录", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-obsolete-records-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const existingMenus = [
            { id: 1, path: "/keep", parentPath: "", name: "Keep", sort: 999, state: 0 },
            { id: 2, path: "/remove", parentPath: "", name: "Remove", sort: 999, state: 0 }
        ];

        const calls = {
            delForceBatch: [] as any[],
            updBatchCount: 0
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

        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");
        expect(calls.delForceBatch[0].ids).toEqual([2]);
        expect(calls.updBatchCount).toBe(0);
    });
});
