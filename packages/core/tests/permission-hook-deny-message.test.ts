import { describe, expect, test } from "bun:test";

import permissionHook from "../hooks/permission.ts";

describe("permission hook - deny message", () => {
    test("应优先使用 ctx.api.name 作为接口标识", async () => {
        const befly = {
            redis: {
                sismember: async () => {
                    return false;
                }
            }
        } as any;

        const ctx = {
            api: {
                auth: true,
                name: "用户登录"
            },
            route: "/api/user/login",
            user: {
                id: 1,
                roleCode: "user"
            },
            requestId: "rid_1",
            corsHeaders: {}
        } as any;

        await permissionHook.handler(befly, ctx);

        expect(ctx.response).toBeTruthy();

        const body = await ctx.response.json();
        expect(body.msg).toBe("无权访问 用户登录 接口");
        expect(body.detail).toEqual({ apiLabel: "用户登录" });
    });

    test("ctx.api.name 缺失时应回退到 ctx.route", async () => {
        const befly = {
            redis: {
                sismember: async () => {
                    return false;
                }
            }
        } as any;

        const ctx = {
            api: {
                auth: true,
                name: ""
            },
            route: "/api/user/login",
            user: {
                id: 1,
                roleCode: "user"
            },
            requestId: "rid_2",
            corsHeaders: {}
        } as any;

        await permissionHook.handler(befly, ctx);

        const body = await ctx.response.json();
        expect(body.msg).toBe("无权访问 /api/user/login 接口");
        expect(body.detail).toEqual({ apiLabel: "/api/user/login" });
    });

    test("ctx.api.name 与 ctx.route 都缺失时应回退到 未知接口", async () => {
        const befly = {
            redis: {
                sismember: async () => {
                    return false;
                }
            }
        } as any;

        const ctx = {
            api: {
                auth: true,
                name: ""
            },
            route: "",
            user: {
                id: 1,
                roleCode: "user"
            },
            requestId: "rid_3",
            corsHeaders: {}
        } as any;

        await permissionHook.handler(befly, ctx);

        const body = await ctx.response.json();
        expect(body.msg).toBe("无权访问 未知接口 接口");
        expect(body.detail).toEqual({ apiLabel: "未知接口" });
    });
});
