import type { MenuConfig } from "../types/sync";

import { describe, expect, test } from "bun:test";

import { __test__ } from "../sync/syncMenu.ts";

describe("syncMenu - parentPath derived from tree", () => {
    test("根级菜单不应强制按 URL path 推导 parentPath（避免把同级菜单挂到首页下面）", () => {
        const mergedMenus: MenuConfig[] = [
            {
                name: "首页",
                path: "/addon/admin",
                sort: 1
            },
            {
                name: "日志管理",
                path: "/addon/admin/log",
                sort: 40
            },
            {
                name: "配置管理",
                path: "/addon/admin/config",
                sort: 30
            }
        ];

        const map = __test__.flattenMenusToDefMap(mergedMenus);

        expect(map.get("/addon/admin")?.parentPath).toBe("");
        expect(map.get("/addon/admin/log")?.parentPath).toBe("");
        expect(map.get("/addon/admin/config")?.parentPath).toBe("");
    });

    test("子菜单应跟随 children 嵌套关系设置 parentPath", () => {
        const mergedMenus: MenuConfig[] = [
            {
                name: "日志管理",
                path: "/addon/admin/log",
                sort: 40,
                children: [
                    {
                        name: "登录日志",
                        path: "/addon/admin/log/login",
                        sort: 1
                    }
                ]
            }
        ];

        const map = __test__.flattenMenusToDefMap(mergedMenus);

        expect(map.get("/addon/admin/log")?.parentPath).toBe("");
        expect(map.get("/addon/admin/log/login")?.parentPath).toBe("/addon/admin/log");
    });

    test("显式 parentPath（包括空字符串）优先生效", () => {
        const mergedMenus: MenuConfig[] = [
            {
                name: "自定义根",
                path: "/x",
                parentPath: "/custom",
                sort: 1
            },
            {
                name: "显式根",
                path: "/y",
                parentPath: "",
                sort: 2
            }
        ];

        const map = __test__.flattenMenusToDefMap(mergedMenus);

        expect(map.get("/x")?.parentPath).toBe("/custom");
        expect(map.get("/y")?.parentPath).toBe("");
    });
});
