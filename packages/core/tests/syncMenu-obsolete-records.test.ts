import { describe, expect, test } from "bun:test";

import { __test__ } from "../sync/syncData/syncMenu.js";

describe("syncMenu - delete obsolete records", () => {
    test("syncMenus 应删除不在配置中的菜单记录（仅 state>=0）", async () => {
        const existingMenus = [
            { id: 1, path: "/a", state: 0 },
            { id: 2, path: "/b", state: -1 },
            { id: 3, path: "", state: 0 }
        ];

        const calls = {
            getAllCount: 0,
            delForce: [] as any[]
        };

        const dbHelper = {
            getAll: async () => {
                calls.getAllCount += 1;
                return { lists: existingMenus };
            },
            delForce: async (options: any) => {
                calls.delForce.push(options);
            },
            insData: async () => 999,
            updData: async () => {}
        } as any;

        await __test__.syncMenus(dbHelper, [], new Set<string>());

        expect(calls.getAllCount).toBe(1);
        expect(calls.delForce).toHaveLength(1);
        expect(calls.delForce[0].where.id).toBe(1);
    });

    test("syncMenus 不应删除仍在配置中的菜单记录", async () => {
        const existingMenus = [
            { id: 1, path: "/keep", state: 0 },
            { id: 2, path: "/remove", state: 0 }
        ];

        const calls = {
            delForce: [] as any[]
        };

        const dbHelper = {
            getAll: async () => {
                return { lists: existingMenus };
            },
            delForce: async (options: any) => {
                calls.delForce.push(options);
            },
            insData: async () => 999,
            updData: async () => {}
        } as any;

        await __test__.syncMenus(dbHelper, [], new Set<string>(["/keep"]));

        expect(calls.delForce).toHaveLength(1);
        expect(calls.delForce[0].where.id).toBe(2);
    });
});
