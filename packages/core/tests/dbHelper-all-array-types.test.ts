/**
 * 验证所有数组类型的序列化/反序列化支持
 *
 * 测试类型：
 * - array_string
 * - array_text
 * - array_number_string
 * - array_number_text
 */

import { describe, expect, test } from "bun:test";

describe("所有数组类型的序列化/反序列化支持", () => {
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

    // ==================== array_string 类型 ====================

    test("array_string: 字符串数组序列化和反序列化", () => {
        const data = {
            tags: ["tag1", "tag2", "tag3"]
        };

        const serialized = serializeArrayFields(data);
        expect(serialized.tags).toBe('["tag1","tag2","tag3"]');

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    test("array_string: 空数组", () => {
        const data = {
            tags: []
        };

        const serialized = serializeArrayFields(data);
        expect(serialized.tags).toBe("[]");

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.tags).toEqual([]);
    });

    // ==================== array_text 类型 ====================

    test("array_text: 长文本数组序列化和反序列化", () => {
        const data = {
            descriptions: ["这是一段很长的文本描述" + "x".repeat(500), "另一段很长的描述" + "y".repeat(500)]
        };

        const serialized = serializeArrayFields(data);
        expect(typeof serialized.descriptions).toBe("string");
        expect(serialized.descriptions.startsWith("[")).toBe(true);

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.descriptions).toEqual(data.descriptions);
    });

    test("array_text: 包含特殊字符的文本数组", () => {
        const data = {
            contents: ['Text with "quotes"', "Text with 'apostrophes'", "Text with\nnewlines", "Text with\ttabs"]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.contents).toEqual(data.contents);
    });

    // ==================== array_number_string 类型 ====================

    test("array_number_string: 数字数组序列化和反序列化", () => {
        const data = {
            menuIds: [1, 2, 3, 4, 5],
            apiIds: [10, 20, 30, 40, 50]
        };

        const serialized = serializeArrayFields(data);
        expect(serialized.menuIds).toBe("[1,2,3,4,5]");
        expect(serialized.apiIds).toBe("[10,20,30,40,50]");

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.menuIds).toEqual([1, 2, 3, 4, 5]);
        expect(deserialized.apiIds).toEqual([10, 20, 30, 40, 50]);
    });

    test("array_number_string: 大数字数组", () => {
        const data = {
            ids: [999999999999, 888888888888, 777777777777]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.ids).toEqual(data.ids);
    });

    test("array_number_string: 负数和小数", () => {
        const data = {
            numbers: [-1, -2.5, 0, 3.14, 100]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.numbers).toEqual(data.numbers);
    });

    // ==================== array_number_text 类型 ====================

    test("array_number_text: 长数字数组序列化和反序列化", () => {
        const data = {
            historyIds: Array.from({ length: 500 }, (_, i) => i + 1)
        };

        const serialized = serializeArrayFields(data);
        expect(typeof serialized.historyIds).toBe("string");
        expect(serialized.historyIds.length).toBeGreaterThan(1000);

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.historyIds).toEqual(data.historyIds);
        expect(deserialized.historyIds.length).toBe(500);
    });

    test("array_number_text: 时间戳数组", () => {
        const data = {
            timestamps: [1702540800000, 1702627200000, 1702713600000]
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.timestamps).toEqual(data.timestamps);
    });

    // ==================== 混合场景测试 ====================

    test("混合场景: 所有数组类型同时存在", () => {
        const data = {
            // array_string
            tags: ["tag1", "tag2"],
            // array_text
            descriptions: ["Long text 1", "Long text 2"],
            // array_number_string
            menuIds: [1, 2, 3],
            // array_number_text
            historyIds: Array.from({ length: 100 }, (_, i) => i),
            // 非数组字段
            name: "test",
            count: 10
        };

        const serialized = serializeArrayFields(data);

        // 验证序列化
        expect(serialized.tags).toBe('["tag1","tag2"]');
        expect(serialized.descriptions).toBe('["Long text 1","Long text 2"]');
        expect(serialized.menuIds).toBe("[1,2,3]");
        expect(typeof serialized.historyIds).toBe("string");
        expect(serialized.name).toBe("test");
        expect(serialized.count).toBe(10);

        const deserialized = deserializeArrayFields(serialized);

        // 验证反序列化
        expect(deserialized.tags).toEqual(["tag1", "tag2"]);
        expect(deserialized.descriptions).toEqual(["Long text 1", "Long text 2"]);
        expect(deserialized.menuIds).toEqual([1, 2, 3]);
        expect(deserialized.historyIds).toEqual(data.historyIds);
        expect(deserialized.name).toBe("test");
        expect(deserialized.count).toBe(10);
    });

    test("混合场景: 包含 null 和 undefined 的数组字段", () => {
        const data = {
            tags: ["tag1", "tag2"],
            menuIds: null,
            apiIds: undefined,
            name: "test"
        };

        const serialized = serializeArrayFields(data);
        expect(serialized.tags).toBe('["tag1","tag2"]');
        expect(serialized.menuIds).toBeNull();
        expect(serialized.apiIds).toBeUndefined();

        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.tags).toEqual(["tag1", "tag2"]);
        expect(deserialized.menuIds).toBeNull();
        expect(deserialized.apiIds).toBeUndefined();
    });

    // ==================== 数据类型覆盖测试 ====================

    test("数据类型覆盖: 数组中包含不同类型元素", () => {
        const data = {
            // 混合类型数组（JSON 支持）
            mixed: [1, "string", true, null, { key: "value" }],
            // 嵌套数组
            nested: [
                [1, 2],
                [3, 4],
                [5, 6]
            ],
            // 空数组
            empty: []
        };

        const serialized = serializeArrayFields(data);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.mixed).toEqual(data.mixed);
        expect(deserialized.nested).toEqual(data.nested);
        expect(deserialized.empty).toEqual([]);
    });

    // ==================== 实际使用场景模拟 ====================

    test("实际场景: 角色权限数据", () => {
        const roleData = {
            id: 1,
            name: "管理员",
            code: "admin",
            menus: [1, 2, 3, 10, 11, 12, 20, 21], // array_number_string
            apis: [100, 101, 102, 200, 201, 202] // array_number_string
        };

        // 模拟写入数据库
        const serialized = serializeArrayFields(roleData);
        expect(serialized.menus).toBe("[1,2,3,10,11,12,20,21]");
        expect(serialized.apis).toBe("[100,101,102,200,201,202]");

        // 模拟从数据库查询
        const deserialized = deserializeArrayFields(serialized);
        expect(deserialized.menus).toEqual(roleData.menus);
        expect(deserialized.apis).toEqual(roleData.apis);

        // 验证可以直接使用数组方法
        expect(deserialized.menus.includes(1)).toBe(true);
        expect(deserialized.apis.length).toBe(6);
    });

    test("实际场景: 文章标签和分类", () => {
        const articleData = {
            id: 1,
            title: "测试文章",
            tags: ["JavaScript", "TypeScript", "Bun"], // array_string
            categoryIds: [1, 3, 5], // array_number_string
            relatedIds: Array.from({ length: 20 }, (_, i) => i + 100) // array_number_text
        };

        const serialized = serializeArrayFields(articleData);
        const deserialized = deserializeArrayFields(serialized);

        expect(deserialized.tags).toEqual(articleData.tags);
        expect(deserialized.categoryIds).toEqual(articleData.categoryIds);
        expect(deserialized.relatedIds).toEqual(articleData.relatedIds);
    });

    // ==================== 完整流程测试 ====================

    test("完整流程: 批量插入场景", () => {
        const roles = [
            { name: "管理员", menus: [1, 2, 3], apis: [10, 20] },
            { name: "编辑", menus: [2, 3], apis: [20] },
            { name: "访客", menus: [3], apis: [] }
        ];

        // 模拟批量序列化
        const serializedRoles = roles.map((role) => serializeArrayFields(role));

        expect(serializedRoles[0].menus).toBe("[1,2,3]");
        expect(serializedRoles[1].menus).toBe("[2,3]");
        expect(serializedRoles[2].menus).toBe("[3]");
        expect(serializedRoles[2].apis).toBe("[]");

        // 模拟批量反序列化
        const deserializedRoles = serializedRoles.map((role) => deserializeArrayFields(role));

        expect(deserializedRoles[0].menus).toEqual([1, 2, 3]);
        expect(deserializedRoles[1].menus).toEqual([2, 3]);
        expect(deserializedRoles[2].menus).toEqual([3]);
        expect(deserializedRoles[2].apis).toEqual([]);
    });
});
