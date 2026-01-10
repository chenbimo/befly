import { describe, expect, test } from "bun:test";

import { cleanParams } from "../utils/cleanParams";

describe("befly-shared/cleanParams", () => {
    test("默认强制移除 null/undefined", () => {
        const result = cleanParams({ a: null, b: undefined, c: 0, d: "" }, []);
        expect(Object.hasOwn(result, "a")).toBe(false);
        expect(Object.hasOwn(result, "b")).toBe(false);
        expect(result.c).toBe(0);
        expect(result.d).toBe("");
    });

    test("未配置 key 规则时应用全局 dropValues", () => {
        const result = cleanParams({ a: 0, b: "", c: 1 }, [0, ""]);
        expect(Object.hasOwn(result, "a")).toBe(false);
        expect(Object.hasOwn(result, "b")).toBe(false);
        expect(result.c).toBe(1);
    });

    test("配置了 key 规则则以 key 规则为准（忽略全局 dropValues）", () => {
        const result = cleanParams(
            {
                page: 0,
                keyword: "",
                other: 0
            },
            [0, ""],
            {
                page: [],
                keyword: [""]
            }
        );

        expect(result.page).toBe(0);
        expect(Object.hasOwn(result, "keyword")).toBe(false);
        expect(Object.hasOwn(result, "other")).toBe(false);
    });
});
