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
                                    { path: "/api/health", state: 0 },
                                    { path: "/api/addon/addonAdmin/auth/login", state: 0 }
                                ]
                            }
                        };
                    }

                    return { data: { lists: [] } };
                },
                getOne: async (_options) => {
                    // 让所有角色/管理员都走插入逻辑，便于断言插入数据
                    return { data: {} };
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

        // 断言系统角色首次插入时必须补齐 menus/apis，避免 MySQL NOT NULL 无默认值导致启动失败
        const userRoleInsert = calls.insData.find((c) => c?.table === "addon_admin_role" && c?.data?.code === "user");
        expect(userRoleInsert).toBeTruthy();
        expect(userRoleInsert.data.menus).toEqual([]);
        expect(userRoleInsert.data.apis).toEqual([]);

        const adminRoleInsert = calls.insData.find((c) => c?.table === "addon_admin_role" && c?.data?.code === "admin");
        expect(adminRoleInsert).toBeTruthy();
        expect(adminRoleInsert.data.menus).toEqual([]);
        expect(adminRoleInsert.data.apis).toEqual([]);

        const guestRoleInsert = calls.insData.find((c) => c?.table === "addon_admin_role" && c?.data?.code === "guest");
        expect(guestRoleInsert).toBeTruthy();
        expect(guestRoleInsert.data.menus).toEqual([]);
        expect(guestRoleInsert.data.apis).toEqual([]);

        expect(calls.rebuildRoleApiPermissionsCount).toBe(0);
    });

    test("重启时应强制同步系统角色（admin/user/guest）", async () => {
        const calls = {
            updData: [] as any[],
            insData: [] as any[]
        };

        const ctx = {
            db: {
                tableExists: async (table) => {
                    return { data: table === "addon_admin_admin" || table === "addon_admin_role" || table === "addon_admin_menu" || table === "addon_admin_api" };
                },
                getAll: async (options) => {
                    if (options?.table === "addon_admin_menu") {
                        return { data: { lists: [{ path: "/dashboard", state: 0 }] } };
                    }
                    if (options?.table === "addon_admin_api") {
                        return { data: { lists: [{ path: "/api/health", state: 0 }] } };
                    }
                    return { data: { lists: [] } };
                },
                getOne: async (options) => {
                    const code = options?.where?.code;
                    if (code === "dev") {
                        return { data: { id: 1, code: "dev", name: "开发者角色", description: "old", menus: [], apis: [], sort: 0 } };
                    }
                    if (code === "admin") {
                        return { data: { id: 2, code: "admin", name: "自定义管理员", description: "custom", menus: ["/custom"], apis: ["/api/custom"], sort: 99 } };
                    }
                    if (code === "user") {
                        return { data: { id: 3, code: "user", name: "用户角色", description: "custom", menus: [], apis: ["/api/user"], sort: 1 } };
                    }
                    if (code === "guest") {
                        return { data: { id: 4, code: "guest", name: "访客角色", description: "custom", menus: [], apis: ["/api/guest"], sort: 3 } };
                    }
                    if (options?.table === "addon_admin_admin") {
                        return { data: { id: 10 } };
                    }
                    return { data: {} };
                },
                insData: async (options) => {
                    calls.insData.push(options);
                    return { data: 100 };
                },
                updData: async (options) => {
                    calls.updData.push(options);
                    return { data: 1 };
                }
            },
            cache: {
                rebuildRoleApiPermissions: async () => {}
            }
        };

        await syncDev(ctx as any, { devEmail: "dev@qq.com", devPassword: "dev-password" });

        // 角色存在则强制更新（同步默认值）
        const roleUpdates = calls.updData.filter((c) => c?.table === "addon_admin_role");
        expect(roleUpdates.some((c) => c?.where?.code === "dev")).toBe(true);
        expect(roleUpdates.some((c) => c?.where?.code === "admin")).toBe(true);
        expect(roleUpdates.some((c) => c?.where?.code === "user")).toBe(true);
        expect(roleUpdates.some((c) => c?.where?.code === "guest")).toBe(true);

        // 重启同步系统角色时：仅更新元信息（name/description/sort），不应清空 DB 中已有的 menus/apis
        const adminUpd = roleUpdates.find((c) => c?.where?.code === "admin");
        expect(adminUpd?.data?.menus).toBeUndefined();
        expect(adminUpd?.data?.apis).toBeUndefined();
        const userUpd = roleUpdates.find((c) => c?.where?.code === "user");
        expect(userUpd?.data?.menus).toBeUndefined();
        expect(userUpd?.data?.apis).toBeUndefined();
        const guestUpd = roleUpdates.find((c) => c?.where?.code === "guest");
        expect(guestUpd?.data?.menus).toBeUndefined();
        expect(guestUpd?.data?.apis).toBeUndefined();
    });
});
