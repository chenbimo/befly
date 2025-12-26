import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { beflyConfig } from "../befly.config.js";
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

    test("disableMenus（精确）应过滤指定菜单", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-disableMenus-exact-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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
                                    sort: 2
                                }
                            ]
                        },
                        {
                            name: "C",
                            path: "/c",
                            sort: 3
                        }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            const menus = await checkMenu([], { disableMenus: ["/a/b"] });
            expect(menus).toHaveLength(2);
            expect(menus[0]?.path).toBe("/a");
            expect(menus[1]?.path).toBe("/c");
            expect(Array.isArray((menus[0] as any)?.children)).toBe(false);
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("disableMenus（前缀 /*）应过滤子树", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-disableMenus-prefix-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        { name: "A", path: "/a", sort: 1 },
                        { name: "A-1", path: "/a/1", sort: 2 },
                        { name: "B", path: "/b", sort: 3 }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            const menus = await checkMenu([], { disableMenus: ["/a/*"] });
            expect(menus).toHaveLength(1);
            expect(menus[0]?.path).toBe("/b");
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("disableMenus 规则不合法应阻断启动", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-disableMenus-invalid-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(menusJsonPath, JSON.stringify([{ name: "A", path: "/a", sort: 1 }], null, 4), { encoding: "utf8" });

            for (const rule of ["a", "*"]) {
                let thrown: any = null;
                try {
                    await checkMenu([], { disableMenus: [rule] });
                } catch (error: any) {
                    thrown = error;
                }

                expect(thrown).toBeTruthy();
                expect(typeof thrown.message).toBe("string");
                expect(thrown.message.includes("disableMenus")).toBe(true);
            }
        } finally {
            process.chdir(originalCwd);
            rmSync(projectDir, { recursive: true, force: true });
        }
    });

    test("默认应屏蔽 /404 /403 /500 /login /addon/admin/login 菜单路由", async () => {
        const originalCwd = process.cwd();
        const projectDir = join(originalCwd, "temp", `checkMenu-default-disable-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const menusJsonPath = join(projectDir, "menus.json");

        try {
            mkdirSync(projectDir, { recursive: true });
            process.chdir(projectDir);

            writeFileSync(
                menusJsonPath,
                JSON.stringify(
                    [
                        { name: "Login", path: "/login", sort: 1 },
                        { name: "AddonLogin", path: "/addon/admin/login", sort: 2 },
                        { name: "404", path: "/404", sort: 3 },
                        { name: "403", path: "/403", sort: 4 },
                        { name: "500", path: "/500", sort: 5 },
                        { name: "A", path: "/a", sort: 6 }
                    ],
                    null,
                    4
                ),
                { encoding: "utf8" }
            );

            const menus = await checkMenu([], { disableMenus: beflyConfig.disableMenus || [] });
            expect(Array.isArray(menus)).toBe(true);
            expect(menus).toHaveLength(1);
            expect(menus[0]?.path).toBe("/a");
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
