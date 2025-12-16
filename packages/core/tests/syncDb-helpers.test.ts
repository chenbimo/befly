/**
 * syncDb 辅助工具模块测试
 *
 * 测试 helpers.ts 中的函数：
 * - quoteIdentifier
 * - escapeComment
 * - applyFieldDefaults
 */

import { describe, test, expect, beforeAll } from "bun:test";

import { setDbType } from "../sync/syncDb/constants.js";

// 设置数据库类型为 MySQL
setDbType("mysql");

let quoteIdentifier: any;
let escapeComment: any;
let applyFieldDefaults: any;

beforeAll(async () => {
  const helpers = await import("../sync/syncDb/helpers.js");
  quoteIdentifier = helpers.quoteIdentifier;
  escapeComment = helpers.escapeComment;
  applyFieldDefaults = helpers.applyFieldDefaults;
});

describe("quoteIdentifier (MySQL)", () => {
  test("使用反引号包裹标识符", () => {
    expect(quoteIdentifier("user_table")).toBe("`user_table`");
  });

  test("处理普通表名", () => {
    expect(quoteIdentifier("admin")).toBe("`admin`");
  });

  test("处理带下划线的表名", () => {
    expect(quoteIdentifier("addon_admin_menu")).toBe("`addon_admin_menu`");
  });
});

describe("escapeComment", () => {
  test("普通注释不变", () => {
    expect(escapeComment("用户名称")).toBe("用户名称");
  });

  test("双引号被转义", () => {
    expect(escapeComment('用户"昵称"')).toBe('用户\\"昵称\\"');
  });

  test("空字符串", () => {
    expect(escapeComment("")).toBe("");
  });
});

describe("applyFieldDefaults", () => {
  test("为空字段定义应用默认值", () => {
    const fieldDef: any = {
      name: "用户名",
      type: "string",
    };

    applyFieldDefaults(fieldDef);

    expect(fieldDef.detail).toBe("");
    expect(fieldDef.min).toBe(0);
    expect(fieldDef.max).toBe(100);
    expect(fieldDef.default).toBe(null);
    expect(fieldDef.index).toBe(false);
    expect(fieldDef.unique).toBe(false);
    expect(fieldDef.nullable).toBe(false);
    expect(fieldDef.unsigned).toBe(true);
    expect(fieldDef.regexp).toBe(null);
  });

  test("保留已有值", () => {
    const fieldDef: any = {
      name: "用户名",
      type: "string",
      max: 200,
      index: true,
      unique: true,
      nullable: true,
    };

    applyFieldDefaults(fieldDef);

    expect(fieldDef.max).toBe(200);
    expect(fieldDef.index).toBe(true);
    expect(fieldDef.unique).toBe(true);
    expect(fieldDef.nullable).toBe(true);
  });

  test("处理 0 和 false 值", () => {
    const fieldDef: any = {
      name: "排序",
      type: "number",
      min: 0,
      max: 0,
      default: 0,
      index: false,
      unsigned: false,
    };

    applyFieldDefaults(fieldDef);

    expect(fieldDef.min).toBe(0);
    expect(fieldDef.max).toBe(0);
    expect(fieldDef.default).toBe(0);
    expect(fieldDef.index).toBe(false);
    expect(fieldDef.unsigned).toBe(false);
  });
});
