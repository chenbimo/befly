import { describe, expect, test } from "bun:test";

import { loadPlugins } from "../loader/loadPlugins.ts";

describe("loadPlugins - order smoke", () => {
    test("deps 应确保 redis 在 db/cache 之前初始化", async () => {
        const executed: string[] = [];
        const ctx: any = {};

        const plugins: any[] = [
            {
                moduleName: "db",
                deps: ["logger", "redis"],
                handler: async (befly: any) => {
                    executed.push("db");

                    if (!befly.redis) {
                        throw new Error("db handler called before redis");
                    }

                    return { ok: true };
                }
            },
            {
                moduleName: "cache",
                deps: ["logger", "redis", "db"],
                handler: async (befly: any) => {
                    executed.push("cache");

                    if (!befly.redis) {
                        throw new Error("cache handler called before redis");
                    }

                    if (!befly.db) {
                        throw new Error("cache handler called before db");
                    }

                    return { ok: true };
                }
            },
            {
                moduleName: "redis",
                deps: ["logger"],
                handler: async (_befly: any) => {
                    executed.push("redis");
                    return { ok: true };
                }
            },
            {
                moduleName: "logger",
                deps: [],
                handler: async (_befly: any) => {
                    executed.push("logger");
                    return { ok: true };
                }
            }
        ];

        await loadPlugins(plugins as any, ctx as any);

        const loggerIndex = executed.indexOf("logger");
        const redisIndex = executed.indexOf("redis");
        const dbIndex = executed.indexOf("db");
        const cacheIndex = executed.indexOf("cache");

        expect(loggerIndex).toBeGreaterThanOrEqual(0);
        expect(redisIndex).toBeGreaterThanOrEqual(0);
        expect(dbIndex).toBeGreaterThanOrEqual(0);
        expect(cacheIndex).toBeGreaterThanOrEqual(0);

        expect(loggerIndex).toBeLessThan(redisIndex);
        expect(redisIndex).toBeLessThan(dbIndex);
        expect(dbIndex).toBeLessThan(cacheIndex);
    });
});
