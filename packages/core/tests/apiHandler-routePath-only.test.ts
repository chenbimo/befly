import { describe, expect, test } from "bun:test";

import { apiHandler } from "../router/api.ts";

describe("apiHandler - route matching", () => {
    test("接口存在性判断应仅使用 url.pathname（不附加 method）", async () => {
        const apis = new Map<string, any>();

        apis.set("/api/hello", {
            name: "hello",
            method: "POST",
            handler: async () => {
                return {
                    msg: "ok"
                };
            }
        });

        const hooks: any[] = [];
        const context: any = {};

        const handler = apiHandler(apis as any, hooks as any, context as any);

        // 如果 key 里拼了 method，这里会变成 "POST /api/hello" 之类，从而导致接口不存在
        const res = await handler(new Request("http://localhost/api/hello", { method: "POST" }));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.code).toBe(0);
        expect(body.msg).toBe("ok");
    });
});
