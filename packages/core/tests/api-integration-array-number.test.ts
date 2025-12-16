/**
 * API 集成测试 - 验证 array_number_string 类型在完整数据流中的表现
 *
 * 测试流程：请求验证 → 数据库存储 → 查询返回
 */

import type { TableDefinition } from "befly/types";

import { describe, expect, test } from "bun:test";

import { Validator } from "../lib/validator.js";

describe("API 集成测试 - array_number_string 数据流", () => {
  // 模拟角色表定义
  const roleTable: TableDefinition = {
    name: {
      name: "角色名称",
      type: "string",
      min: 2,
      max: 50,
      default: null,
      regexp: null,
    },
    code: {
      name: "角色编码",
      type: "string",
      min: 2,
      max: 50,
      default: null,
      regexp: null,
    },
    menus: {
      name: "菜单权限",
      type: "array_number_string",
      min: null,
      max: 2000,
      default: null,
      regexp: null,
    },
    apis: {
      name: "接口权限",
      type: "array_number_string",
      min: null,
      max: 3000,
      default: null,
      regexp: null,
    },
  };

  // ==================== 请求验证阶段 ====================

  test("请求验证: 接受合法的数字数组", () => {
    const requestData = {
      name: "测试角色",
      code: "test_role",
      menus: [1, 2, 3, 4, 5],
      apis: [10, 20, 30],
    };

    const result = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(result.failed).toBe(false);
  });

  test("请求验证: 拒绝字符串数组", () => {
    const requestData = {
      name: "测试角色",
      code: "test_role",
      menus: ["1", "2", "3"], // 错误：字符串数组
      apis: [10, 20, 30],
    };

    const result = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(result.failed).toBe(true);
    expect(result.firstError).toContain("数组元素必须是数字");
  });

  test("请求验证: 拒绝混合类型数组", () => {
    const requestData = {
      name: "测试角色",
      code: "test_role",
      menus: [1, 2, 3],
      apis: [10, "20", 30], // 错误：混合类型
    };

    const result = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(result.failed).toBe(true);
    expect(result.firstError).toContain("数组元素必须是数字");
  });

  test("请求验证: 空数组应通过验证", () => {
    const requestData = {
      name: "测试角色",
      code: "test_role",
      menus: [],
      apis: [],
    };

    const result = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(result.failed).toBe(false);
  });

  test("请求验证: 未传递数组字段时使用默认值", () => {
    const requestData = {
      name: "测试角色",
      code: "test_role",
      // menus 和 apis 未传递
    };

    const result = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(result.failed).toBe(false);
  });

  test("请求验证: max 元素数量限制生效", () => {
    // 注意：max 参数对 array_number_string 是限制数组长度，不是字符串长度
    const roleTableWithMax: TableDefinition = {
      ...roleTable,
      menus: {
        name: "菜单权限",
        type: "array_number_string",
        min: null,
        max: 10, // 最多 10 个元素
        default: null,
        regexp: null,
      },
    };

    const requestData = {
      name: "测试角色",
      code: "test_role",
      menus: Array.from({ length: 15 }, (_, i) => i), // 15 个元素，超过限制
      apis: [10, 20, 30],
    };

    const result = Validator.validate(requestData, roleTableWithMax, ["name", "code"]);
    expect(result.failed).toBe(true);
    expect(result.firstError).toContain("最多只能有10个元素");
  });

  // ==================== 数据库存储模拟 ====================

  test("数据库存储: 数字数组应被正确序列化", () => {
    const menuIds = [1, 2, 3, 4, 5];
    const apiIds = [10, 20, 30, 40];

    // 模拟数据库存储时的序列化（实际由 dbHelper 处理）
    const serializedMenus = JSON.stringify(menuIds);
    const serializedApis = JSON.stringify(apiIds);

    expect(serializedMenus).toBe("[1,2,3,4,5]");
    expect(serializedApis).toBe("[10,20,30,40]");
  });

  test('数据库存储: 空数组应被序列化为 "[]"', () => {
    const menuIds: number[] = [];

    const serialized = JSON.stringify(menuIds);
    expect(serialized).toBe("[]");
  });

  // ==================== 查询返回模拟 ====================

  test("查询返回: 数据库字符串应被正确解析为数组", () => {
    // 模拟从数据库查询返回的数据（实际由 dbHelper 处理）
    const dbRow = {
      id: 1,
      name: "测试角色",
      code: "test_role",
      menus: "[1,2,3,4,5]",
      apis: "[10,20,30,40]",
    };

    // 解析
    const parsedMenus = JSON.parse(dbRow.menus);
    const parsedApis = JSON.parse(dbRow.apis);

    expect(Array.isArray(parsedMenus)).toBe(true);
    expect(Array.isArray(parsedApis)).toBe(true);
    expect(parsedMenus).toEqual([1, 2, 3, 4, 5]);
    expect(parsedApis).toEqual([10, 20, 30, 40]);
  });

  test('查询返回: 空数组字符串 "[]" 应解析为空数组', () => {
    const dbRow = {
      id: 1,
      name: "测试角色",
      code: "test_role",
      menus: "[]",
      apis: "[]",
    };

    const parsedMenus = JSON.parse(dbRow.menus);
    const parsedApis = JSON.parse(dbRow.apis);

    expect(parsedMenus).toEqual([]);
    expect(parsedApis).toEqual([]);
  });

  // ==================== 完整数据流测试 ====================

  test("完整流程: 请求 → 验证 → 存储 → 查询 → 返回", () => {
    // 1. 模拟 API 请求
    const requestData = {
      name: "管理员角色",
      code: "admin",
      menus: [1, 2, 3, 10, 11, 12],
      apis: [100, 101, 102, 200, 201],
    };

    // 2. 验证请求数据
    const validationResult = Validator.validate(requestData, roleTable, ["name", "code"]);
    expect(validationResult.failed).toBe(false);

    // 3. 模拟数据库存储（序列化）
    const dbData = {
      name: requestData.name,
      code: requestData.code,
      menus: JSON.stringify(requestData.menus),
      apis: JSON.stringify(requestData.apis),
    };

    expect(dbData.menus).toBe("[1,2,3,10,11,12]");
    expect(dbData.apis).toBe("[100,101,102,200,201]");

    // 4. 模拟查询返回（反序列化）
    const responseData = {
      id: 1,
      name: dbData.name,
      code: dbData.code,
      menus: JSON.parse(dbData.menus),
      apis: JSON.parse(dbData.apis),
    };

    // 5. 验证返回数据
    expect(responseData.menus).toEqual(requestData.menus);
    expect(responseData.apis).toEqual(requestData.apis);
  });

  test("完整流程: 更新权限（部分字段）", () => {
    // 模拟更新操作，只更新 menus
    const existingData = {
      id: 1,
      name: "管理员角色",
      code: "admin",
      menus: "[1,2,3]",
      apis: "[100,101,102]",
    };

    const updateRequest = {
      id: 1,
      menus: [1, 2, 3, 4, 5, 6], // 新增菜单
    };

    // 验证更新数据
    const fields: TableDefinition = {
      menus: roleTable.menus,
    };
    const validationResult = Validator.validate(updateRequest, fields, []);
    expect(validationResult.failed).toBe(false);

    // 更新后的数据
    const updatedData = {
      ...existingData,
      menus: JSON.stringify(updateRequest.menus),
    };

    expect(updatedData.menus).toBe("[1,2,3,4,5,6]");
    expect(updatedData.apis).toBe("[100,101,102]"); // 未变
  });

  test("错误场景: 尝试存储非法数据", () => {
    const invalidRequest = {
      name: "测试角色",
      code: "test",
      menus: "invalid", // 错误：不是数组
      apis: [10, 20],
    };

    const result = Validator.validate(invalidRequest, roleTable, ["name", "code"]);
    expect(result.failed).toBe(true);
    expect(result.errorFields).toContain("menus");
  });
});
