import { describe, expect, test } from "bun:test";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock, normalizeMenuPath, normalizeMenuTree } from "befly-shared/utils/scanViewsDir";

describe("befly-shared/scanViewsDir - cleanDirName", () => {
    test("should remove numeric suffix like _1", () => {
        expect(cleanDirName("login_1")).toBe("login");
        expect(cleanDirName("index_2")).toBe("index");
    });

    test("should keep name when no numeric suffix", () => {
        expect(cleanDirName("index")).toBe("index");
        expect(cleanDirName("my_12x")).toBe("my_12x");
    });
});

describe("befly-shared/scanViewsDir - normalizeMenuPath", () => {
    test("should normalize empty to /", () => {
        expect(normalizeMenuPath("")).toBe("/");
        expect(normalizeMenuPath("/")).toBe("/");
    });

    test("should ensure leading slash", () => {
        expect(normalizeMenuPath("abc")).toBe("/abc");
    });

    test("should collapse multiple slashes and trim trailing slash", () => {
        expect(normalizeMenuPath("//a///b")).toBe("/a/b");
        expect(normalizeMenuPath("/a/b///")).toBe("/a/b");
    });
});

describe("befly-shared/scanViewsDir - extractScriptSetupBlock", () => {
    test("should extract the first <script setup> content", () => {
        const vue = `\n<template><div /></template>\n\n<script lang="ts">\nexport default {}\n</script>\n\n<script setup lang="ts">\nconst a = 1\n</script>\n`;
        expect(extractScriptSetupBlock(vue)?.trim()).toBe("const a = 1");
    });

    test("should return null when missing <script setup>", () => {
        const vue = `<template />\n<script>\nexport default {}\n</script>`;
        expect(extractScriptSetupBlock(vue)).toBeNull();
    });
});

describe("befly-shared/scanViewsDir - extractDefinePageMetaFromScriptSetup", () => {
    test("should extract title and order", () => {
        const scriptSetup = `\ndefinePage({\n  meta: {\n    title: "User",\n    order: 3\n  }\n})\n`;

        expect(extractDefinePageMetaFromScriptSetup(scriptSetup)).toEqual({
            title: "User",
            order: 3
        });
    });

    test("should extract title without order", () => {
        const scriptSetup = `definePage({ meta: { title: \`Dashboard\` } })`;
        expect(extractDefinePageMetaFromScriptSetup(scriptSetup)).toEqual({
            title: "Dashboard",
            order: undefined
        });
    });

    test("should return null when title is missing", () => {
        const scriptSetup = `definePage({ meta: { order: 1 } })`;
        expect(extractDefinePageMetaFromScriptSetup(scriptSetup)).toBeNull();
    });
});

describe("befly-shared/scanViewsDir - normalizeMenuTree", () => {
    test("should normalize paths and merge children for same path", () => {
        const input = [
            {
                name: "A",
                path: "/a/",
                sort: 2,
                icon: "keep",
                children: [
                    { name: "B", path: "/a/b", sort: 2 },
                    { name: "C", path: "/a/c/", sort: 1 }
                ]
            },
            {
                name: "A2",
                path: "/a",
                sort: 1,
                children: [{ name: "D", path: "/a/d", sort: 3 }]
            }
        ];

        const normalized = normalizeMenuTree(input as any);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].path).toBe("/a");
        expect(normalized[0].name).toBe("A2");
        expect((normalized[0] as any).icon).toBe("keep");
        expect(normalized[0].sort).toBe(1);

        const childPaths = (normalized[0].children || []).map((x: any) => x.path);
        expect(childPaths).toEqual(["/a/c", "/a/b", "/a/d"]);
    });

    test("should sort root nodes by sort ascending with default=999", () => {
        const input = [
            { name: "B", path: "/b", sort: 2 },
            { name: "A", path: "/a" },
            { name: "C", path: "/c", sort: 3 }
        ];

        const normalized = normalizeMenuTree(input as any);
        expect(normalized.map((x: any) => x.path)).toEqual(["/b", "/c", "/a"]);
    });
});
