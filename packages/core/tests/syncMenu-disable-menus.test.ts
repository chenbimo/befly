import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.ts";
import { syncMenu } from "../sync/syncMenu.ts";

describe("syncMenu - disableMenus (glob)", () => {
    test("应删除命中 disableMenus 的菜单（不分 state），且不插入禁用菜单", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-disable-menus-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const existingMenus = [
            { id: 1, path: "/keep", parentPath: "", name: "Keep", sort: 999, state: 0 },
            { id: 2, path: "/login", parentPath: "", name: "Login", sort: 999, state: -1 }
        ];

        const calls = {
            insBatchArgs: [] as any[],
            updBatchArgs: [] as any[],
            delForceBatch: [] as any[]
        };

        const dbHelper = {
            tableExists: async () => ({ data: true }),
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async () => {
                return { data: { lists: existingMenus } };
            },
            updBatch: async (table: string, items: any[]) => {
                calls.updBatchArgs.push({ table: table, items: items });
                return { data: 0 };
            },
            insBatch: async (table: string, items: any[]) => {
                calls.insBatchArgs.push({ table: table, items: items });
                return { data: [] };
            },
            delForceBatch: async (table: string, ids: number[]) => {
                calls.delForceBatch.push({ table: table, ids: ids });
                return { data: ids.length };
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            config: {
                disableMenus: ["**/login"]
            },
            cache: {
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
                        { name: "Keep", path: "/keep", sort: 999 },
                        { name: "Login", path: "/login", sort: 999 }
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

        // 禁用菜单不应被插入/更新
        if (calls.insBatchArgs.length > 0) {
            const allInsItems = calls.insBatchArgs.flatMap((x) => x.items);
            expect(allInsItems.some((x: any) => x?.path === "/login")).toBe(false);
        }
        if (calls.updBatchArgs.length > 0) {
            const allUpdItems = calls.updBatchArgs.flatMap((x) => x.items);
            expect(allUpdItems.some((x: any) => x?.data?.path === "/login")).toBe(false);
        }

        // 命中 disableMenus 的菜单应被强制删除（不分 state）
        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");
        expect(calls.delForceBatch[0].ids).toEqual([2]);
    });

    test("命中 disableMenus 的菜单即使存在于配置中，也不应被写入 DB", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-disable-menus-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const calls = {
            insBatchArgs: [] as any[],
            delForceBatch: [] as any[]
        };

        const dbHelper = {
            tableExists: async () => ({ data: true }),
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async () => {
                return { data: { lists: [] } };
            },
            updBatch: async () => {
                return { data: 0 };
            },
            insBatch: async (table: string, items: any[]) => {
                calls.insBatchArgs.push({ table: table, items: items });
                return { data: [] };
            },
            delForceBatch: async (table: string, ids: number[]) => {
                calls.delForceBatch.push({ table: table, ids: ids });
                return { data: ids.length };
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            config: {
                disableMenus: ["**/login"]
            },
            cache: {
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
                        { name: "Keep", path: "/keep", sort: 999 },
                        { name: "Login", path: "/login", sort: 999 }
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

        expect(calls.insBatchArgs).toHaveLength(1);
        expect(calls.insBatchArgs[0].table).toBe("addon_admin_menu");
        expect(calls.insBatchArgs[0].items).toHaveLength(1);
        expect(calls.insBatchArgs[0].items[0].path).toBe("/keep");

        // 没有历史数据，不需要删除
        expect(calls.delForceBatch).toHaveLength(0);
    });

    test("disableMenus 使用精确路径也应生效（/login）", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-disable-menus-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        const existingMenus = [{ id: 2, path: "/login", parentPath: "", name: "Login", sort: 999, state: 0 }];

        const calls = {
            insBatchArgs: [] as any[],
            updBatchArgs: [] as any[],
            delForceBatch: [] as any[]
        };

        const dbHelper = {
            tableExists: async () => ({ data: true }),
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async () => {
                return { data: { lists: existingMenus } };
            },
            updBatch: async (table: string, items: any[]) => {
                calls.updBatchArgs.push({ table: table, items: items });
                return { data: 0 };
            },
            insBatch: async (table: string, items: any[]) => {
                calls.insBatchArgs.push({ table: table, items: items });
                return { data: [] };
            },
            delForceBatch: async (table: string, ids: number[]) => {
                calls.delForceBatch.push({ table: table, ids: ids });
                return { data: ids.length };
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            config: {
                disableMenus: ["/login"]
            },
            cache: {
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
                        { name: "Login", path: "/login", sort: 999 },
                        { name: "Keep", path: "/keep", sort: 999 }
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

        // 不应对 /login 做任何写入
        if (calls.insBatchArgs.length > 0) {
            const allInsItems = calls.insBatchArgs.flatMap((x) => x.items);
            expect(allInsItems.some((x: any) => x?.path === "/login")).toBe(false);
        }
        if (calls.updBatchArgs.length > 0) {
            const allUpdItems = calls.updBatchArgs.flatMap((x) => x.items);
            expect(allUpdItems.some((x: any) => x?.data?.path === "/login")).toBe(false);
        }

        // 但 DB 中已有的 /login 应被强制删除
        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");
        expect(calls.delForceBatch[0].ids).toEqual([2]);
    });
});
