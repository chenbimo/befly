import { describe, test, expect, beforeAll, afterAll } from "bun:test";

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { __test__ } from "../sync/syncMenu.js";

const testRootDir = join(process.cwd(), "temp", "test-sync-menu-views");
const viewsDir = join(testRootDir, "views");

function writeVueIndex(dir: string, title: string, order?: number): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    const metaOrder = typeof order === "number" ? `, order: ${order}` : "";

    const content = `<script setup>\ndefinePage({ meta: { title: "${title}"${metaOrder} } });\n</script>\n\n<template>\n    <div />\n</template>\n`;
    writeFileSync(join(dir, "index.vue"), content, { encoding: "utf8" });
}

beforeAll(() => {
    if (existsSync(testRootDir)) {
        rmSync(testRootDir, { recursive: true, force: true });
    }
    mkdirSync(viewsDir, { recursive: true });

    // 根级 index：应映射为 prefix 本身（不带尾随 /）
    writeVueIndex(join(viewsDir, "index"), "Root", 2);

    // 带数字后缀目录：应清理后缀
    writeVueIndex(join(viewsDir, "user_1"), "User", 1);
});

afterAll(() => {
    if (existsSync(testRootDir)) {
        rmSync(testRootDir, { recursive: true, force: true });
    }
});

describe("syncMenu - scanViewsDir paths", () => {
    test("根级 index 不应生成尾随斜杠", async () => {
        const prefix = "/addon/addonAdmin";
        const menus = await __test__.scanViewsDir(viewsDir, prefix);

        const root = menus.find((m) => m.path === prefix);
        expect(root).toBeDefined();
        expect(root?.path).toBe(prefix);
    });

    test("目录名 _数字 后缀应被清理", async () => {
        const prefix = "/addon/addonAdmin";
        const menus = await __test__.scanViewsDir(viewsDir, prefix);

        const user = menus.find((m) => m.path === "/addon/addonAdmin/user");
        expect(user).toBeDefined();
        expect(user?.name).toBe("User");
        expect(user?.sort).toBe(1);
    });
});

describe("syncMenu - normalizeMenuPath", () => {
    test("去掉尾随 / 且折叠多 /", () => {
        expect(__test__.normalizeMenuPath("/addon/a/"))
            .toBe("/addon/a");
        expect(__test__.normalizeMenuPath("//addon//a//b/"))
            .toBe("/addon/a/b");
        expect(__test__.normalizeMenuPath("addon/a"))
            .toBe("/addon/a");
        expect(__test__.normalizeMenuPath("/"))
            .toBe("/");
    });
});
