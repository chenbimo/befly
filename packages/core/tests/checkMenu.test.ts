import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.js";

describe("checkMenu", () => {
    test("重复 path 应阻断菜单同步", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-dup-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        { name: "A", path: "/a", sort: 1 },
                        { name: "B", path: "/a", sort: 2 }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            let thrown: any = null;
            try {
                await checkMenu([]);
            } catch (error: any) {
                thrown = error;
            }

            expect(thrown).toBeTruthy();
            expect(thrown.message).toBe("菜单结构检查失败");
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("缺失父级 path 应阻断菜单同步", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-parent-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(menusJsonPath, JSON.stringify([{ name: "B", path: "/a/b", sort: 1 }], null, 4), { encoding: "utf8" });

            let thrown: any = null;
            try {
                await checkMenu([]);
            } catch (error: any) {
                thrown = error;
            }

            expect(thrown).toBeTruthy();
            expect(thrown.message).toBe("菜单结构检查失败");
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("合法 menus.json 应通过检查", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-ok-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(menusJsonPath, JSON.stringify([{ name: "A", path: "/a", sort: 1, children: [{ name: "B", path: "/a/b", sort: 2 }] }], null, 4), { encoding: "utf8" });

            const menus = await checkMenu([]);
            expect(Array.isArray(menus)).toBe(true);
            expect(menus.length).toBe(1);
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("超过三级菜单应阻断同步", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-depth-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        {
                            name: "A",
                            path: "/a",
                            sort: 1,
                            children: [
                                {
                                    name: "B",
                                    path: "/a/b",
                                    sort: 2,
                                    children: [
                                        {
                                            name: "C",
                                            path: "/a/b/c",
                                            sort: 3,
                                            children: [
                                                {
                                                    name: "D",
                                                    path: "/a/b/c/d",
                                                    sort: 4
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            let thrown: any = null;
            try {
                await checkMenu([]);
            } catch (error: any) {
                thrown = error;
            }

            expect(thrown).toBeTruthy();
            expect(thrown.message).toBe("菜单结构检查失败");
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });
});
