import { describe, expect, test } from "bun:test";

import { Layouts } from "../index.browser.js";

describe("befly-vite Layouts (browser)", () => {
    test("参数校验：routes 不是数组应抛错", () => {
        expect(() => Layouts(null as any, (() => null) as any)).toThrow();
        expect(() => Layouts({} as any, (() => null) as any)).toThrow();
    });

    test("参数校验：resolveLayoutComponent 不是函数应抛错", () => {
        expect(() => Layouts([], null as any)).toThrow();
        expect(() => Layouts([], "x" as any)).toThrow();
    });

    test("默认行为：无后缀且无继承时使用 default 布局", () => {
        const calls: string[] = [];
        const result = Layouts(
            [
                {
                    path: "a",
                    component: "PageA"
                }
            ],
            (layoutName) => {
                calls.push(layoutName);
                return `Layout:${layoutName}`;
            }
        );

        expect(calls).toEqual(["default"]);
        expect(result).toHaveLength(1);
        expect(result[0]?.path).toBe("a");
        expect(result[0]?.component).toBe("Layout:default");
        expect(result[0]?.children?.[0]?.path).toBe("");
        expect(result[0]?.children?.[0]?.component).toBe("PageA");
    });

    test("后缀布局：a_2 应使用 layoutName=2 且 path 去掉 _2", () => {
        const calls: string[] = [];
        const result = Layouts(
            [
                {
                    path: "a_2",
                    component: "PageA2"
                }
            ],
            (layoutName) => {
                calls.push(layoutName);
                return `Layout:${layoutName}`;
            }
        );

        expect(calls).toEqual(["2"]);
        expect(result[0]?.path).toBe("a");
        expect(result[0]?.component).toBe("Layout:2");
        expect(result[0]?.children?.[0]?.component).toBe("PageA2");
    });

    test("index 规则：index -> path='' 且 layout=default；index_2 -> path='' 且 layout=2", () => {
        const calls: string[] = [];
        const result = Layouts(
            [
                { path: "index", component: "PageIndex" },
                { path: "index_2", component: "PageIndex2" }
            ],
            (layoutName) => {
                calls.push(layoutName);
                return `Layout:${layoutName}`;
            }
        );

        expect(calls).toEqual(["default", "2"]);
        expect(result).toHaveLength(2);
        expect(result[0]?.path).toBe("");
        expect(result[0]?.children?.[0]?.component).toBe("PageIndex");
        expect(result[1]?.path).toBe("");
        expect(result[1]?.children?.[0]?.component).toBe("PageIndex2");
    });

    test("父级后缀继承：p_3 的子页面 c 应继承 layout=3，且路径合并为 p/c", () => {
        const calls: string[] = [];
        const result = Layouts(
            [
                {
                    path: "p_3",
                    children: [
                        {
                            path: "c",
                            component: "PageC",
                            meta: { title: "C" }
                        }
                    ]
                }
            ],
            (layoutName) => {
                calls.push(layoutName);
                return `Layout:${layoutName}`;
            }
        );

        expect(calls).toEqual(["3"]);
        expect(result).toHaveLength(1);
        expect(result[0]?.path).toBe("p/c");
        expect(result[0]?.component).toBe("Layout:3");
        expect(result[0]?.meta).toEqual({ title: "C" });
        expect(result[0]?.children?.[0]?.path).toBe("");
        expect(result[0]?.children?.[0]?.component).toBe("PageC");
    });

    test("父级后缀继承 + index：p_3 下的 index 生成 p/（保留当前实现行为）", () => {
        const result = Layouts(
            [
                {
                    path: "p_3",
                    children: [
                        {
                            path: "index",
                            component: "PageIndex"
                        }
                    ]
                }
            ],
            (layoutName) => {
                return `Layout:${layoutName}`;
            }
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.path).toBe("p/");
        expect(result[0]?.children?.[0]?.component).toBe("PageIndex");
    });

    test("多叶子节点：resolver 调用次数应等于叶子数量", () => {
        let callCount = 0;
        const result = Layouts(
            [
                { path: "a_1", component: "A" },
                { path: "b_2", component: "B" },
                {
                    path: "p_3",
                    children: [
                        { path: "c", component: "C" },
                        { path: "d_9", component: "D" }
                    ]
                }
            ],
            (layoutName) => {
                callCount += 1;
                return `Layout:${layoutName}`;
            }
        );

        expect(callCount).toBe(4);
        expect(result.map((r) => r.path)).toEqual(["a", "b", "p/c", "p/d"]);
    });

    test("复杂嵌套：多兄弟节点的输出结构应稳定", () => {
        const calls: string[] = [];
        const result = Layouts(
            [
                {
                    path: "app_2",
                    children: [
                        { path: "users", component: "Users", meta: { title: "Users" } },
                        { path: "roles_5", component: "Roles", meta: { title: "Roles" } },
                        {
                            path: "settings",
                            children: [
                                { path: "profile", component: "Profile", meta: { title: "Profile" } },
                                { path: "security_9", component: "Security", meta: { title: "Security" } }
                            ]
                        }
                    ]
                },
                {
                    path: "public",
                    children: [
                        { path: "home", component: "Home", meta: { title: "Home" } },
                        { path: "about_3", component: "About", meta: { title: "About" } }
                    ]
                }
            ],
            (layoutName) => {
                calls.push(layoutName);
                return `Layout:${layoutName}`;
            }
        );

        // 叶子节点顺序应稳定（深度优先，按输入顺序遍历）
        expect(calls).toEqual(["2", "5", "2", "9", "default", "3"]);
        expect(result.map((r) => r.path)).toEqual(["app/users", "app/roles", "app/settings/profile", "app/settings/security", "public/home", "public/about"]);

        // 输出应为 layout 包裹 page：layout route 的 children[0] 为 page route 且 path=''。
        expect(result[0]?.component).toBe("Layout:2");
        expect(result[0]?.meta).toEqual({ title: "Users" });
        expect(result[0]?.children?.[0]?.path).toBe("");
        expect(result[0]?.children?.[0]?.component).toBe("Users");

        expect(result[1]?.component).toBe("Layout:5");
        expect(result[1]?.meta).toEqual({ title: "Roles" });
        expect(result[1]?.children?.[0]?.path).toBe("");
        expect(result[1]?.children?.[0]?.component).toBe("Roles");

        expect(result[3]?.component).toBe("Layout:9");
        expect(result[3]?.meta).toEqual({ title: "Security" });
        expect(result[3]?.children?.[0]?.path).toBe("");
        expect(result[3]?.children?.[0]?.component).toBe("Security");

        expect(result[4]?.component).toBe("Layout:default");
        expect(result[4]?.meta).toEqual({ title: "Home" });
        expect(result[4]?.children?.[0]?.component).toBe("Home");
    });
});
