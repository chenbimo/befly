import { describe, expect, test } from "bun:test";

import { ErrorResponse, FinalResponse } from "../utils/response";

function createCtx(overrides: any = {}): any {
    return {
        corsHeaders: {
            "x-test": "1",
            "x-cors": "cors"
        },
        requestId: "req_1",
        api: {
            name: "hello"
        },
        response: undefined,
        result: undefined,
        ...overrides
    };
}

describe("utils - ErrorResponse", () => {
    test("should return json with ctx headers", async () => {
        const ctx = createCtx();
        const res = ErrorResponse(ctx, "bad", 123, { a: 1 }, { field: "x" }, "reason_1");

        expect(res.headers.get("x-test")).toBe("1");
        const body = await res.json();
        expect(body).toEqual({
            code: 123,
            msg: "bad",
            data: { a: 1 },
            detail: { field: "x" }
        });
    });
});

describe("utils - FinalResponse", () => {
    test("should return ctx.response if already set", async () => {
        const direct = new Response("ok", { headers: { "x-test": "2" } });
        const ctx = createCtx({ response: direct });
        const res = FinalResponse(ctx);
        expect(res).toBe(direct);
        expect(res.headers.get("x-test")).toBe("2");
        // ctx.response 分支：不自动合并 ctx.corsHeaders
        expect(res.headers.get("x-cors")).toBeNull();
    });

    test("string result should wrap to {code:0,msg}", async () => {
        const ctx = createCtx({ result: "hello" });
        const res = FinalResponse(ctx);
        expect(res.headers.get("x-test")).toBe("1");
        const body = await res.json();
        expect(body).toEqual({ code: 0, msg: "hello" });
    });

    test("object result without code should add code=0", async () => {
        const ctx = createCtx({ result: { msg: "ok", data: { x: 1 } } });
        const res = FinalResponse(ctx);
        const body = await res.json();
        expect(body).toEqual({ code: 0, msg: "ok", data: { x: 1 } });
    });

    test("object result with BigInt should serialize to string and set content-type", async () => {
        const ctx = createCtx({ result: { code: 0, id: 1n, nested: { v: 2n } } });
        const res = FinalResponse(ctx);

        expect(res.headers.get("Content-Type")).toBe("application/json");
        expect(res.headers.get("x-test")).toBe("1");

        const text = await res.text();
        expect(text).toContain('"id":"1"');
        expect(text).toContain('"v":"2"');

        const json = JSON.parse(text);
        expect(json.id).toBe("1");
        expect(json.nested.v).toBe("2");
    });

    test("object result should override Content-Type from corsHeaders", async () => {
        const ctx = createCtx({ corsHeaders: { "x-test": "1", "Content-Type": "text/plain" }, result: { code: 0, msg: "ok" } });
        const res = FinalResponse(ctx);

        // object 分支使用 new Response + 手动设置 Content-Type=application/json
        expect(res.headers.get("Content-Type")).toBe("application/json");
        expect(res.headers.get("x-test")).toBe("1");
    });

    test("no result and no response should return default error json", async () => {
        const ctx = createCtx({ result: undefined, response: undefined });
        const res = FinalResponse(ctx);
        const body = await res.json();
        expect(body.code).toBe(1);
        expect(body.msg).toBe("未生成响应");
    });
});
