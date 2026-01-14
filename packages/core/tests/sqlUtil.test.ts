import { describe, test, expect } from "bun:test";

import { escapeComment, normalizeColumnDefaultValue, toNumberFromSql, toSqlParams } from "../utils/sqlUtil";

describe("utils/sqlUtil - escapeComment", () => {
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

describe("utils/sqlUtil - normalizeColumnDefaultValue", () => {
    test("null -> null", () => {
        expect(normalizeColumnDefaultValue(null)).toBeNull();
    });

    test("primitive passthrough", () => {
        expect(normalizeColumnDefaultValue("x")).toBe("x");
        expect(normalizeColumnDefaultValue(1)).toBe(1);
        expect(normalizeColumnDefaultValue(true)).toBe(true);
    });

    test("array recursion + fallback to String", () => {
        expect(normalizeColumnDefaultValue([1, null, true, 2n, { a: 1 }])).toEqual([1, null, true, "2", "[object Object]"]);
    });
});

describe("utils/sqlUtil - toSqlParams", () => {
    test("undefined -> []", () => {
        expect(toSqlParams(undefined)).toEqual([]);
    });

    test("bigint -> string; Date passthrough; unknown -> String", () => {
        const d = new Date(1700000000000);
        const params = toSqlParams([1n, d, Symbol("x")]);

        expect(params.length).toBe(3);
        expect(params[0]).toBe("1");
        expect(params[1]).toBe(d);
        // Symbol 无法 JSON 化，应回退到 String
        expect(params[2]).toBe("Symbol(x)");
    });

    test("JsonObject 中的 undefined 字段会被剥离（保证返回值可 JSON 表达）", () => {
        const params = toSqlParams([{ a: 1, b: undefined, c: { d: 2, e: undefined } }]);
        expect(params).toEqual([{ a: 1, c: { d: 2 } }]);
    });
});

describe("utils/sqlUtil - toNumberFromSql", () => {
    test("number passthrough", () => {
        expect(toNumberFromSql(12)).toBe(12);
    });

    test("bigint -> number", () => {
        expect(toNumberFromSql(12n)).toBe(12);
    });

    test("others -> 0", () => {
        expect(toNumberFromSql(null)).toBe(0);
        expect(toNumberFromSql("1")).toBe(0);
    });
});
