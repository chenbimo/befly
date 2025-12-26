import { describe, expect, test } from "bun:test";

import { checkApi } from "../checks/checkApi.js";

describe("checkApi - routePath strict", () => {
    test("合法 routePath 应通过", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => {
                        return null;
                    },
                    routePath: "/api/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeNull();
    });

    test("routePath 为空字符串应阻断启动", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 非字符串应阻断启动", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: 123,
                    routePrefix: "/app"
                } as any
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 不允许 method 前缀（POST/api/...）", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "POST/api/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 不允许 method + 空格（POST /api/...）", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "POST /api/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 必须以 /api/ 开头", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "/app/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 不允许包含空格", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "/api/hello world",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("routePath 不允许出现 /api//（重复斜杠）", async () => {
        let thrown: any = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    routePath: "/api//hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: any) {
            thrown = error;
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });
});
