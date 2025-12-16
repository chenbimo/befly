/**
 * RedisKeys 和 RedisTTL 测试
 */

import { describe, expect, test } from "bun:test";

import { RedisKeys, RedisTTL } from "../lib/redisKeys.js";

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

describe("RedisTTL - 过期时间常量", () => {
  test("tableColumns - 1小时 (3600秒)", () => {
    expect(RedisTTL.tableColumns).toBe(3600);
  });

  test("roleApis - 24小时 (86400秒)", () => {
    expect(RedisTTL.roleApis).toBe(86400);
  });

  test("roleInfo - 24小时 (86400秒)", () => {
    expect(RedisTTL.roleInfo).toBe(86400);
  });

  test("apisAll - 永久 (null)", () => {
    expect(RedisTTL.apisAll).toBeNull();
  });

  test("menusAll - 永久 (null)", () => {
    expect(RedisTTL.menusAll).toBeNull();
  });

  test("所有 TTL 值都是数字或 null", () => {
    for (const [_key, value] of Object.entries(RedisTTL)) {
      expect(value === null || typeof value === "number").toBe(true);
    }
  });

  test("数字类型的 TTL 都是正数", () => {
    for (const [_key, value] of Object.entries(RedisTTL)) {
      if (typeof value === "number") {
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
