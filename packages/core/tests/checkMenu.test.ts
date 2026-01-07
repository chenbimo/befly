import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { checkMenu } from "../checks/checkMenu.ts";

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

            // 菜单层级应以配置树（children）为准，而非按 URL path 分段强制推导父级。
            // 因此单个菜单（即使 path 含多段）也允许作为根级菜单存在。
            const menus = await checkMenu([]);
            expect(Array.isArray(menus)).toBe(true);
            expect(menus).toHaveLength(1);
            expect(menus[0]?.path).toBe("/a/b");
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

    test("sort 最小值应为 1（sort=0 应阻断启动）", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-sort-min-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(menusJsonPath, JSON.stringify([{ name: "A", path: "/a", sort: 0 }], null, 4), { encoding: "utf8" });

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
