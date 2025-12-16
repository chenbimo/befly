/**
 * syncDb 类型处理模块测试
 *
 * 测试 types.ts 中的函数：
 * - isStringOrArrayType
 * - getSqlType
 * - resolveDefaultValue
 * - generateDefaultSql
 */

import { describe, test, expect, beforeAll } from "bun:test";

import { setDbType } from "../sync/syncDb/constants.js";

// 设置数据库类型为 MySQL
setDbType("mysql");

// 动态导入以确保环境变量生效
let isStringOrArrayType: any;
let getSqlType: any;
let resolveDefaultValue: any;
let generateDefaultSql: any;

beforeAll(async () => {
  const types = await import("../sync/syncDb/types.js");
  isStringOrArrayType = types.isStringOrArrayType;
  getSqlType = types.getSqlType;
  resolveDefaultValue = types.resolveDefaultValue;
  generateDefaultSql = types.generateDefaultSql;
});

describe("isStringOrArrayType", () => {
  test("string 类型返回 true", () => {
    expect(isStringOrArrayType("string")).toBe(true);
  });

  test("array_string 类型返回 true", () => {
    expect(isStringOrArrayType("array_string")).toBe(true);
  });

  test("number 类型返回 false", () => {
    expect(isStringOrArrayType("number")).toBe(false);
  });

  test("text 类型返回 false", () => {
    expect(isStringOrArrayType("text")).toBe(false);
  });

  test("array_text 类型返回 false", () => {
    expect(isStringOrArrayType("array_text")).toBe(false);
  });
});

describe("resolveDefaultValue", () => {
  test("null 值 + string 类型 => 空字符串", () => {
    expect(resolveDefaultValue(null, "string")).toBe("");
  });

  test("null 值 + number 类型 => 0", () => {
    expect(resolveDefaultValue(null, "number")).toBe(0);
  });

  test('"null" 字符串 + number 类型 => 0', () => {
    expect(resolveDefaultValue("null", "number")).toBe(0);
  });

  test('null 值 + array_string 类型 => "[]"', () => {
    expect(resolveDefaultValue(null, "array_string")).toBe("[]");
  });

  test('null 值 + text 类型 => "null"', () => {
    expect(resolveDefaultValue(null, "text")).toBe("null");
  });

  test('null 值 + array_text 类型 => "null"（TEXT 不支持默认值）', () => {
    expect(resolveDefaultValue(null, "array_text")).toBe("null");
  });

  test("有实际值时直接返回", () => {
    expect(resolveDefaultValue("admin", "string")).toBe("admin");
    expect(resolveDefaultValue(100, "number")).toBe(100);
    expect(resolveDefaultValue(0, "number")).toBe(0);
  });
});

describe("generateDefaultSql", () => {
  test("number 类型生成数字默认值", () => {
    expect(generateDefaultSql(0, "number")).toBe(" DEFAULT 0");
    expect(generateDefaultSql(100, "number")).toBe(" DEFAULT 100");
  });

  test("string 类型生成带引号默认值", () => {
    expect(generateDefaultSql("admin", "string")).toBe(" DEFAULT 'admin'");
    expect(generateDefaultSql("", "string")).toBe(" DEFAULT ''");
  });

  test("text 类型不生成默认值", () => {
    expect(generateDefaultSql("null", "text")).toBe("");
  });

  test("array_string 类型生成 JSON 数组默认值", () => {
    expect(generateDefaultSql("[]", "array_string")).toBe(" DEFAULT '[]'");
  });

  test("array_text 类型不生成默认值（MySQL TEXT 不支持）", () => {
    expect(generateDefaultSql("[]", "array_text")).toBe("");
  });

  test("单引号被正确转义", () => {
    expect(generateDefaultSql("it's", "string")).toBe(" DEFAULT 'it''s'");
  });
});

describe("getSqlType", () => {
  test("string 类型带长度", () => {
    const result = getSqlType("string", 100);
    expect(result).toBe("VARCHAR(100)");
  });

  test("array_string 类型带长度", () => {
    const result = getSqlType("array_string", 500);
    expect(result).toBe("VARCHAR(500)");
  });

  test("number 类型无符号", () => {
    const result = getSqlType("number", null, true);
    expect(result).toBe("BIGINT UNSIGNED");
  });

  test("number 类型有符号", () => {
    const result = getSqlType("number", null, false);
    expect(result).toBe("BIGINT");
  });

  test("text 类型", () => {
    const result = getSqlType("text", null);
    expect(result).toBe("MEDIUMTEXT");
  });
});
