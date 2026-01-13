import { describe, expect, test } from "bun:test";

import { Befly } from "../index";

describe("Befly.start - missing ctx guard", () => {
    test("启动期 ctx 缺失时应合并缺失项并给出简短指引", () => {
        const app = new Befly();

        app.context = {};

        let error: any = null;
        try {
            (app as any).assertStartContextReady();
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("启动失败：ctx.redis、ctx.db、ctx.cache 未初始化。请检查插件加载与注入顺序。");
    });

    test("启动期仅部分 ctx 缺失时应只列出缺失项", () => {
        const app = new Befly();

        app.context = { db: {} } as any;

        let error: any = null;
        try {
            (app as any).assertStartContextReady();
        } catch (err: any) {
            error = err;
        }

        expect(typeof error?.message).toBe("string");
        expect(error.message).toBe("启动失败：ctx.redis、ctx.cache 未初始化。请检查插件加载与注入顺序。");
    });
});
