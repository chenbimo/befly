import { describe, expect, test } from "bun:test";

import { syncApi } from "../sync/syncApi.js";
import { syncDev } from "../sync/syncDev.js";
import { syncMenu } from "../sync/syncMenu.js";

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

    test("syncDev: ctx.db 缺失时应给出明确错误", async () => {
        const ctx = {} as any;

        let error: any = null;
        try {
            await syncDev(ctx);
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("syncDev: ctx.db 未初始化（Db 插件未加载或注入失败）");
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
});
