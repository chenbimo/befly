/**
 * 测试数组类型的自动序列化和反序列化
 */

import { describe, expect, test } from "bun:test";

describe("数组类型序列化/反序列化", () => {
    // 模拟 serializeArrayFields 方法
    const serializeArrayFields = (data: Record<string, any>): Record<string, any> => {
        const serialized = { ...data };

        for (const [key, value] of Object.entries(serialized)) {
            if (value === null || value === undefined) continue;

            if (Array.isArray(value)) {
                serialized[key] = JSON.stringify(value);
            }
        }

        return serialized;
    };

    // 模拟 deserializeArrayFields 方法
    const deserializeArrayFields = <T = any>(data: Record<string, any> | null): T | null => {
        if (!data) return null;

        const deserialized = { ...data };

        for (const [key, value] of Object.entries(deserialized)) {
            if (typeof value !== "string") continue;

            if (value.startsWith("[") && value.endsWith("]")) {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        deserialized[key] = parsed;
                    }
                } catch {
                    // 解析失败则保持原值
                }
            }
        }

        return deserialized as T;
    };

    // ==================== 序列化测试 ====================

    test("序列化：数字数组应转换为 JSON 字符串", () => {
        const data = {
            name: "test",
            menuIds: [1, 2, 3, 4, 5],
            apiIds: [10, 20, 30]
        };

        const result = serializeArrayFields(data);

        expect(result.name).toBe("test");
        expect(result.menuIds).toBe("[1,2,3,4,5]");
        expect(result.apiIds).toBe("[10,20,30]");
    });

    test("序列化：字符串数组应转换为 JSON 字符串", () => {
        const data = {
            tags: ["tag1", "tag2", "tag3"]
        };

        const result = serializeArrayFields(data);
        expect(result.tags).toBe('["tag1","tag2","tag3"]');
    });

    test('序列化：空数组应转换为 "[]"', () => {
        const data = {
            menuIds: []
        };

        const result = serializeArrayFields(data);
        expect(result.menuIds).toBe("[]");
    });

    test("序列化：null 和 undefined 应保持不变", () => {
        const data = {
            menuIds: null,
            apiIds: undefined,
            name: "test"
        };

        const result = serializeArrayFields(data);
        expect(result.menuIds).toBeNull();
        expect(result.apiIds).toBeUndefined();
        expect(result.name).toBe("test");
    });

    test("序列化：非数组字段应保持不变", () => {
        const data = {
            name: "test",
            age: 25,
            active: true,
            menuIds: [1, 2, 3]
        };

        const result = serializeArrayFields(data);
        expect(result.name).toBe("test");
        expect(result.age).toBe(25);
        expect(result.active).toBe(true);
        expect(result.menuIds).toBe("[1,2,3]");
    });

    // ==================== 反序列化测试 ====================

    test("反序列化：JSON 数字数组字符串应转换为数组", () => {
        const data = {
            name: "test",
            menuIds: "[1,2,3,4,5]",
            apiIds: "[10,20,30]"
        };

        const result = deserializeArrayFields(data);

        expect(result.name).toBe("test");
        expect(result.menuIds).toEqual([1, 2, 3, 4, 5]);
        expect(result.apiIds).toEqual([10, 20, 30]);
    });

    test("反序列化：JSON 字符串数组应转换为数组", () => {
        const data = {
            tags: '["tag1","tag2","tag3"]'
        };

        const result = deserializeArrayFields(data);
        expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    test('反序列化："[]" 应转换为空数组', () => {
        const data = {
            menuIds: "[]"
        };

        const result = deserializeArrayFields(data);
        expect(result.menuIds).toEqual([]);
    });

    test("反序列化：非 JSON 数组字符串应保持不变", () => {
        const data = {
            name: "test",
            description: "This is a [test] string",
            url: "https://example.com"
        };

        const result = deserializeArrayFields(data);
        expect(result.name).toBe("test");
        expect(result.description).toBe("This is a [test] string");
        expect(result.url).toBe("https://example.com");
    });

    test("反序列化：无效的 JSON 字符串应保持不变", () => {
        const data = {
            menuIds: "[1,2,3,", // 无效 JSON
            apiIds: "[invalid]"
        };

        const result = deserializeArrayFields(data);
        expect(result.menuIds).toBe("[1,2,3,");
        expect(result.apiIds).toBe("[invalid]");
    });

    test("反序列化：非字符串值应保持不变", () => {
        const data = {
            name: "test",
            age: 25,
            active: true,
            count: null
        };

        const result = deserializeArrayFields(data);
        expect(result.name).toBe("test");
        expect(result.age).toBe(25);
        expect(result.active).toBe(true);
        expect(result.count).toBeNull();
    });

    test("反序列化：null 数据应返回 null", () => {
        const result = deserializeArrayFields(null);
        expect(result).toBeNull();
    });

    // ==================== 往返测试 ====================

    test("往返：序列化后反序列化应得到原始数据", () => {
        const originalData = {
            name: "test role",
            menuIds: [1, 2, 3, 4, 5],
            apiIds: [10, 20, 30, 40],
            tags: ["tag1", "tag2"],
            emptyArray: []
        };

        const serialized = serializeArrayFields(originalData);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.name).toBe(originalData.name);
        expect(deserialized.menuIds).toEqual(originalData.menuIds);
        expect(deserialized.apiIds).toEqual(originalData.apiIds);
        expect(deserialized.tags).toEqual(originalData.tags);
        expect(deserialized.emptyArray).toEqual(originalData.emptyArray);
    });

    // ==================== 边界情况测试 ====================

    test("边界情况：包含特殊字符的字符串数组", () => {
        const data = {
            items: ['item"1', "item'2", "item[3]", "item,4"]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.items).toEqual(data.items);
    });

    test("边界情况：嵌套数组（JSON 支持）", () => {
        const data = {
            nested: [
                [1, 2],
                [3, 4],
                [5, 6]
            ]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.nested).toEqual(data.nested);
    });

    test("边界情况：大数组", () => {
        const data = {
            largeArray: Array.from({ length: 1000 }, (_, i) => i)
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.largeArray).toEqual(data.largeArray);
        expect(deserialized.largeArray.length).toBe(1000);
    });

    test("边界情况：混合类型数组（JSON 支持）", () => {
        const data = {
            mixed: [1, "two", true, null, { key: "value" }]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.mixed).toEqual(data.mixed);
    });
});
