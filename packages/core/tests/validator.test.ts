/**
 * Validator 验证器测试
 * 测试静态类方法、返回结构、各种验证场景
 */

import { describe, test, expect } from "bun:test";

import { Validator } from "../lib/validator";

// ========== 返回结构测试 ==========

describe("Validator.validate - 返回结构", () => {
  test("验证通过时返回正确结构", () => {
    const data = { name: "test" };
    const rules = { name: { name: "名称", type: "string", min: 2, max: 10 } };

    const result = Validator.validate(data, rules);

    expect(result.code).toBe(0);
    expect(result.failed).toBe(false);
    expect(result.firstError).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.errorFields).toEqual([]);
    expect(result.fieldErrors).toEqual({});
  });

  test("验证失败时返回正确结构", () => {
    const data = { name: "a" };
    const rules = { name: { name: "名称", type: "string", min: 2, max: 10 } };

    const result = Validator.validate(data, rules);

    expect(result.code).toBe(1);
    expect(result.failed).toBe(true);
    expect(result.firstError).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errorFields).toContain("name");
    expect(result.fieldErrors.name).toBeDefined();
  });

  test("多字段错误时返回所有错误", () => {
    const data = { name: "a", age: 200 };
    const rules = {
      name: { name: "名称", type: "string", min: 2, max: 10 },
      age: { name: "年龄", type: "number", min: 0, max: 150 },
    };

    const result = Validator.validate(data, rules);

    expect(result.code).toBe(1);
    expect(result.errors.length).toBe(2);
    expect(result.errorFields.length).toBe(2);
    expect(result.errorFields).toContain("name");
    expect(result.errorFields).toContain("age");
  });
});

// ========== 参数检查测试 ==========

describe("Validator.validate - 参数检查", () => {
  test("data 为 null", () => {
    const result = Validator.validate(null as any, {});

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });

  test("data 为 undefined", () => {
    const result = Validator.validate(undefined as any, {});

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });

  test("data 为数组", () => {
    const result = Validator.validate([] as any, {});

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });

  test("data 为字符串", () => {
    const result = Validator.validate("string" as any, {});

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });

  test("rules 为 null", () => {
    const result = Validator.validate({}, null as any);

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });

  test("rules 为 undefined", () => {
    const result = Validator.validate({}, undefined as any);

    expect(result.code).toBe(1);
    expect(result.firstError).toContain("对象格式");
  });
});

// ========== 必填字段测试 ==========

describe("Validator.validate - 必填字段", () => {
  const rules = { name: { name: "名称", type: "string", min: 2, max: 20 } };

  test("字段存在且有值 - 通过", () => {
    const result = Validator.validate({ name: "test" }, rules, ["name"]);
    expect(result.code).toBe(0);
  });

  test("字段不存在 - 失败", () => {
    const result = Validator.validate({}, rules, ["name"]);
    expect(result.code).toBe(1);
    expect(result.fieldErrors.name).toContain("必填项");
  });

  test("字段值为空字符串 - 失败", () => {
    const result = Validator.validate({ name: "" }, rules, ["name"]);
    expect(result.code).toBe(1);
    expect(result.fieldErrors.name).toContain("必填项");
  });

  test("字段值为 null - 失败", () => {
    const result = Validator.validate({ name: null }, rules, ["name"]);
    expect(result.code).toBe(1);
    expect(result.fieldErrors.name).toContain("必填项");
  });

  test("字段值为 undefined - 失败", () => {
    const result = Validator.validate({ name: undefined }, rules, ["name"]);
    expect(result.code).toBe(1);
    expect(result.fieldErrors.name).toContain("必填项");
  });

  test("多个必填字段全部缺失", () => {
    const multiRules = {
      name: { name: "名称", type: "string", min: 2, max: 20 },
      email: { name: "邮箱", type: "string", regexp: "@email" },
    };

    const result = Validator.validate({}, multiRules, ["name", "email"]);

    expect(result.code).toBe(1);
    expect(result.errors.length).toBe(2);
    expect(result.fieldErrors.name).toContain("必填项");
    expect(result.fieldErrors.email).toContain("必填项");
  });

  test("必填字段使用字段标签", () => {
    const result = Validator.validate({}, rules, ["name"]);
    expect(result.firstError).toContain("名称");
  });

  test("必填字段无标签时使用字段名", () => {
    const noLabelRules = { name: { type: "string", min: 2, max: 20 } };
    const result = Validator.validate({}, noLabelRules, ["name"]);
    expect(result.firstError).toContain("name");
  });
});

// ========== string 类型测试 ==========

describe("Validator.validate - string 类型", () => {
  test("有效字符串 - 通过", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 10 } };
    const result = Validator.validate({ name: "test" }, rules);
    expect(result.code).toBe(0);
  });

  test("非字符串类型 - 失败", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 10 } };
    const result = Validator.validate({ name: 123 }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("字符串");
  });

  test("长度小于 min - 失败", () => {
    const rules = { name: { name: "名称", type: "string", min: 5, max: 20 } };
    const result = Validator.validate({ name: "abc" }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("5");
  });

  test("长度等于 min - 通过", () => {
    const rules = { name: { name: "名称", type: "string", min: 3, max: 20 } };
    const result = Validator.validate({ name: "abc" }, rules);
    expect(result.code).toBe(0);
  });

  test("长度大于 max - 失败", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 5 } };
    const result = Validator.validate({ name: "abcdefg" }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("5");
  });

  test("长度等于 max - 通过", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 5 } };
    const result = Validator.validate({ name: "abcde" }, rules);
    expect(result.code).toBe(0);
  });

  test("中文字符按字符数计算", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 5 } };
    const result = Validator.validate({ name: "你好世界" }, rules); // 4 个字符
    expect(result.code).toBe(0);
  });

  test("max 为 0 时不检查最大长度", () => {
    const rules = { name: { name: "名称", type: "string", min: 0, max: 0 } };
    const result = Validator.validate({ name: "a".repeat(1000) }, rules);
    expect(result.code).toBe(0);
  });
});

// ========== text 类型测试 ==========

describe("Validator.validate - text 类型", () => {
  test("text 类型与 string 类型行为一致", () => {
    const rules = { content: { name: "内容", type: "text", min: 2, max: 100 } };
    const result = Validator.validate({ content: "hello world" }, rules);
    expect(result.code).toBe(0);
  });

  test("text 类型非字符串 - 失败", () => {
    const rules = { content: { name: "内容", type: "text", min: 2, max: 100 } };
    const result = Validator.validate({ content: 123 }, rules);
    expect(result.code).toBe(1);
  });
});

// ========== number 类型测试 ==========

describe("Validator.validate - number 类型", () => {
  test("有效数字 - 通过", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 150 } };
    const result = Validator.validate({ age: 25 }, rules);
    expect(result.code).toBe(0);
  });

  test("字符串数字自动转换 - 通过", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 150 } };
    const result = Validator.validate({ age: "25" }, rules);
    expect(result.code).toBe(0);
  });

  test("非数字字符串 - 失败", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 150 } };
    const result = Validator.validate({ age: "abc" }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("数字");
  });

  test("NaN - 失败", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 150 } };
    const result = Validator.validate({ age: NaN }, rules);
    expect(result.code).toBe(1);
  });

  test("Infinity - 失败", () => {
    const rules = { value: { name: "值", type: "number", min: 0, max: 100 } };
    const result = Validator.validate({ value: Infinity }, rules);
    expect(result.code).toBe(1);
  });

  test("-Infinity - 失败", () => {
    const rules = { value: { name: "值", type: "number", min: 0, max: 100 } };
    const result = Validator.validate({ value: -Infinity }, rules);
    expect(result.code).toBe(1);
  });

  test("0 是有效值", () => {
    const rules = { count: { name: "计数", type: "number", min: 0, max: 100 } };
    const result = Validator.validate({ count: 0 }, rules);
    expect(result.code).toBe(0);
  });

  test("负数范围验证", () => {
    const rules = { temp: { name: "温度", type: "number", min: -50, max: 50 } };
    const result = Validator.validate({ temp: -30 }, rules);
    expect(result.code).toBe(0);
  });

  test("小于 min - 失败", () => {
    const rules = { age: { name: "年龄", type: "number", min: 18, max: 100 } };
    const result = Validator.validate({ age: 10 }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("18");
  });

  test("等于 min - 通过", () => {
    const rules = { age: { name: "年龄", type: "number", min: 18, max: 100 } };
    const result = Validator.validate({ age: 18 }, rules);
    expect(result.code).toBe(0);
  });

  test("大于 max - 失败", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 100 } };
    const result = Validator.validate({ age: 150 }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("100");
  });

  test("等于 max - 通过", () => {
    const rules = { age: { name: "年龄", type: "number", min: 0, max: 100 } };
    const result = Validator.validate({ age: 100 }, rules);
    expect(result.code).toBe(0);
  });

  test("浮点数", () => {
    const rules = { price: { name: "价格", type: "number", min: 0, max: 1000 } };
    const result = Validator.validate({ price: 99.99 }, rules);
    expect(result.code).toBe(0);
  });

  test("max 为 0 时不检查最大值", () => {
    const rules = { value: { name: "值", type: "number", min: 0, max: 0 } };
    const result = Validator.validate({ value: 999999 }, rules);
    expect(result.code).toBe(0);
  });
});

// ========== array_string 类型测试 ==========

describe("Validator.validate - array_string 类型", () => {
  test("有效数组 - 通过", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 1, max: 5 } };
    const result = Validator.validate({ tags: ["a", "b", "c"] }, rules);
    expect(result.code).toBe(0);
  });

  test("非数组类型 - 失败", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 1, max: 5 } };
    const result = Validator.validate({ tags: "not array" }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("数组");
  });

  test("元素数量小于 min - 失败", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 3, max: 10 } };
    const result = Validator.validate({ tags: ["a", "b"] }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("3");
  });

  test("元素数量等于 min - 通过", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 2, max: 10 } };
    const result = Validator.validate({ tags: ["a", "b"] }, rules);
    expect(result.code).toBe(0);
  });

  test("元素数量大于 max - 失败", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 1, max: 3 } };
    const result = Validator.validate({ tags: ["a", "b", "c", "d", "e"] }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("3");
  });

  test("元素数量等于 max - 通过", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 1, max: 3 } };
    const result = Validator.validate({ tags: ["a", "b", "c"] }, rules);
    expect(result.code).toBe(0);
  });

  test("空数组", () => {
    const rules = { tags: { name: "标签", type: "array_string", min: 0, max: 10 } };
    const result = Validator.validate({ tags: [] }, rules);
    expect(result.code).toBe(0);
  });

  test("数组元素正则验证 - 全部通过", () => {
    const rules = {
      emails: { name: "邮箱列表", type: "array_string", min: 1, max: 10, regexp: "@email" },
    };
    const result = Validator.validate({ emails: ["a@test.com", "b@test.com"] }, rules);
    expect(result.code).toBe(0);
  });

  test("数组元素正则验证 - 部分失败", () => {
    const rules = {
      emails: { name: "邮箱列表", type: "array_string", min: 1, max: 10, regexp: "@email" },
    };
    const result = Validator.validate({ emails: ["a@test.com", "invalid"] }, rules);
    expect(result.code).toBe(1);
    expect(result.firstError).toContain("格式");
  });
});

// ========== array_text 类型测试 ==========

describe("Validator.validate - array_text 类型", () => {
  test("array_text 与 array_string 行为一致", () => {
    const rules = { items: { name: "条目", type: "array_text", min: 1, max: 5 } };
    const result = Validator.validate({ items: ["item1", "item2"] }, rules);
    expect(result.code).toBe(0);
  });
});

// ========== 正则验证测试 ==========

describe("Validator.validate - 正则别名", () => {
  test("@email - 有效邮箱", () => {
    const validEmails = [
      "test@example.com",
      "user.name@domain.co.uk",
      "admin+tag@site.org",
      "test123@test.cn",
    ];

    validEmails.forEach((email) => {
      const rules = { email: { name: "邮箱", type: "string", regexp: "@email" } };
      const result = Validator.validate({ email: email }, rules);
      expect(result.code).toBe(0);
    });
  });

  test("@email - 无效邮箱", () => {
    const invalidEmails = ["plaintext", "@example.com", "user@", "user @domain.com"];

    invalidEmails.forEach((email) => {
      const rules = { email: { name: "邮箱", type: "string", regexp: "@email" } };
      const result = Validator.validate({ email: email }, rules);
      expect(result.code).toBe(1);
    });
  });

  test("@phone - 有效手机号", () => {
    const validPhones = ["13800138000", "15012345678", "18888888888", "19912345678"];

    validPhones.forEach((phone) => {
      const rules = { phone: { name: "手机号", type: "string", regexp: "@phone" } };
      const result = Validator.validate({ phone: phone }, rules);
      expect(result.code).toBe(0);
    });
  });

  test("@phone - 无效手机号", () => {
    const invalidPhones = [
      "12345678901", // 首位不是 1 开头的有效段
      "1380013800", // 10 位
      "138001380001", // 12 位
      "abc",
    ];

    invalidPhones.forEach((phone) => {
      const rules = { phone: { name: "手机号", type: "string", regexp: "@phone" } };
      const result = Validator.validate({ phone: phone }, rules);
      expect(result.code).toBe(1);
    });
  });
});

describe("Validator.validate - 自定义正则", () => {
  test("纯数字", () => {
    const rules = { code: { name: "验证码", type: "string", regexp: "^\\d+$" } };

    expect(Validator.validate({ code: "123456" }, rules).code).toBe(0);
    expect(Validator.validate({ code: "12a34" }, rules).code).toBe(1);
  });

  test("字母数字组合", () => {
    const rules = { username: { name: "用户名", type: "string", regexp: "^[a-zA-Z0-9]+$" } };

    expect(Validator.validate({ username: "user123" }, rules).code).toBe(0);
    expect(Validator.validate({ username: "user@123" }, rules).code).toBe(1);
  });

  test("无效正则不抛出异常", () => {
    const rules = { value: { name: "值", type: "string", regexp: "[invalid(" } };
    const result = Validator.validate({ value: "test" }, rules);
    // 无效正则应该导致验证失败，但不应抛出异常
    expect(result.code).toBe(1);
  });
});

// ========== 非必填字段测试 ==========

describe("Validator.validate - 非必填字段", () => {
  test("非必填字段不存在时不验证", () => {
    const rules = {
      name: { name: "名称", type: "string", min: 2, max: 20 },
      age: { name: "年龄", type: "number", min: 0, max: 150 },
    };

    // 只提供 name，不提供 age（age 不在 required 中）
    const result = Validator.validate({ name: "test" }, rules, ["name"]);

    expect(result.code).toBe(0);
  });

  test("非必填字段存在时会验证", () => {
    const rules = {
      name: { name: "名称", type: "string", min: 2, max: 20 },
      age: { name: "年龄", type: "number", min: 0, max: 150 },
    };

    // 提供了 age 但值无效
    const result = Validator.validate({ name: "test", age: 200 }, rules, ["name"]);

    expect(result.code).toBe(1);
    expect(result.fieldErrors.age).toBeDefined();
  });
});

// ========== Validator.single 测试 ==========

describe("Validator.single - 单值验证", () => {
  test("有效值返回转换后的值", () => {
    const fieldDef = { name: "年龄", type: "number", min: 0, max: 150 };
    const result = Validator.single(25, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(25);
  });

  test("字符串数字自动转换", () => {
    const fieldDef = { name: "年龄", type: "number", min: 0, max: 150 };
    const result = Validator.single("30", fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(30);
  });

  test("无效值返回错误", () => {
    const fieldDef = { name: "年龄", type: "number", min: 0, max: 150 };
    const result = Validator.single("abc", fieldDef);

    expect(result.error).toBeDefined();
    expect(result.value).toBeNull();
  });

  test("空值返回默认值 - number", () => {
    const fieldDef = { name: "计数", type: "number", default: null };
    const result = Validator.single(null, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(0); // number 类型默认值
  });

  test("空值返回默认值 - string", () => {
    const fieldDef = { name: "名称", type: "string", default: null };
    const result = Validator.single(undefined, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(""); // string 类型默认值
  });

  test("空值返回默认值 - array_string", () => {
    const fieldDef = { name: "标签", type: "array_string", default: null };
    const result = Validator.single("", fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toEqual([]); // array 类型默认值
  });

  test("使用自定义默认值", () => {
    const fieldDef = { name: "状态", type: "number", default: 1 };
    const result = Validator.single(null, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(1);
  });

  test("字符串数字默认值转换", () => {
    const fieldDef = { name: "计数", type: "number", default: "100" };
    const result = Validator.single(null, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toBe(100);
  });

  test("数组默认值解析", () => {
    const fieldDef = { name: "标签", type: "array_string", default: '["a","b"]' };
    const result = Validator.single(null, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toEqual(["a", "b"]);
  });

  test("空数组默认值", () => {
    const fieldDef = { name: "标签", type: "array_string", default: "[]" };
    const result = Validator.single(null, fieldDef);

    expect(result.error).toBeNull();
    expect(result.value).toEqual([]);
  });

  test("规则验证失败", () => {
    const fieldDef = { name: "年龄", type: "number", min: 18, max: 100 };
    const result = Validator.single(10, fieldDef);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("18");
  });

  test("正则验证失败", () => {
    const fieldDef = { name: "邮箱", type: "string", regexp: "@email" };
    const result = Validator.single("invalid", fieldDef);

    expect(result.error).toBeDefined();
    expect(result.error).toContain("格式");
  });
});

// ========== 错误消息测试 ==========

describe("Validator - 错误消息格式", () => {
  test("错误消息包含字段标签", () => {
    const rules = { age: { name: "年龄", type: "number", min: 18, max: 100 } };
    const result = Validator.validate({ age: 10 }, rules);

    expect(result.firstError).toContain("年龄");
  });

  test("必填错误消息格式", () => {
    const rules = { name: { name: "姓名", type: "string", min: 2, max: 20 } };
    const result = Validator.validate({}, rules, ["name"]);

    expect(result.firstError).toBe("姓名为必填项");
  });

  test("长度错误消息格式", () => {
    const rules = { name: { name: "姓名", type: "string", min: 5, max: 20 } };
    const result = Validator.validate({ name: "abc" }, rules);

    expect(result.firstError).toContain("姓名");
    expect(result.firstError).toContain("5");
  });

  test("数值范围错误消息格式", () => {
    const rules = { age: { name: "年龄", type: "number", min: 18, max: 100 } };
    const result = Validator.validate({ age: 10 }, rules);

    expect(result.firstError).toContain("年龄");
    expect(result.firstError).toContain("18");
  });
});

// ========== 边界条件测试 ==========

describe("Validator - 边界条件", () => {
  test("空 rules 对象", () => {
    const result = Validator.validate({ name: "test" }, {});
    expect(result.code).toBe(0);
  });

  test("空 required 数组", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 20 } };
    const result = Validator.validate({ name: "test" }, rules, []);
    expect(result.code).toBe(0);
  });

  test("required 中的字段不在 rules 中", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 20 } };
    const result = Validator.validate({}, rules, ["unknown"]);

    // 应该报错，显示 unknown 为必填项
    expect(result.code).toBe(1);
    expect(result.fieldErrors.unknown).toBeDefined();
  });

  test("data 中的字段不在 rules 中", () => {
    const rules = { name: { name: "名称", type: "string", min: 2, max: 20 } };
    const result = Validator.validate({ name: "test", extra: "ignored" }, rules);

    // extra 字段应该被忽略
    expect(result.code).toBe(0);
  });

  test("min/max 为 null 时不检查", () => {
    const rules = { value: { name: "值", type: "string", min: null, max: null } };
    const result = Validator.validate({ value: "any length string here" }, rules);
    expect(result.code).toBe(0);
  });

  test("regexp 为 null 时不检查正则", () => {
    const rules = { value: { name: "值", type: "string", min: 0, max: 100, regexp: null } };
    const result = Validator.validate({ value: "anything" }, rules);
    expect(result.code).toBe(0);
  });
});
