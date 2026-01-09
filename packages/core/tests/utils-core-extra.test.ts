import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { clearRegexCache, getCompiledRegex, getRegex, getRegexCacheSize, matchRegex } from "../configs/presetRegexp";
import { importDefault } from "../utils/importDefault";
import { normalizeViewDirMeta } from "../utils/loadMenuConfigs";
import { mergeAndConcat } from "../utils/mergeAndConcat";
import { getProcessRole, isPrimaryProcess } from "../utils/processInfo";
import { camelCase, escapeRegExp, forOwn, getByPath, isEmpty, isPlainObject, keyBy, omit, setByPath, snakeCase } from "../utils/util";

// 说明：
// - 这里的测试目标是“utils 纯函数/小工具”的边界与异常分支覆盖。
// - 不引入 befly-shared；本文件覆盖之前 shared/utils/scanViewsDir 的迁移实现。

describe("utils - isPlainObject", () => {
    test("should return true for plain object", () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
    });

    test("should return false for arrays / null / class instances", () => {
        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject([])).toBe(false);

        class A {
            x = 1;
        }

        expect(isPlainObject(new A())).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
    });
});

describe("utils - isEmpty (aggressive)", () => {
    test("null/undefined/string/number/boolean", () => {
        expect(isEmpty(null)).toBe(true);
        expect(isEmpty(undefined)).toBe(true);

        expect(isEmpty("")).toBe(true);
        expect(isEmpty("   ")).toBe(true);
        expect(isEmpty("a")).toBe(false);

        expect(isEmpty(0)).toBe(true);
        expect(isEmpty(NaN)).toBe(true);
        expect(isEmpty(1)).toBe(false);

        expect(isEmpty(false)).toBe(true);
        expect(isEmpty(true)).toBe(false);
    });

    test("array/map/set/plain object", () => {
        expect(isEmpty([])).toBe(true);
        expect(isEmpty([1])).toBe(false);

        expect(isEmpty(new Map())).toBe(true);
        expect(isEmpty(new Map([["a", 1]]))).toBe(false);

        expect(isEmpty(new Set())).toBe(true);
        expect(isEmpty(new Set([1]))).toBe(false);

        expect(isEmpty({})).toBe(true);
        expect(isEmpty({ a: 1 })).toBe(false);
    });

    test("should treat non-plain objects as non-empty", () => {
        expect(isEmpty(new Date())).toBe(false);
        expect(isEmpty(/a/)).toBe(false);
    });
});

describe("utils - camelCase/snakeCase", () => {
    test("camelCase: common separators", () => {
        expect(camelCase("my_plugin")).toBe("myPlugin");
        expect(camelCase("my-plugin")).toBe("myPlugin");
        expect(camelCase("my plugin")).toBe("myPlugin");
    });

    test("camelCase: already camel/Pascal", () => {
        expect(camelCase("myPlugin")).toBe("myPlugin");
        expect(camelCase("MyPlugin")).toBe("myPlugin");
    });

    test("snakeCase: common cases", () => {
        expect(snakeCase("userId")).toBe("user_id");
        expect(snakeCase("UserId")).toBe("user_id");
        expect(snakeCase("user-id")).toBe("user_id");
        expect(snakeCase("user id")).toBe("user_id");
        expect(snakeCase("user__id")).toBe("user_id");
    });

    test("empty inputs", () => {
        expect(camelCase("")).toBe("");
        expect(snakeCase("")).toBe("");
    });
});

describe("utils - omit", () => {
    test("should omit keys from plain object", () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = omit(obj, ["b", "x"]);
        expect(result).toEqual({ a: 1, c: 3 });
    });

    test("non-plain object should return empty object", () => {
        expect(omit(null, ["a"])).toEqual({});
        expect(omit([], ["a"])).toEqual({});
    });
});

describe("utils - forOwn", () => {
    test("should iterate own enumerable keys", () => {
        const out: string[] = [];
        forOwn({ a: 1, b: 2 }, (v, k) => out.push(`${k}:${v}`));
        expect(out.sort()).toEqual(["a:1", "b:2"]);
    });

    test("should ignore non-plain objects", () => {
        const out: Array<[string, unknown]> = [];
        forOwn([], (v, k) => out.push([k, v]));
        expect(out.length).toBe(0);
    });
});

describe("utils - keyBy", () => {
    test("should map by key", () => {
        const items = [
            { id: "a", v: 1 },
            { id: "b", v: 2 }
        ];
        const mapped = keyBy(items, (x) => x.id);
        expect(mapped.a.v).toBe(1);
        expect(mapped.b.v).toBe(2);
    });

    test("should skip empty keys", () => {
        const items = [
            { id: "", v: 1 },
            { id: "a", v: 2 }
        ];
        const mapped = keyBy(items, (x) => x.id);
        expect(mapped.a.v).toBe(2);
        expect(Object.hasOwn(mapped, "")).toBe(false);
    });

    test("invalid inputs", () => {
        expect(keyBy(null, () => "a")).toEqual({});
        expect(keyBy([], null)).toEqual({});
    });
});

describe("utils - escapeRegExp", () => {
    test("should escape special chars", () => {
        const s = "a+b*c?d.e(f)g[h]i{j}k|l^m$n\\";
        const escaped = escapeRegExp(s);
        expect(new RegExp(escaped).test(s)).toBe(true);
    });
});

describe("utils - getByPath/setByPath", () => {
    test("getByPath: empty path returns object", () => {
        const obj = { a: 1 };
        expect(getByPath(obj, "")).toBe(obj);
    });

    test("getByPath: returns undefined for missing or non-object traversal", () => {
        expect(getByPath({ a: 1 }, "a.b.c")).toBeUndefined();
        expect(getByPath(1, "a")).toBeUndefined();
    });

    test("setByPath: should create nested objects", () => {
        const obj: Record<string, unknown> = {};
        setByPath(obj, "a.b.c", 1);
        expect(obj).toEqual({ a: { b: { c: 1 } } });
    });

    test("setByPath: empty segment should no-op", () => {
        const obj: Record<string, unknown> = { a: 1 };
        setByPath(obj, "a..b", 2);
        expect(obj).toEqual({ a: 1 });
    });
});

describe("utils - mergeAndConcat", () => {
    test("should deep merge objects", () => {
        const a = { x: { y: 1 }, z: 1 };
        const b = { x: { k: 2 }, z: 2 };
        const merged = mergeAndConcat(a, b);
        expect(merged).toEqual({ x: { y: 1, k: 2 }, z: 2 });
        // ensure not mutate inputs
        expect(a).toEqual({ x: { y: 1 }, z: 1 });
        expect(b).toEqual({ x: { k: 2 }, z: 2 });
    });

    test("should concat arrays", () => {
        const merged = mergeAndConcat({ a: [1] }, { a: [2, 3] });
        expect(merged).toEqual({ a: [1, 2, 3] });
    });

    test("should ignore undefined", () => {
        const merged = mergeAndConcat({ a: 1 }, undefined, { b: 2 });
        expect(merged).toEqual({ a: 1, b: 2 });
    });
});

describe("utils - regex cache", () => {
    test("getRegex: alias and raw", () => {
        expect(getRegex("@email")).toContain("@");
        expect(getRegex("^abc$")).toBe("^abc$");
    });

    test("getCompiledRegex caches", () => {
        clearRegexCache();
        expect(getRegexCacheSize()).toBe(0);
        const r1 = getCompiledRegex("^abc$");
        const r2 = getCompiledRegex("^abc$");
        expect(r1).toBe(r2);
        expect(getRegexCacheSize()).toBe(1);
    });

    test("matchRegex uses cache and matches", () => {
        clearRegexCache();
        expect(matchRegex("abc", "^abc$")).toBe(true);
        expect(matchRegex("abcd", "^abc$")).toBe(false);
        expect(getRegexCacheSize()).toBe(1);
    });
});

describe("utils - view meta normalize", () => {
    test("normalizeViewDirMeta should return title and order", () => {
        const meta = normalizeViewDirMeta({ title: "Hello", order: 12 });
        expect(meta).toEqual({ title: "Hello", order: 12 });
    });

    test("order is optional", () => {
        const meta = normalizeViewDirMeta({ title: "Hello" });
        expect(meta).toEqual({ title: "Hello", order: undefined });
    });

    test("order must be >= 0", () => {
        expect(normalizeViewDirMeta({ title: "Hello", order: -1 })).toEqual({ title: "Hello", order: undefined });
    });

    test("order: non-integer / non-finite should be ignored", () => {
        expect(normalizeViewDirMeta({ title: "Hello", order: 1.2 })).toEqual({ title: "Hello", order: undefined });
        expect(normalizeViewDirMeta({ title: "Hello", order: Infinity })).toEqual({ title: "Hello", order: undefined });
        expect(normalizeViewDirMeta({ title: "Hello", order: NaN })).toEqual({ title: "Hello", order: undefined });
        expect(normalizeViewDirMeta({ title: "Hello", order: "1" })).toEqual({ title: "Hello", order: undefined });
    });

    test("missing/invalid title returns null", () => {
        expect(normalizeViewDirMeta({ order: 1 })).toBeNull();
        expect(normalizeViewDirMeta({ title: "" })).toBeNull();
        expect(normalizeViewDirMeta({ title: 123 })).toBeNull();
    });

    test("non-object returns null", () => {
        expect(normalizeViewDirMeta(null)).toBeNull();
        expect(normalizeViewDirMeta(undefined)).toBeNull();
        expect(normalizeViewDirMeta(1)).toBeNull();
        expect(normalizeViewDirMeta("x")).toBeNull();
        expect(normalizeViewDirMeta([])).toBeNull();
    });
});

describe("utils - process role", () => {
    test("standalone should be primary", () => {
        const role = getProcessRole({});
        expect(role.env).toBe("standalone");
        expect(role.role).toBe("primary");
        expect(isPrimaryProcess({})).toBe(true);
    });

    test("bun-cluster env", () => {
        expect(getProcessRole({ BUN_WORKER_ID: "" }).role).toBe("primary");
        expect(getProcessRole({ BUN_WORKER_ID: "2" }).role).toBe("worker");
    });

    test("pm2-cluster env", () => {
        expect(getProcessRole({ PM2_INSTANCE_ID: "0" }).role).toBe("primary");
        expect(getProcessRole({ PM2_INSTANCE_ID: "1" }).role).toBe("worker");
    });

    test("bun env should win when both bun and pm2 ids exist", () => {
        // 说明：在某些托管环境下可能同时注入多种进程管理器变量。
        // 我们约定：只要存在 BUN_WORKER_ID，就按 bun-cluster 判定。
        const role = getProcessRole({
            BUN_WORKER_ID: "2",
            PM2_INSTANCE_ID: "0"
        });
        expect(role.env).toBe("bun-cluster");
        expect(role.role).toBe("worker");
        expect(role.instanceId).toBe("2");
    });
});

describe("utils - importDefault", () => {
    test("should load default export", async () => {
        const file = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "importDefault-ok.ts");
        const res = await importDefault<any>(file, { ok: false });
        expect(res.ok).toBe(true);
        expect(res.value).toBe(123);
    });

    test("null/undefined default should fallback", async () => {
        const fileNull = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "importDefault-null.ts");
        const resNull = await importDefault<any>(fileNull, { ok: "fallback" });
        expect(resNull).toEqual({ ok: "fallback" });

        const fileUndef = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "importDefault-undefined.ts");
        const resUndef = await importDefault<any>(fileUndef, { ok: "fallback" });
        expect(resUndef).toEqual({ ok: "fallback" });
    });

    test("missing default should fallback", async () => {
        const file = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "importDefault-no-default.ts");
        const res = await importDefault<any>(file, { ok: "fallback" });
        expect(res).toEqual({ ok: "fallback" });
    });

    test("import error should fallback", async () => {
        const file = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "does-not-exist.ts");
        const res = await importDefault<any>(file, { ok: "fallback" });
        expect(res).toEqual({ ok: "fallback" });
    });
});

describe("utils - loadMenuConfigs helpers", () => {
    test("getParentPath", async () => {
        const { getParentPath } = await import("../utils/loadMenuConfigs");
        expect(getParentPath("/a/b")).toBe("/a");
        expect(getParentPath("/a")).toBe("");
        expect(getParentPath("/")).toBe("");
    });
});
