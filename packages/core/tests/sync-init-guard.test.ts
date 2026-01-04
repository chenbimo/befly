import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.ts";
import { syncDev } from "../sync/syncDev.ts";
import { syncMenu } from "../sync/syncMenu.ts";

describe("sync - init guard", () => {
    test("syncApi: ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncApi(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncApi: ctx.db 未初始化（Db 插件未加载或注入失败）");
    });

    test("syncApi: ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncApi(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncApi: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    });

    test("syncDev: ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncDev(ctx, { devEmail: "dev@qq.com", devPassword: "dev-password" });
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncDev: ctx.db 未初始化（Db 插件未加载或注入失败）");
    });

    test("syncDev: ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncDev(ctx, { devEmail: "dev@qq.com", devPassword: "dev-password" });
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncDev: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    });

    test("syncMenu: ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncMenu: ctx.db 未初始化（Db 插件未加载或注入失败）");
    });

    test("syncMenu: ctx.cache 缺失时应给出明确错误", async () => {
        const ctx = { db: {} } as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncMenu: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    });

    test("syncMenu: ctx.config 缺失时应给出明确错误", async () => {
        const ctx = { db: {}, cache: {} } as any;

        let error: any = null;
        try {
            await syncMenu(ctx, [] as any);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncMenu: ctx.config 未初始化（config 插件未加载或注入失败）");
    });
});
