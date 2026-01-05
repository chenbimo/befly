import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { presetFields } from "../configs/presetFields";
import { convertBigIntFields } from "../utils/convertBigIntFields";
import { setCorsOptions } from "../utils/cors";
import { compileDisableMenuGlobRules } from "../utils/disableMenusGlob";
import { genShortId } from "../utils/genShortId";
import { isDirentDirectory } from "../utils/isDirentDirectory";
import { processFields } from "../utils/processFields";
import { pickFields } from "../utils/util";

function ensureEmptyDir(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
}

describe("utils - cors", () => {
    test("origin='*' should use req origin header when present", () => {
        const req = new Request("http://localhost/", {
            headers: {
                origin: "https://example.com"
            }
        });

        const headers = setCorsOptions(req, { origin: "*" } as any);
        expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    });

    test("origin explicit should be used as-is", () => {
        const req = new Request("http://localhost/");
        const headers = setCorsOptions(req, { origin: "https://fixed.com", maxAge: 10 } as any);
        expect(headers["Access-Control-Allow-Origin"]).toBe("https://fixed.com");
        expect(headers["Access-Control-Max-Age"]).toBe("10");
    });
});

describe("utils - genShortId", () => {
    test("should return base36-ish id and mostly unique", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 200; i++) {
            const id = genShortId();
            expect(typeof id).toBe("string");
            expect(id.length).toBeGreaterThanOrEqual(10);
            expect(/^[a-z0-9]+$/i.test(id)).toBe(true);
            ids.add(id);
        }
        // 不是严格数学保证，但 200 次不应碰撞
        expect(ids.size).toBe(200);
    });
});

describe("utils - pickFields", () => {
    test("plain object", () => {
        const obj: any = { a: 1, b: 2 };
        expect(pickFields(obj, ["a", "x"]) as any).toEqual({ a: 1 });
    });

    test("array should also be supported", () => {
        const arr: any = ["x", "y"];
        const picked = pickFields(arr, ["0", "length"]) as any;
        expect(picked["0"]).toBe("x");
        expect(picked.length).toBe(2);
    });

    test("invalid input returns empty object", () => {
        expect(pickFields(null as any, ["a"]) as any).toEqual({});
        expect(pickFields(1 as any, ["a"]) as any).toEqual({});
    });
});

describe("utils - processFields", () => {
    test("should replace preset fields", () => {
        const out = processFields({ page: "@page", limit: "@limit" } as any, "hello", "/api/hello");
        // presetFields 的具体值不在此 hardcode，只验证替换发生且是 string
        expect(out.page).toBe(presetFields["@page"]);
        expect(out.limit).toBe(presetFields["@limit"]);
    });

    test("unknown preset should throw with hint", () => {
        try {
            processFields({ page: "@not_exist" } as any, "hello", "/api/hello");
            expect.unreachable();
        } catch (err: any) {
            const message = String(err && err.message ? err.message : err);
            expect(message).toContain("API [hello] (/api/hello)");
            expect(message).toContain("字段 [page]");
            expect(message).toContain('"@not_exist"');
            expect(message).toContain("可用的预设字段有");
            // 不 hardcode 完整列表，但关键项应出现（否则提示价值不大）
            expect(message).toContain("@page");
            expect(message).toContain("@limit");
        }
    });
});

describe("utils - convertBigIntFields", () => {
    test("should convert whitelisted and suffix fields when value is numeric string", () => {
        const input = [
            {
                id: "1",
                pid: "2",
                sort: "3",
                userId: "4",
                createdAt: "5",
                other: "no",
                state: "6"
            }
        ];

        const out = convertBigIntFields<any>(input);
        expect(out[0].id).toBe(1);
        expect(out[0].pid).toBe(2);
        expect(out[0].sort).toBe(3);
        expect(out[0].userId).toBe(4);
        expect(out[0].createdAt).toBe(5);
        expect(out[0].other).toBe("no");
        // state 不在默认白名单，也不匹配后缀，不应转换
        expect(out[0].state).toBe("6");
    });

    test("should keep non-numeric strings", () => {
        const input = [{ id: "x" }];
        const out = convertBigIntFields<any>(input);
        expect(out[0].id).toBe("x");
    });

    test("non-array input should be returned as-is", () => {
        expect(convertBigIntFields<any>(null as any) as any).toBeNull();
    });
});

describe("utils - isDirentDirectory", () => {
    test("should detect directory and file by Dirent", () => {
        const root = join(import.meta.dir, "..", "..", "temp", "fixtures", "dirent");
        ensureEmptyDir(root);

        const dir = join(root, "a");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(root, "a.txt"), "x", { encoding: "utf8" });

        const entries = readdirSync(root, { withFileTypes: true });
        const entryDir = entries.find((e) => e.name === "a");
        const entryFile = entries.find((e) => e.name === "a.txt");

        expect(entryDir).toBeTruthy();
        expect(entryFile).toBeTruthy();

        expect(isDirentDirectory(root, entryDir as any)).toBe(true);
        expect(isDirentDirectory(root, entryFile as any)).toBe(false);

        rmSync(root, { recursive: true, force: true });
    });

    test("should treat symbolic-link-like entry as directory when target is directory", () => {
        const root = join(import.meta.dir, "..", "..", "temp", "fixtures", "dirent2");
        ensureEmptyDir(root);

        mkdirSync(join(root, "real"), { recursive: true });

        const fake: any = {
            name: "real",
            isDirectory() {
                return false;
            },
            isSymbolicLink() {
                return true;
            }
        };

        expect(isDirentDirectory(root, fake)).toBe(true);
        rmSync(root, { recursive: true, force: true });
    });
});

describe("utils - disableMenusGlob cache", () => {
    test("compileDisableMenuGlobRules should reuse Glob instances for same pattern", () => {
        const a = compileDisableMenuGlobRules(["/admin/**"]);
        const b = compileDisableMenuGlobRules(["/admin/**"]);

        expect(a.length).toBe(1);
        expect(b.length).toBe(1);
        expect(a[0].glob).toBe(b[0].glob);
    });
});
