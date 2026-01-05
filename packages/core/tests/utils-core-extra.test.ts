import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { clearRegexCache, getCompiledRegex, getRegex, getRegexCacheSize, matchRegex } from "../configs/presetRegexp";
import { escapeRegExp } from "../lib/logger";
import { compileDisableMenuGlobRules, isMenuPathDisabledByGlobRules } from "../utils/disableMenusGlob";
import { importDefault } from "../utils/importDefault";
import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock } from "../utils/loadMenuConfigs";
import { mergeAndConcat } from "../utils/mergeAndConcat";
import { getProcessRole, isPrimaryProcess } from "../utils/process";
import { toListSqlLogFields, toSqlLogFields } from "../utils/sqlLog";
import { camelCase, forOwn, getByPath, isEmpty, isPlainObject, keyBy, omit, setByPath, snakeCase } from "../utils/util";

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
        const result = omit(obj, ["b", "x"]) as any;
        expect(result).toEqual({ a: 1, c: 3 });
    });

    test("non-plain object should return empty object", () => {
        expect(omit(null, ["a"]) as any).toEqual({});
        expect(omit([], ["a"]) as any).toEqual({});
    });
});

describe("utils - forOwn", () => {
    test("should iterate own enumerable keys", () => {
        const out: string[] = [];
        forOwn({ a: 1, b: 2 }, (v, k) => out.push(`${k}:${v}`));
        expect(out.sort()).toEqual(["a:1", "b:2"]);
    });

    test("should ignore non-plain objects", () => {
        const out: any[] = [];
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
        expect((mapped as any)[""]).toBeUndefined();
    });

    test("invalid inputs", () => {
        expect(keyBy(null as any, () => "a")).toEqual({});
        expect(keyBy([] as any, null as any)).toEqual({});
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
        expect(getByPath(1 as any, "a")).toBeUndefined();
    });

    test("setByPath: should create nested objects", () => {
        const obj: any = {};
        setByPath(obj, "a.b.c", 1);
        expect(obj).toEqual({ a: { b: { c: 1 } } });
    });

    test("setByPath: empty segment should no-op", () => {
        const obj: any = { a: 1 };
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

describe("utils - disableMenusGlob", () => {
    test("compile should validate input", () => {
        expect(() => compileDisableMenuGlobRules("/a" as any)).toThrow();
        expect(() => compileDisableMenuGlobRules([""])).toThrow();
        expect(() => compileDisableMenuGlobRules([1 as any])).toThrow();
    });

    test("should match using Bun.Glob", () => {
        const rules = compileDisableMenuGlobRules(["/admin/**", "/login$"]);
        expect(isMenuPathDisabledByGlobRules("/admin/user", rules)).toBe(true);
        expect(isMenuPathDisabledByGlobRules("/api/hello", rules)).toBe(false);
        // "glob" 语义下 '/login$' 不是正则，仅检查它不会误匹配。
        expect(isMenuPathDisabledByGlobRules("/login", rules)).toBe(false);
    });
});

describe("utils - cleanDirName", () => {
    test("should strip _<number> suffix", () => {
        expect(cleanDirName("login_1")).toBe("login");
        expect(cleanDirName("index_2")).toBe("index");
        expect(cleanDirName("index")).toBe("index");
        expect(cleanDirName("my_12x")).toBe("my_12x");
    });
});

describe("utils - script setup meta extract", () => {
    test("extractScriptSetupBlock should return first setup block", () => {
        const vue = `<template></template>\n<script setup>const a = 1</script>\n<script setup>const b = 2</script>`;
        const block = extractScriptSetupBlock(vue);
        expect(block).toContain("const a = 1");
        expect(block).not.toContain("const b = 2");
    });

    test("extractDefinePageMetaFromScriptSetup should return title and order", () => {
        const ss = `definePage({ meta: { title: 'Hello', order: 12 } })`;
        const meta = extractDefinePageMetaFromScriptSetup(ss);
        expect(meta).toEqual({ title: "Hello", order: 12 });
    });

    test("missing title returns null", () => {
        const ss = `definePage({ meta: { order: 1 } })`;
        expect(extractDefinePageMetaFromScriptSetup(ss)).toBeNull();
    });
});

describe("utils - sqlLog", () => {
    test("toSqlLogFields should normalize", () => {
        const result = toSqlLogFields({ sql: "SELECT 1", params: [1], duration: 3 } as any);
        expect(result).toEqual({ sqlPreview: "SELECT 1", sqlParams: [1], sqlDurationMs: 3 });
    });

    test("toListSqlLogFields should handle data optional", () => {
        const base = toListSqlLogFields({ count: { sql: "c", params: null, duration: null } } as any);
        expect(base.countSqlPreview).toBe("c");
        expect(base.countSqlParams).toEqual([]);
        expect(base.countSqlDurationMs).toBe(0);

        const full = toListSqlLogFields({
            count: { sql: "c", params: [], duration: 1 },
            data: { sql: "d", params: ["x"], duration: 2 }
        } as any);
        expect(full.dataSqlPreview).toBe("d");
        expect(full.dataSqlParams).toEqual(["x"]);
        expect(full.dataSqlDurationMs).toBe(2);
    });
});

describe("utils - process role", () => {
    test("standalone should be primary", () => {
        const oldBun = process.env.BUN_WORKER_ID;
        const oldPm2 = process.env.PM2_INSTANCE_ID;

        delete process.env.BUN_WORKER_ID;
        delete process.env.PM2_INSTANCE_ID;

        const role = getProcessRole();
        expect(role.env).toBe("standalone");
        expect(role.role).toBe("primary");
        expect(isPrimaryProcess()).toBe(true);

        if (oldBun === undefined) {
            delete process.env.BUN_WORKER_ID;
        } else {
            process.env.BUN_WORKER_ID = oldBun;
        }

        if (oldPm2 === undefined) {
            delete process.env.PM2_INSTANCE_ID;
        } else {
            process.env.PM2_INSTANCE_ID = oldPm2;
        }
    });

    test("bun-cluster env", () => {
        const old = process.env.BUN_WORKER_ID;
        process.env.BUN_WORKER_ID = "";
        expect(getProcessRole().role).toBe("primary");
        process.env.BUN_WORKER_ID = "2";
        expect(getProcessRole().role).toBe("worker");

        if (old === undefined) {
            delete process.env.BUN_WORKER_ID;
        } else {
            process.env.BUN_WORKER_ID = old;
        }
    });

    test("pm2-cluster env", () => {
        const old = process.env.PM2_INSTANCE_ID;
        process.env.PM2_INSTANCE_ID = "0";
        expect(getProcessRole().role).toBe("primary");
        process.env.PM2_INSTANCE_ID = "1";
        expect(getProcessRole().role).toBe("worker");

        if (old === undefined) {
            delete process.env.PM2_INSTANCE_ID;
        } else {
            process.env.PM2_INSTANCE_ID = old;
        }
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

// 为 loadMenuConfigs 准备一个最小的 views 目录夹具
function ensureEmptyDir(dir: string): void {
    if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
    }
    mkdirSync(dir, { recursive: true });
}

describe("utils - loadMenuConfigs helpers", () => {
    test("getParentPath", async () => {
        const { getParentPath } = await import("../utils/loadMenuConfigs");
        expect(getParentPath("/a/b")).toBe("/a");
        expect(getParentPath("/a")).toBe("");
        expect(getParentPath("/")).toBe("");
    });

    test("scanViewsDirToMenuConfigs should parse index.vue meta", async () => {
        const tempRoot = join(import.meta.dir, "..", "..", "..", "temp", "fixtures", "viewsMenu");
        ensureEmptyDir(tempRoot);

        // 真实结构：views/admin/*/index.vue
        const adminDir = join(tempRoot, "admin");
        mkdirSync(adminDir, { recursive: true });
        const userDir = join(adminDir, "user");
        mkdirSync(userDir, { recursive: true });

        await Bun.write(join(adminDir, "index.vue"), `<script setup>\ndefinePage({ meta: { title: 'Admin', order: 2 } })\n</script>`);
        await Bun.write(join(userDir, "index.vue"), `<script setup>\ndefinePage({ meta: { title: 'User', order: 1 } })\n</script>`);

        const { scanViewsDirToMenuConfigs } = await import("../utils/loadMenuConfigs");
        const menus = await scanViewsDirToMenuConfigs(tempRoot, "/app", "");

        expect(menus.length).toBe(1);
        expect(menus[0].name).toBe("Admin");
        expect(menus[0].path).toBe("/app/admin");
        expect(Array.isArray(menus[0].children)).toBe(true);
        expect(menus[0].children?.[0].name).toBe("User");
        expect(menus[0].children?.[0].path).toBe("/app/admin/user");

        // cleanup
        rmSync(tempRoot, { recursive: true, force: true });
    });
});
