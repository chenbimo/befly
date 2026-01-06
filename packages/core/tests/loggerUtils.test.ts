import { describe, test, expect } from "bun:test";

import { buildSensitiveKeyMatcher, sanitizeLogObject } from "../utils/loggerUtils";

describe("loggerUtils", () => {
    test("sanitizeLogObject: 应遮蔽敏感字段", () => {
        const matcher = buildSensitiveKeyMatcher({ builtinPatterns: ["password", "*token*"], userPatterns: [] });

        const out = sanitizeLogObject(
            {
                password: "123456",
                accessToken: "abc",
                nested: { refresh_token: "def" },
                ok: "yes"
            },
            {
                maxStringLen: 100,
                maxArrayItems: 100,
                sanitizeDepth: 3,
                sanitizeNodes: 500,
                sanitizeObjectKeys: 100,
                sensitiveKeyMatcher: matcher
            }
        );

        expect(out.password).toBe("[MASKED]");
        expect(out.accessToken).toBe("[MASKED]");
        expect(out.ok).toBe("yes");
    });

    test("sanitizeLogObject: 嵌套对象与数组中的敏感字段也应遮蔽", () => {
        const matcher = buildSensitiveKeyMatcher({ builtinPatterns: ["*token*", "authorization"], userPatterns: [] });

        const out = sanitizeLogObject(
            {
                nested: {
                    refreshToken: "r",
                    ok: "ok"
                },
                items: [{ authorization: "bearer xxx", ok: 1 }]
            },
            {
                maxStringLen: 100,
                maxArrayItems: 100,
                sanitizeDepth: 5,
                sanitizeNodes: 500,
                sanitizeObjectKeys: 100,
                sensitiveKeyMatcher: matcher
            }
        );

        expect((out as any).nested.refreshToken).toBe("[MASKED]");
        expect((out as any).nested.ok).toBe("ok");
        expect((out as any).items[0].authorization).toBe("[MASKED]");
        expect((out as any).items[0].ok).toBe(1);
    });

    test("sanitizeLogObject: 达到 sanitizeDepth 后应降级为字符串预览", () => {
        const matcher = buildSensitiveKeyMatcher({ builtinPatterns: [], userPatterns: [] });

        const out = sanitizeLogObject(
            {
                a: { b: { c: { d: { e: 1 } } } }
            },
            {
                maxStringLen: 100,
                maxArrayItems: 100,
                sanitizeDepth: 2,
                sanitizeNodes: 500,
                sanitizeObjectKeys: 100,
                sensitiveKeyMatcher: matcher
            }
        );

        expect(typeof (out as any).a).toBe("object");
        expect(typeof (out as any).a.b).toBe("object");
        expect(typeof (out as any).a.b.c).toBe("string");
    });
});
