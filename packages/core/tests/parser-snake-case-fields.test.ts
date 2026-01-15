import { describe, expect, test } from "bun:test";

import validatorHook from "../hooks/validator";

describe("validator hook - snake_case fields", () => {
    test("snake_case 入参能映射到 fields 的 camelCase key（0 应保留）", async () => {
        const ctx: any = {
            api: {
                fields: {
                    agentId: { name: "上级ID", type: "bigint", input: "number", min: 0, max: null }
                },
                required: ["agentId"]
            },
            body: { agent_id: 0 }
        };

        await (validatorHook as any).handler(null, ctx);

        expect(ctx.body.agentId).toBe(0);
        expect((ctx.body as any).agent_id).toBeUndefined();
        expect(ctx.response).toBeUndefined();
    });

    test("camelCase 与 snake_case 同时存在时优先 camelCase", async () => {
        const ctx: any = {
            api: {
                fields: {
                    agentId: { name: "上级ID", type: "bigint", input: "number", min: 0, max: null }
                },
                required: ["agentId"]
            },
            body: { agentId: 1, agent_id: 0 }
        };

        await (validatorHook as any).handler(null, ctx);

        expect(ctx.body.agentId).toBe(1);
        expect((ctx.body as any).agent_id).toBeUndefined();
        expect(ctx.response).toBeUndefined();
    });

    test("空字符串为已传值：required 不应报必填", async () => {
        const ctx: any = {
            api: {
                fields: {
                    name: { name: "名称", type: "varchar", input: "string", min: 0, max: 20 }
                },
                required: ["name"]
            },
            body: { name: "" }
        };

        await (validatorHook as any).handler(null, ctx);

        expect(ctx.body.name).toBe("");
        expect(ctx.response).toBeUndefined();
    });
});
