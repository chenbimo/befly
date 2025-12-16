/**
 * CacheKeys 测试（RedisKeys）
 */

import { describe, expect, test } from "bun:test";

import { RedisKeys } from "../lib/cacheKeys.js";

describe("RedisKeys - Key 生成函数", () => {
  test("apisAll - 返回固定的接口缓存键", () => {
    expect(RedisKeys.apisAll()).toBe("befly:apis:all");
  });

  test("menusAll - 返回固定的菜单缓存键", () => {
    expect(RedisKeys.menusAll()).toBe("befly:menus:all");
  });

  test("roleInfo - 返回带角色代码的缓存键", () => {
    expect(RedisKeys.roleInfo("admin")).toBe("befly:role:info:admin");
    expect(RedisKeys.roleInfo("user")).toBe("befly:role:info:user");
  });

  test("roleApis - 返回带角色代码的权限缓存键", () => {
    expect(RedisKeys.roleApis("admin")).toBe("befly:role:apis:admin");
    expect(RedisKeys.roleApis("guest")).toBe("befly:role:apis:guest");
  });

  test("tableColumns - 返回带表名的结构缓存键", () => {
    expect(RedisKeys.tableColumns("user")).toBe("befly:table:columns:user");
    expect(RedisKeys.tableColumns("addon_admin_role")).toBe("befly:table:columns:addon_admin_role");
  });

  test("roleInfo - 特殊字符处理", () => {
    expect(RedisKeys.roleInfo("super-admin")).toBe("befly:role:info:super-admin");
    expect(RedisKeys.roleInfo("role_1")).toBe("befly:role:info:role_1");
  });

  test("tableColumns - 空字符串", () => {
    expect(RedisKeys.tableColumns("")).toBe("befly:table:columns:");
  });
});
