/**
 * CacheKeys 测试
 */

import { describe, expect, test } from "bun:test";

import { CacheKeys } from "../lib/cacheKeys.js";

describe("CacheKeys - Key 生成函数", () => {
    test("apisAll - 返回固定的接口缓存键", () => {
        expect(CacheKeys.apisAll()).toBe("apis:all");
    });

    test("menusAll - 返回固定的菜单缓存键", () => {
        expect(CacheKeys.menusAll()).toBe("menus:all");
    });

    test("roleInfo - 返回带角色代码的缓存键", () => {
        expect(CacheKeys.roleInfo("admin")).toBe("role:info:admin");
        expect(CacheKeys.roleInfo("user")).toBe("role:info:user");
    });

    test("roleApis - 返回带角色代码的权限缓存键", () => {
        expect(CacheKeys.roleApis("admin")).toBe("role:apis:admin");
        expect(CacheKeys.roleApis("guest")).toBe("role:apis:guest");
    });

    test("tableColumns - 返回带表名的结构缓存键", () => {
        expect(CacheKeys.tableColumns("user")).toBe("table:columns:user");
        expect(CacheKeys.tableColumns("addon_admin_role")).toBe("table:columns:addon_admin_role");
    });

    test("roleInfo - 特殊字符处理", () => {
        expect(CacheKeys.roleInfo("super-admin")).toBe("role:info:super-admin");
        expect(CacheKeys.roleInfo("role_1")).toBe("role:info:role_1");
    });

    test("tableColumns - 空字符串", () => {
        expect(CacheKeys.tableColumns("")).toBe("table:columns:");
    });
});
