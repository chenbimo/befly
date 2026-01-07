import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { __test__ } from "../sync/syncMenu.ts";

const testRootDir = join(process.cwd(), "temp", "test-sync-menu-views");
const viewsDir = join(testRootDir, "views");

function writeMetaJson(dir: string, title: string, order?: number): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify({ title: title, order: order });
    writeFileSync(join(dir, "meta.json"), content, { encoding: "utf8" });
}

beforeAll(() => {
    if (existsSync(testRootDir)) {
        rmSync(testRootDir, { recursive: true, force: true });
    }
    mkdirSync(viewsDir, { recursive: true });

    // 根级 index：应映射为 prefix 本身（不带尾随 /）
    writeMetaJson(join(viewsDir, "index"), "Root", 2);

    // 带数字后缀目录：应清理后缀
    writeMetaJson(join(viewsDir, "user_1"), "User", 1);
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
