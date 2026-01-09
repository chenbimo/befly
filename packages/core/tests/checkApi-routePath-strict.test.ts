import { describe, expect, test } from "bun:test";

import { checkApi } from "../checks/checkApi.ts";

describe("checkApi - path strict", () => {
    test("合法 path 应通过", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => {
                        return null;
                    },
                    path: "/api/app/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeNull();
    });

    test("path 为空字符串应阻断启动", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 非字符串应阻断启动", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: 123,
                    routePrefix: "/app"
                } as any
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 不允许 method 前缀（POST/api/...）", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "POST/api/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 不允许 method + 空格（POST /api/...）", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "POST /api/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 必须以 /api/ 开头", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "/app/hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 不允许包含空格", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "/api/hello world",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });

    test("path 不允许出现 /api//（重复斜杠）", async () => {
        let thrown: Error | null = null;

        try {
            await checkApi([
                {
                    name: "hello",
                    handler: () => null,
                    path: "/api//hello",
                    routePrefix: "/app"
                }
            ]);
        } catch (error: unknown) {
            thrown = error instanceof Error ? error : new Error(String(error));
        }

        expect(thrown).toBeTruthy();
        expect(thrown.message).toBe("接口结构检查失败");
    });
});
