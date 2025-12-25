/**
 * CacheHelper 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

import { CacheHelper } from "../lib/cacheHelper.js";
import { CacheKeys } from "../lib/cacheKeys.js";
import { setMockLogger } from "../lib/logger.js";

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

describe("CacheHelper", () => {
    let cacheHelper: CacheHelper;
    let mockDb: any;
    let mockRedis: any;

    beforeEach(() => {
        // 设置 mock logger
        setMockLogger(mockPino as any);

        // Mock 数据库方法
        mockDb = {
            tableExists: mock(() => Promise.resolve(true)),
            getAll: mock(() => Promise.resolve({ lists: [], total: 0 }))
        };

        // Mock Redis 方法
        mockRedis = {
            setObject: mock(() => Promise.resolve("OK")),
            getObject: mock(() => Promise.resolve(null)),
            sadd: mock(() => Promise.resolve(1)),
            saddBatch: mock(() => Promise.resolve(1)),
            smembers: mock(() => Promise.resolve([])),
            sismember: mock(() => Promise.resolve(0)),
            del: mock(() => Promise.resolve(1)),
            delBatch: mock(() => Promise.resolve(1)),
            exists: mock(() => Promise.resolve(true))
        };

        cacheHelper = new CacheHelper({ db: mockDb, redis: mockRedis });
    });

    afterEach(() => {
        // 重置 mock logger
        setMockLogger(null);
    });

    describe("cacheApis", () => {
        it("表不存在时跳过缓存", async () => {
            mockDb.tableExists = mock(() => Promise.resolve(false));

            await cacheHelper.cacheApis();

            expect(mockDb.tableExists).toHaveBeenCalledWith("addon_admin_api");
            expect(mockDb.getAll).not.toHaveBeenCalled();
        });

        it("正常缓存接口列表", async () => {
            const apis = [
                { id: 1, name: "登录", path: "POST/api/login" },
                { id: 2, name: "用户列表", path: "GET/api/user/list" }
            ];
            mockDb.getAll = mock(() => Promise.resolve({ lists: apis, total: apis.length }));

            await cacheHelper.cacheApis();

            expect(mockRedis.setObject).toHaveBeenCalledWith(CacheKeys.apisAll(), apis);
        });

        it("缓存失败时记录警告", async () => {
            mockRedis.setObject = mock(() => Promise.resolve(null));

            await cacheHelper.cacheApis();

            expect(mockPino.warn).toHaveBeenCalled();
        });

        it("异常时记录错误", async () => {
            mockDb.getAll = mock(() => Promise.reject(new Error("DB Error")));

            await cacheHelper.cacheApis();

            expect(mockPino.error).toHaveBeenCalled();
        });
    });

    describe("cacheMenus", () => {
        it("表不存在时跳过缓存", async () => {
            mockDb.tableExists = mock(() => Promise.resolve(false));

            await cacheHelper.cacheMenus();

            expect(mockDb.tableExists).toHaveBeenCalledWith("addon_admin_menu");
            expect(mockDb.getAll).not.toHaveBeenCalled();
        });

        it("正常缓存菜单列表", async () => {
            const menus = [
                { id: 1, pid: 0, name: "首页", path: "/home", sort: 1 },
                { id: 2, pid: 0, name: "用户管理", path: "/user", sort: 2 }
            ];
            mockDb.getAll = mock(() => Promise.resolve({ lists: menus, total: menus.length }));

            await cacheHelper.cacheMenus();

            expect(mockRedis.setObject).toHaveBeenCalledWith(CacheKeys.menusAll(), menus);
        });
    });

    describe("rebuildRoleApiPermissions", () => {
        it("表不存在时跳过缓存", async () => {
            mockDb.tableExists = mock((table: string) => {
                if (table === "addon_admin_api") return Promise.resolve(true);
                if (table === "addon_admin_role") return Promise.resolve(false);
                return Promise.resolve(false);
            });

            await cacheHelper.rebuildRoleApiPermissions();

            expect(mockPino.warn).toHaveBeenCalled();
        });

        it("正常重建角色权限（覆盖更新）", async () => {
            const roles = [
                { id: 1, code: "admin", apis: [1, "2", 3] },
                { id: 2, code: "user", apis: [1] }
            ];
            const apis = [
                { id: 1, routePath: "POST/api/login" },
                { id: 2, routePath: "GET/api/user/list" },
                { id: 3, routePath: "POST/api/user/del" }
            ];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === "addon_admin_role") return Promise.resolve({ lists: roles, total: roles.length });
                if (opts.table === "addon_admin_api") {
                    // rebuildRoleApiPermissions 会通过 where: { id$in: [...] } 分块查询
                    return Promise.resolve({ lists: apis, total: apis.length });
                }
                return Promise.resolve({ lists: [], total: 0 });
            });

            await cacheHelper.rebuildRoleApiPermissions();

            // 验证批量删除角色 key
            expect(mockRedis.delBatch).toHaveBeenCalledTimes(1);
            const delBatchArgs = (mockRedis.delBatch as any).mock.calls[0][0] as string[];
            expect(delBatchArgs).toEqual([CacheKeys.roleApis("admin"), CacheKeys.roleApis("user")]);

            // 验证批量写入
            expect(mockRedis.saddBatch).toHaveBeenCalledTimes(1);
            const saddBatchArgs = (mockRedis.saddBatch as any).mock.calls[0][0] as Array<{
                key: string;
                members: string[];
            }>;
            expect(saddBatchArgs).toEqual([
                {
                    key: CacheKeys.roleApis("admin"),
                    members: ["GET/api/user/list", "POST/api/login", "POST/api/user/del"]
                },
                { key: CacheKeys.roleApis("user"), members: ["POST/api/login"] }
            ]);
        });

        it("无权限时仍会清理旧缓存，但不写入成员", async () => {
            const roles = [{ id: 1, code: "empty", apis: [] }];
            const apis = [{ id: 1, routePath: "POST/api/login" }];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === "addon_admin_role") return Promise.resolve({ lists: roles, total: roles.length });
                if (opts.table === "addon_admin_api") return Promise.resolve({ lists: apis, total: apis.length });
                return Promise.resolve({ lists: [], total: 0 });
            });

            await cacheHelper.rebuildRoleApiPermissions();

            expect(mockRedis.delBatch).toHaveBeenCalledTimes(1);
            expect(mockRedis.saddBatch).not.toHaveBeenCalled();
        });
    });

    describe("refreshRoleApiPermissions", () => {
        it("apiIds 为空数组时只清理缓存，不查询 API 表", async () => {
            mockDb.getAll = mock(() => Promise.resolve({ lists: [], total: 0 }));

            await cacheHelper.refreshRoleApiPermissions("admin", []);

            expect(mockRedis.del).toHaveBeenCalledWith(CacheKeys.roleApis("admin"));
            expect(mockDb.getAll).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    table: "addon_admin_api"
                })
            );
        });

        it("apiIds 非空时使用 $in 查询并重建该角色缓存（覆盖更新）", async () => {
            const apis = [
                { id: 1, routePath: "POST/api/login" },
                { id: 2, routePath: "GET/api/user/list" }
            ];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === "addon_admin_api") return Promise.resolve({ lists: apis, total: apis.length });
                return Promise.resolve({ lists: [], total: 0 });
            });

            await cacheHelper.refreshRoleApiPermissions("admin", [1, 2]);

            expect(mockRedis.del).toHaveBeenCalledWith(CacheKeys.roleApis("admin"));
            expect(mockRedis.sadd).toHaveBeenCalledWith(CacheKeys.roleApis("admin"), ["POST/api/login", "GET/api/user/list"]);
        });
    });

    describe("getApis", () => {
        it("返回缓存的接口列表", async () => {
            const apis = [{ id: 1, name: "登录" }];
            mockRedis.getObject = mock(() => Promise.resolve(apis));

            const result = await cacheHelper.getApis();

            expect(result).toEqual(apis);
        });

        it("缓存不存在时返回空数组", async () => {
            mockRedis.getObject = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getApis();

            expect(result).toEqual([]);
        });
    });

    describe("getMenus", () => {
        it("返回缓存的菜单列表", async () => {
            const menus = [{ id: 1, name: "首页" }];
            mockRedis.getObject = mock(() => Promise.resolve(menus));

            const result = await cacheHelper.getMenus();

            expect(result).toEqual(menus);
        });

        it("缓存不存在时返回空数组", async () => {
            mockRedis.getObject = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getMenus();

            expect(result).toEqual([]);
        });
    });

    describe("getRolePermissions", () => {
        it("返回角色的权限列表", async () => {
            const permissions = ["POST/api/login", "GET/api/user/list"];
            mockRedis.smembers = mock(() => Promise.resolve(permissions));

            const result = await cacheHelper.getRolePermissions("admin");

            expect(mockRedis.smembers).toHaveBeenCalledWith(CacheKeys.roleApis("admin"));
            expect(result).toEqual(permissions);
        });

        it("权限不存在时返回空数组", async () => {
            mockRedis.smembers = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getRolePermissions("unknown");

            expect(result).toEqual([]);
        });
    });

    describe("checkRolePermission", () => {
        it("有权限时返回 true", async () => {
            mockRedis.sismember = mock(() => Promise.resolve(true));

            const result = await cacheHelper.checkRolePermission("admin", "POST/api/login");

            expect(mockRedis.sismember).toHaveBeenCalledWith(CacheKeys.roleApis("admin"), "POST/api/login");
            expect(result).toBe(true);
        });

        it("无权限时返回 false", async () => {
            mockRedis.sismember = mock(() => Promise.resolve(false));

            const result = await cacheHelper.checkRolePermission("user", "POST/api/admin/del");

            expect(result).toBe(false);
        });
    });

    describe("deleteRolePermissions", () => {
        it("删除成功返回 true", async () => {
            mockRedis.del = mock(() => Promise.resolve(1));

            const result = await cacheHelper.deleteRolePermissions("admin");

            expect(mockRedis.del).toHaveBeenCalledWith(CacheKeys.roleApis("admin"));
            expect(result).toBe(true);
        });

        it("不存在时返回 false", async () => {
            mockRedis.del = mock(() => Promise.resolve(0));

            const result = await cacheHelper.deleteRolePermissions("unknown");

            expect(result).toBe(false);
        });
    });

    describe("cacheAll", () => {
        it("按顺序调用三个缓存方法", async () => {
            const callOrder: string[] = [];

            // 使用 spy 记录调用顺序
            const originalCacheApis = cacheHelper.cacheApis.bind(cacheHelper);
            const originalCacheMenus = cacheHelper.cacheMenus.bind(cacheHelper);
            const originalRebuildRoleApiPermissions = cacheHelper.rebuildRoleApiPermissions.bind(cacheHelper);

            cacheHelper.cacheApis = async () => {
                callOrder.push("apis");
                await originalCacheApis();
            };
            cacheHelper.cacheMenus = async () => {
                callOrder.push("menus");
                await originalCacheMenus();
            };
            cacheHelper.rebuildRoleApiPermissions = async () => {
                callOrder.push("permissions");
                await originalRebuildRoleApiPermissions();
            };

            await cacheHelper.cacheAll();

            expect(callOrder).toEqual(["apis", "menus", "permissions"]);
        });
    });
});
