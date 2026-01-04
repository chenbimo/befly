import { describe, expect, test } from "bun:test";

import { syncDev } from "../sync/syncDev.ts";

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
                    return { data: table === "addon_admin_admin" || table === "addon_admin_role" || table === "addon_admin_menu" || table === "addon_admin_api" };
                },
                getAll: async (options) => {
                    calls.getAll.push(options);

                    if (options?.table === "addon_admin_menu") {
                        return {
                            data: {
                                lists: [
                                    { path: "/dashboard", state: 0 },
                                    { path: "/permission/role", state: 0 }
                                ]
                            }
                        };
                    }
                    if (options?.table === "addon_admin_api") {
                        return {
                            data: {
                                lists: [
                                    { routePath: "/api/health", state: 0 },
                                    { routePath: "/api/addon/addonAdmin/auth/login", state: 0 }
                                ]
                            }
                        };
                    }

                    return { data: { lists: [] } };
                },
                getOne: async (_options) => {
                    // 让所有角色/管理员都走插入逻辑，便于断言插入数据
                    return { data: null };
                },
                insData: async (options) => {
                    calls.insData.push(options);
                    nextId += 1;
                    return { data: nextId };
                },
                updData: async (options) => {
                    calls.updData.push(options);
                    return { data: 1 };
                }
            },
            cache: {
                rebuildRoleApiPermissions: async () => {
                    calls.rebuildRoleApiPermissionsCount += 1;
                }
            }
        };

        await syncDev(ctx, { devEmail: "dev@qq.com", devPassword: "dev-password" });

        // 断言读取菜单/接口时按 state>=0 查询
        const menuGetAll = calls.getAll.find((c) => c?.table === "addon_admin_menu");
        expect(menuGetAll?.where?.state$gte).toBe(0);

        const apiGetAll = calls.getAll.find((c) => c?.table === "addon_admin_api");
        expect(apiGetAll?.where?.state$gte).toBe(0);

        // 断言 dev 角色写入时包含“所有路径”（按查询结果写入；统一为 pathname，不包含 method）
        const devRoleInsert = calls.insData.find((c) => c?.table === "addon_admin_role" && c?.data?.code === "dev");
        expect(devRoleInsert).toBeTruthy();
        expect(devRoleInsert.data.menus).toEqual(["/dashboard", "/permission/role"]);
        expect(devRoleInsert.data.apis).toEqual(["/api/health", "/api/addon/addonAdmin/auth/login"]);

        expect(calls.rebuildRoleApiPermissionsCount).toBe(0);
    });
});
