import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.js";
import { syncMenu } from "../sync/syncMenu.js";

describe("syncMenu - disableMenus hard delete", () => {
    test("命中 disableMenus 的菜单应被强制删除（不分 state）", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `syncMenu-disableMenus-hard-delete-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        // /addon/admin/403 为禁用项，即使 state=-1 也应该被硬删除
        const existingMenus = [
            { id: 1, path: "/addon/admin/403", parentPath: "", name: "403", sort: 1, state: -1 },
            { id: 2, path: "/keep", parentPath: "", name: "Keep", sort: 2, state: 0 }
        ];

        const calls = {
            delForceBatch: [] as Array<{ table: string; ids: number[] }>
        };

        const dbHelper = {
            tableExists: async () => true,
            trans: async (callback: any) => {
                return await callback(dbHelper);
            },
            getAll: async (options: any) => {
                // syncMenu 会调用一次“全量不带 where”，一次 state>=0 的逻辑已在内存过滤
                if (options?.table === "addon_admin_menu") {
                    return { lists: existingMenus };
                }
                return { lists: [] };
            },
            updBatch: async () => 0,
            insBatch: async () => [],
            delForceBatch: async (table: string, ids: number[]) => {
                calls.delForceBatch.push({ table: table, ids: ids });
                return ids.length;
            }
        } as any;

        const ctx = {
            db: dbHelper,
            addons: [],
            config: {
                disableMenus: ["**/403"]
            },
            cache: {
                cacheMenus: async () => {}
            }
        } as any;

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            // 配置中仅保留 /keep
            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        {
                            name: "Keep",
                            path: "/keep",
                            sort: 2
                        }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            const menus = await checkMenu(ctx.addons, { disableMenus: ctx.config.disableMenus });
            await syncMenu(ctx, menus);
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }

        expect(calls.delForceBatch).toHaveLength(1);
        expect(calls.delForceBatch[0].table).toBe("addon_admin_menu");
        // 应包含禁用菜单 id=1；/keep 不应被删
        expect(calls.delForceBatch[0].ids).toEqual([1]);
    });
});
