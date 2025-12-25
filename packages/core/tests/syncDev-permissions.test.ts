import { describe, expect, test } from "bun:test";

import { syncDev } from "../sync/syncDev.js";

describe("syncDev - dev role permissions", () => {
    test("dev 角色应拥有所有菜单和接口（state>=0）", async () => {
        const calls = {
            getAll: [],
            insData: [],
            updData: [],
            rebuildRoleApiPermissionsCount: 0
        };

        let nextId = 100;

        const ctx = {
            db: {
                tableExists: async (table) => {
                    return table === "addon_admin_admin" || table === "addon_admin_role" || table === "addon_admin_menu" || table === "addon_admin_api";
                },
                getAll: async (options) => {
                    calls.getAll.push(options);

                    if (options?.table === "addon_admin_menu") {
                        return {
                            lists: [
                                { id: 1, state: 0 },
                                { id: 3, state: 0 }
                            ]
                        };
                    }
                    if (options?.table === "addon_admin_api") {
                        return {
                            lists: [
                                { id: 7, state: 0 },
                                { id: 9, state: 0 }
                            ]
                        };
                    }

                    return { lists: [] };
                },
                getOne: async (_options) => {
                    // 让所有角色/管理员都走插入逻辑，便于断言插入数据
                    return null;
                },
                insData: async (options) => {
                    calls.insData.push(options);
                    nextId += 1;
                    return nextId;
                },
                updData: async (options) => {
                    calls.updData.push(options);
                    return 1;
                }
            },
            cache: {
                rebuildRoleApiPermissions: async () => {
                    calls.rebuildRoleApiPermissionsCount += 1;
                }
            }
        };

        await syncDev(ctx);

        // 断言读取菜单/接口时按 state>=0 查询
        const menuGetAll = calls.getAll.find((c) => c?.table === "addon_admin_menu");
        expect(menuGetAll?.where?.state$gte).toBe(0);

        const apiGetAll = calls.getAll.find((c) => c?.table === "addon_admin_api");
        expect(apiGetAll?.where?.state$gte).toBe(0);

        // 断言 dev 角色写入时包含“所有 id”（按查询结果原样写入；数据库保证合法，不做额外修正）
        const devRoleInsert = calls.insData.find((c) => c?.table === "addon_admin_role" && c?.data?.code === "dev");
        expect(devRoleInsert).toBeTruthy();
        expect(devRoleInsert.data.menus).toEqual([1, 3]);
        expect(devRoleInsert.data.apis).toEqual([7, 9]);

        expect(calls.rebuildRoleApiPermissionsCount).toBe(1);
    });
});
