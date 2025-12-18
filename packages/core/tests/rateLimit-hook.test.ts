import { describe, expect, test, afterEach } from "bun:test";

import { beflyConfig } from "../befly.config.js";
import rateLimitHook from "../hooks/rateLimit.js";

type MockBefly = {
    redis?: {
        incrWithExpire: (key: string, seconds: number) => Promise<number>;
    };
};

type MockCtx = {
    api: { name: string };
    req: Request;
    route: string;
    ip: string;
    user: Record<string, any>;
    requestId: string;
    corsHeaders: Record<string, string>;
    response?: Response;
};

const originalRateLimitConfigJson = JSON.stringify(beflyConfig.rateLimit);

afterEach(() => {
    beflyConfig.rateLimit = JSON.parse(originalRateLimitConfigJson);
});

describe("hook - rateLimit", () => {
    test("命中规则：未超限不拦截，超限后拦截", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "/api/auth/*",
                    limit: 2,
                    window: 60,
                    key: "ip"
                }
            ]
        };

        let counter = 0;
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async () => {
                    counter += 1;
                    return counter;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "login" },
            req: new Request("http://localhost/api/auth/login", { method: "POST" }),
            route: "POST/api/auth/login",
            ip: "1.1.1.1",
            user: { id: 123 },
            requestId: "rid_rate_1",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeInstanceOf(Response);

        const payload = await (ctx.response as Response).json();
        expect(payload).toEqual({
            code: 1,
            msg: "请求过于频繁，请稍后再试",
            data: null,
            detail: {
                limit: 2,
                window: 60
            }
        });
    });

    test("key 维度为 user：counterKey 包含用户 id", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "*",
                    limit: 10,
                    window: 60,
                    key: "user"
                }
            ]
        };

        let lastKey = "";
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async (key) => {
                    lastKey = key;
                    return 1;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "x" },
            req: new Request("http://localhost/api/user/profile", { method: "POST" }),
            route: "POST/api/user/profile",
            ip: "2.2.2.2",
            user: { id: 9 },
            requestId: "rid_rate_2",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);

        expect(lastKey.includes(":user:9")).toBe(true);
        expect(lastKey.startsWith("rate_limit:POST/api/user/profile:")).toBe(true);
    });

    test("key 维度为 ip_user：counterKey 同时包含 ip 与用户 id", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "*",
                    limit: 10,
                    window: 60,
                    key: "ip_user"
                }
            ]
        };

        let lastKey = "";
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async (key) => {
                    lastKey = key;
                    return 1;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "x" },
            req: new Request("http://localhost/api/user/profile", { method: "POST" }),
            route: "POST/api/user/profile",
            ip: "2.2.2.2",
            user: { id: 9 },
            requestId: "rid_rate_2_ip_user",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);

        expect(lastKey.includes("ip:2.2.2.2:user:9")).toBe(true);
        expect(lastKey.startsWith("rate_limit:POST/api/user/profile:")).toBe(true);
    });

    test("规则优先级：精确规则优先于通配与前缀", async () => {
        // 特意把更宽泛的规则放在前面，验证实现会优先选择更具体的规则
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "*",
                    limit: 1,
                    window: 60,
                    key: "ip"
                },
                {
                    route: "/api/auth/*",
                    limit: 1,
                    window: 60,
                    key: "ip"
                },
                {
                    route: "POST/api/auth/login",
                    limit: 100,
                    window: 60,
                    key: "ip"
                }
            ]
        };

        let counter = 0;
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async () => {
                    counter += 1;
                    return counter;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "login" },
            req: new Request("http://localhost/api/auth/login", { method: "POST" }),
            route: "POST/api/auth/login",
            ip: "8.8.8.8",
            user: {},
            requestId: "rid_rate_priority_1",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();
    });

    test("key=user 且缺失 userId 时回退为按 IP 计数", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "*",
                    limit: 10,
                    window: 60,
                    key: "user"
                }
            ]
        };

        let lastKey = "";
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async (key) => {
                    lastKey = key;
                    return 1;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "x" },
            req: new Request("http://localhost/api/user/profile", { method: "POST" }),
            route: "POST/api/user/profile",
            ip: "6.6.6.6",
            user: {},
            requestId: "rid_rate_user_fallback_ip",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);

        expect(lastKey.includes("ip:6.6.6.6")).toBe(true);
        expect(lastKey.includes("anonymous")).toBe(false);
    });

    test("key=user：userId=0 不应被当作缺失", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "*",
                    limit: 10,
                    window: 60,
                    key: "user"
                }
            ]
        };

        let lastKey = "";
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async (key) => {
                    lastKey = key;
                    return 1;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "x" },
            req: new Request("http://localhost/api/user/profile", { method: "POST" }),
            route: "POST/api/user/profile",
            ip: "7.7.7.7",
            user: { id: 0 },
            requestId: "rid_rate_user_id_zero",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(lastKey.includes(":user:0")).toBe(true);
    });

    test("skipRoutes：命中后不计数也不拦截", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 1,
            defaultWindow: 60,
            key: "ip",
            skipRoutes: ["/api/health"],
            rules: []
        };

        let called = 0;
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async () => {
                    called += 1;
                    return 999;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "health" },
            req: new Request("http://localhost/api/health", { method: "POST" }),
            route: "POST/api/health",
            ip: "9.9.9.9",
            user: {},
            requestId: "rid_rate_skip_1",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        await rateLimitHook.handler(befly as any, ctx as any);

        expect(called).toBe(0);
        expect(ctx.response).toBeUndefined();
    });

    test("route 匹配：支持 METHOD/api 前缀与精确匹配", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "POST/api/auth/*",
                    limit: 1,
                    window: 60,
                    key: "ip"
                },
                {
                    route: "POST/api/user/profile",
                    limit: 1,
                    window: 60,
                    key: "ip"
                }
            ]
        };

        const keys: string[] = [];
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async (key) => {
                    keys.push(key);
                    return 1;
                }
            }
        };

        const ctx1: MockCtx = {
            api: { name: "login" },
            req: new Request("http://localhost/api/auth/login", { method: "POST" }),
            route: "POST/api/auth/login",
            ip: "4.4.4.4",
            user: {},
            requestId: "rid_rate_match_1",
            corsHeaders: {}
        };

        const ctx2: MockCtx = {
            api: { name: "profile" },
            req: new Request("http://localhost/api/user/profile", { method: "POST" }),
            route: "POST/api/user/profile",
            ip: "4.4.4.4",
            user: {},
            requestId: "rid_rate_match_2",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx1 as any);
        await rateLimitHook.handler(befly as any, ctx2 as any);

        expect(keys.length).toBe(2);
        expect(keys[0].startsWith("rate_limit:POST/api/auth/login:")).toBe(true);
        expect(keys[1].startsWith("rate_limit:POST/api/user/profile:")).toBe(true);
    });

    test("OPTIONS 请求不计数也不拦截", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 1,
            defaultWindow: 60,
            key: "ip",
            rules: []
        };

        let called = 0;
        const befly: MockBefly = {
            redis: {
                incrWithExpire: async () => {
                    called += 1;
                    return 999;
                }
            }
        };

        const ctx: MockCtx = {
            api: { name: "opt" },
            req: new Request("http://localhost/api/user/profile", { method: "OPTIONS" }),
            route: "OPTIONS/api/user/profile",
            ip: "5.5.5.5",
            user: {},
            requestId: "rid_rate_options",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(called).toBe(0);
        expect(ctx.response).toBeUndefined();
    });

    test("无 redis 时降级为内存计数", async () => {
        beflyConfig.rateLimit = {
            enable: 1,
            defaultLimit: 0,
            defaultWindow: 0,
            key: "ip",
            rules: [
                {
                    route: "POST/api/test/memory",
                    limit: 2,
                    window: 60,
                    key: "ip"
                }
            ]
        };

        const befly: MockBefly = {};

        const ctx: MockCtx = {
            api: { name: "mem" },
            req: new Request("http://localhost/api/test/memory", { method: "POST" }),
            route: "POST/api/test/memory",
            ip: "3.3.3.3",
            user: {},
            requestId: "rid_rate_3",
            corsHeaders: {}
        };

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeUndefined();

        await rateLimitHook.handler(befly as any, ctx as any);
        expect(ctx.response).toBeInstanceOf(Response);
    });
});
