import { describe, expect, it } from "bun:test";

import { normalizePathnameListInput } from "../utils/normalizePathnameListInput";

describe("befly-shared - normalizePathnameListInput", () => {
    it("默认行为：假值应返回空数组", () => {
        expect(normalizePathnameListInput(undefined, "x", false)).toEqual([]);
        expect(normalizePathnameListInput(null, "x", false)).toEqual([]);
        expect(normalizePathnameListInput("", "x", false)).toEqual([]);
        expect(normalizePathnameListInput(false, "x", false)).toEqual([]);
        expect(normalizePathnameListInput(0, "x", false)).toEqual([]);
    });

    it("非数组应报错（不做默认转换）", () => {
        expect(() => normalizePathnameListInput(true, "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
        expect(() => normalizePathnameListInput(1, "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
        expect(() => normalizePathnameListInput("null", "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
        expect(() => normalizePathnameListInput("[]", "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
        expect(() => normalizePathnameListInput("/api/a,/api/b", "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
        expect(() => normalizePathnameListInput({}, "apiPaths", true)).toThrow("apiPaths 必须是字符串数组");
    });

    it("数组元素非字符串应报错", () => {
        expect(() => normalizePathnameListInput(["/api/a", 1 as any], "apiPaths", true)).toThrow("apiPaths[1] 必须是字符串");
    });

    it("forbidMethodPrefix=true: method 前缀应报错", () => {
        expect(() => normalizePathnameListInput(["GET/api/a"], "apiPaths", true)).toThrow("apiPaths[0] 不允许包含 method 前缀");

        expect(() => normalizePathnameListInput(["GET /api/a"], "apiPaths", true)).toThrow("apiPaths[0] 不允许包含 method 前缀");
    });

    it("元素包含空白字符应报错", () => {
        expect(() => normalizePathnameListInput(["/api/a b"], "apiPaths", false)).toThrow("apiPaths[0] 不允许包含空白字符");

        expect(() => normalizePathnameListInput(["/api/a\n"], "apiPaths", false)).toThrow("apiPaths[0] 不允许包含空白字符");
    });

    it("合法数组应原样返回（不去重/不排序）", () => {
        const input = ["/api/a", "/api/a", "/api/b"];
        expect(normalizePathnameListInput(input, "apiPaths", false)).toEqual(input);
    });

    it("必须是 pathname（以 / 开头）", () => {
        expect(() => normalizePathnameListInput(["menu/a"], "menuPaths", false)).toThrow("menuPaths[0] 必须是 pathname（以 / 开头）");

        expect(normalizePathnameListInput(["/menu/a", "/menu/b"], "menuPaths", false)).toEqual(["/menu/a", "/menu/b"]);
    });
});
