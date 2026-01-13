import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.ts";
import { syncDev } from "../sync/syncDev.ts";
import { syncMenu } from "../sync/syncMenu.ts";

describe("sync - init guard", () => {
    test("同步接口：ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncApi(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步接口：ctx.db 未初始化");
    });

    test("同步接口：ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncApi(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步接口：ctx.cache 未初始化");
    });

    test("同步开发：ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncDev(ctx, { devEmail: "dev@qq.com", devPassword: "dev-password" });
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步开发：ctx.db 未初始化");
    });

    test("同步开发：ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncDev(ctx, { devEmail: "dev@qq.com", devPassword: "dev-password" });
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步开发：ctx.cache 未初始化");
    });

    test("同步菜单：ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步菜单：ctx.db 未初始化");
    });

    test("同步菜单：ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步菜单：ctx.cache 未初始化");
    });

    test("同步菜单：ctx.config 缺失时应给出明确错误", async () => {
        const ctx = { db: {}, cache: {} } as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("同步菜单：ctx.config 未初始化");
    });
});
