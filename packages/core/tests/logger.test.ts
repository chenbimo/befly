import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { withCtx } from "../lib/asyncContext";
import { Logger } from "../lib/logger";
import { formatYmdHms } from "../utils/formatYmdHms.ts";

const testLogDir = join(process.cwd(), "temp", "test-logs");

beforeAll(() => {
    if (!existsSync(testLogDir)) {
        mkdirSync(testLogDir, { recursive: true });
    }
    Logger.configure({
        dir: testLogDir,
        console: 0,
        debug: 1,
        excludeFields: ["*Secret", "*nick*"]
    });
});

afterAll(async () => {
    // 延迟清理，等待异步写入完成（避免 Windows 下句柄占用导致 rmSync 失败）
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 尽可能关闭 transport，避免后台 worker/句柄影响后续测试或清理
    await Logger.shutdown();

    if (existsSync(testLogDir)) {
        rmSync(testLogDir, { recursive: true, force: true });
    }
});

describe("Logger - 纯字符串消息", () => {
    test("timeFormat 格式化函数：formatYmdHms 支持 date/time/dateTime 三种输出", () => {
        const date = new Date(1700000000000);

        const dateText = formatYmdHms(date, "date");
        expect(/^\d{4}-\d{2}-\d{2}$/.test(dateText)).toBe(true);

        const timeFormat = formatYmdHms(date, "time");
        expect(/^\d{2}:\d{2}:\d{2}$/.test(timeFormat)).toBe(true);

        const dateTimeText = formatYmdHms(date);
        expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeText)).toBe(true);

        expect(formatYmdHms(date, "dateTime")).toBe(dateTimeText);
    });

    test("info(msg)", () => {
        Logger.info("Test info message");
        expect(true).toBe(true);
    });

    test("warn(msg)", () => {
        Logger.warn("Test warning");
        expect(true).toBe(true);
    });

    test("error(msg)", () => {
        Logger.error("Test error");
        expect(true).toBe(true);
    });

    test("debug(msg)", () => {
        Logger.debug("Test debug");
        expect(true).toBe(true);
    });
});

describe("Logger - 对象 + msg 字段", () => {
    test("info(record)", () => {
        Logger.info({ userId: 1, action: "login", msg: "User action" });
        expect(true).toBe(true);
    });

    test("warn(record)", () => {
        Logger.warn({ ip: "127.0.0.1", count: 100, msg: "Rate limit warning" });
        expect(true).toBe(true);
    });

    test("error(record)", () => {
        const err = new Error("Something went wrong");
        Logger.error({ err: err, msg: "Request failed" });
        expect(true).toBe(true);
    });

    test("debug(record)", () => {
        Logger.debug({ key: "value", nested: { a: 1 }, msg: "Debug data" });
        expect(true).toBe(true);
    });
});

describe("Logger - 仅对象", () => {
    test("info(obj)", () => {
        Logger.info({ event: "startup", port: 3000 });
        expect(true).toBe(true);
    });

    test("warn(obj)", () => {
        Logger.warn({ type: "deprecation", feature: "oldApi" });
        expect(true).toBe(true);
    });

    test("error(obj)", () => {
        Logger.error({ code: 500, message: "Internal error" });
        expect(true).toBe(true);
    });

    test("debug(obj)", () => {
        Logger.debug({ query: "SELECT * FROM users", duration: 15 });
        expect(true).toBe(true);
    });
});

describe("Logger - AsyncLocalStorage 注入", () => {
    test("无 store 时不注入", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.setMock(mock);
        Logger.info({ foo: 1, msg: "hello" });
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        expect(calls[0].level).toBe("info");
        expect(calls[0].args[0]).toEqual({ foo: 1, msg: "hello" });
    });

    test("纯字符串消息会注入 meta", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_1",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 123,
                userId: 9,
                roleCode: "admin"
            },
            () => {
                Logger.info("hello");
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        expect(calls[0].args[0].requestId).toBe("rid_1");
        expect(calls[0].args[0].method).toBe("POST");
        expect(calls[0].args[0].route).toBe("/api/test");
        expect(calls[0].args[0].userId).toBe(9);
        expect(typeof calls[0].args[0].durationSinceNowMs).toBe("number");
        expect(calls[0].args[0].durationSinceNowMs).toBeGreaterThanOrEqual(0);
        expect(calls[0].args[0].msg).toBe("hello");
    });

    test("对象 + msg：meta 只补齐不覆盖", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_2",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 456
            },
            () => {
                Logger.info({ requestId: "explicit", foo: 1, msg: "m" });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        expect(calls[0].args[0].requestId).toBe("explicit");
        expect(calls[0].args[0].route).toBe("/api/test");
        expect(calls[0].args[0].foo).toBe(1);
        expect(calls[0].args[0].msg).toBe("m");
    });

    test("error(record) 会注入 meta", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_3",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 789
            },
            () => {
                const err = new Error("boom");
                Logger.error({ err: err, msg: "Redis getObject 错误" });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        expect(calls[0].args[0].requestId).toBe("rid_3");
        expect(calls[0].args[0].err.message).toBe("boom");
        expect(calls[0].args[0].msg).toBe("Redis getObject 错误");
    });

    test("对象裁剪：敏感 key 掩码 + 字符串截断 + 数组截断", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        const longStr = "x".repeat(150);
        const longArr: any[] = [];
        for (let i = 0; i < 130; i++) {
            longArr.push({ val: longStr, mySecret: "shouldMask" });
        }

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_trim",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    password: "p".repeat(200),
                    mySecret: "s".repeat(200),
                    nickname: "n".repeat(200),
                    normal: longStr,
                    nested: {
                        token: "t".repeat(200),
                        a: longStr,
                        deep: { b: longStr }
                    },
                    items: longArr,
                    okNumber: 123,
                    okBool: true,
                    msg: "trim"
                });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];
        expect(obj.password).toBe("[MASKED]");
        expect(obj.mySecret).toBe("[MASKED]");
        expect(obj.nickname).toBe("[MASKED]");
        expect(obj.normal.length).toBe(100);
        expect(obj.nested.token).toBe("[MASKED]");
        expect(obj.nested.a.length).toBe(100);
        expect(Array.isArray(obj.items)).toBe(true);
        expect(obj.items.length).toBe(100);
        expect(obj.items[0].val.length).toBe(100);
        expect(obj.items[0].mySecret).toBe("[MASKED]");
        expect(obj.okNumber).toBe(123);
        expect(obj.okBool).toBe(true);
        expect(obj.logTrimStats).toBeUndefined();
    });

    test("对象裁剪：最大深度限制时的字符串预览也应掩码敏感 key", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_depth",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    deep: {
                        a: {
                            b: {
                                c: {
                                    d: {
                                        password: "p",
                                        token: "t",
                                        ok: "v"
                                    }
                                }
                            }
                        }
                    },
                    msg: "depth"
                });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];
        // 注意：sanitizeValueLimited 是以 top-level 字段 deep 作为根节点开始计深度。
        // MAX_LOG_SANITIZE_DEPTH=3：deep(1) -> a(2) -> b(3)；此时 b 的子节点（c）会被降级为字符串预览。
        expect(typeof obj.deep.a.b.c).toBe("string");
        expect(obj.deep.a.b.c.includes("[MASKED]")).toBe(true);
        expect(obj.deep.a.b.c.includes('"password":"p"')).toBe(false);
        expect(obj.deep.a.b.c.includes('"token":"t"')).toBe(false);
    });

    test("对象裁剪：sanitizeDepth 配置应生效（更早降级）", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        // depth=2：deep(1) -> a(2)，因此 a 的子节点 b 会被降级为字符串预览
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 2
        });

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_depth2",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    deep: {
                        a: {
                            b: {
                                password: "p",
                                token: "t",
                                ok: "v"
                            }
                        }
                    },
                    msg: "depth2"
                });
            }
        );
        Logger.setMock(null);

        // 恢复默认配置（避免影响本文件后续用例）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 3
        });

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];
        expect(typeof obj.deep.a.b).toBe("string");
        expect(obj.deep.a.b.includes("[MASKED]")).toBe(true);
        expect(obj.deep.a.b.includes('"password":"p"')).toBe(false);
        expect(obj.deep.a.b.includes('"token":"t"')).toBe(false);
    });

    test("字符串截断：maxStringLen 配置应生效（sqlPreview 不应固定 100）", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            maxStringLen: 200
        });

        const longSql = "S".repeat(150);

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_maxStringLen",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({ sqlPreview: longSql, msg: "maxStringLen" });
            }
        );
        Logger.setMock(null);

        // 恢复默认配置（避免影响本文件后续用例）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            maxStringLen: 100,
            maxArrayItems: 100
        });

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];
        expect(obj.sqlPreview).toBe(longSql);
    });

    test("配置归一化：sanitizeDepth 非法值应回退默认；超大值应被 clamp", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        // 非法值（0）应回退到默认 3
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 0
        });

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_norm_0",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    deep: {
                        a: {
                            b: {
                                c: {
                                    d: {
                                        password: "p"
                                    }
                                }
                            }
                        }
                    },
                    msg: "norm-0"
                });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        const obj0 = calls[0].args[0];
        // 默认 depth=3：deep(1)->a(2)->b(3)，因此 b 的子节点 c 会被降级为字符串预览
        expect(typeof obj0.deep.a.b.c).toBe("string");
        expect(obj0.deep.a.b.c.includes("[MASKED]")).toBe(true);
        calls.length = 0;

        // 超大值应被 clamp（sanitizeDepth 最大 10）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 999
        });

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_norm_999",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    deep: {
                        a: {
                            b: {
                                c: {
                                    d: {
                                        e: {
                                            f: {
                                                g: {
                                                    h: {
                                                        i: {
                                                            j: {
                                                                k: {
                                                                    password: "p",
                                                                    ok: "v"
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    msg: "norm-999"
                });
            }
        );
        Logger.setMock(null);

        expect(calls.length).toBe(1);
        const obj999 = calls[0].args[0];
        // clamp 后 depth=10：... h(9)->i(10)，因此 i 的子节点 j 会被降级为字符串预览
        expect(typeof obj999.deep.a.b.c.d.e.f.g.h.i.j).toBe("string");
        expect(obj999.deep.a.b.c.d.e.f.g.h.i.j.includes("[MASKED]")).toBe(true);
        expect(obj999.deep.a.b.c.d.e.f.g.h.i.j.includes('"password":"p"')).toBe(false);

        // 恢复默认配置（避免影响本文件后续用例）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 3,
            sanitizeNodes: 500,
            sanitizeObjectKeys: 100
        });
    });

    test("统计增强：objectKeys/nodes 限制触发时应输出对应计数", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeObjectKeys: 10,
            sanitizeNodes: 50
        });

        const bigObj: Record<string, any> = {};
        // 确保敏感字段在前 10 个 key 内（不会被丢弃），并触发 key 截断
        bigObj.password = "p";
        for (let i = 0; i < 40; i++) {
            bigObj["k" + i] = i;
        }

        const items: Array<Record<string, any>> = [];
        for (let i = 0; i < 100; i++) {
            items.push({ a: { b: { c: { i: i, token: "t" } } } });
        }

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_limits",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({
                    big: bigObj,
                    items: items,
                    msg: "limits"
                });
            }
        );
        Logger.setMock(null);

        // 恢复默认配置（避免影响本文件后续用例）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeObjectKeys: 100,
            sanitizeNodes: 500,
            sanitizeDepth: 3
        });

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];

        // objectKeys 限制：big 只保留前 10 个 key（包含 password）
        expect(obj.big.password).toBe("[MASKED]");
        expect(Object.keys(obj.big).length).toBe(10);

        // nodes/objectKeys 限制：不要求输出统计字段，但输出结构应稳定
        const itemsOut = obj.items;
        const itemsIsOk = Array.isArray(itemsOut) || typeof itemsOut === "string";
        expect(itemsIsOk).toBe(true);
        expect(obj.logTrimStats).toBeUndefined();
    });

    test("压力：大对象/深层结构在限制下不应抛错，输出结构应稳定", () => {
        const calls: any[] = [];

        const mock: any = {
            info(...args: any[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: any[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: any[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: any[]) {
                calls.push({ level: "debug", args: args });
            }
        };

        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 3,
            sanitizeNodes: 120,
            sanitizeObjectKeys: 30
        });

        const huge: Record<string, any> = {};
        for (let i = 0; i < 80; i++) {
            huge["key_" + i] = {
                level1: {
                    level2: {
                        level3: {
                            password: "p".repeat(20),
                            token: "t".repeat(20),
                            arr: Array.from({ length: 100 }, (_, j) => ({ j: j, mySecret: "s" }))
                        }
                    }
                }
            };
        }

        Logger.setMock(mock);
        withCtx(
            {
                requestId: "rid_stress",
                method: "POST",
                route: "/api/test",
                ip: "127.0.0.1",
                now: 1
            },
            () => {
                Logger.info({ huge: huge, msg: "stress" });
            }
        );
        Logger.setMock(null);

        // 恢复默认配置（避免影响本文件后续用例）
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"],
            sanitizeDepth: 3,
            sanitizeNodes: 500,
            sanitizeObjectKeys: 100
        });

        expect(calls.length).toBe(1);
        const obj = calls[0].args[0];
        expect(obj.huge).toBeTruthy();

        const hugeOut = obj.huge;
        // 在 nodes 限制下，可能是结构化对象，也可能被降级为字符串预览；两者都必须保证敏感字段不会裸露。
        if (typeof hugeOut === "string") {
            expect(hugeOut.includes("[MASKED]")).toBe(true);
            expect(hugeOut.includes("token")).toBe(false);
            expect(hugeOut.includes("password")).toBe(false);
        } else {
            const key0 = (hugeOut as any).key_0;
            if (typeof key0 === "string") {
                expect(key0.includes("[MASKED]")).toBe(true);
                expect(key0.includes("token")).toBe(false);
                expect(key0.includes("password")).toBe(false);
            } else {
                // 在 nodes/objectKeys 限制下，内部结构可能被截断；只要不泄露敏感值即可。
                const json = JSON.stringify(key0);
                expect(json.includes("p".repeat(20))).toBe(false);
                expect(json.includes("t".repeat(20))).toBe(false);
                expect(json.includes('"mySecret":"s"')).toBe(false);
                // 尽量保证出现掩码标记（如果对应字段仍在输出内）
                expect(json.includes("[MASKED]") || json.includes("password") === false).toBe(true);
            }
        }

        expect(obj.logTrimStats).toBeUndefined();
    });

    test("Logger.flush：不关闭句柄，只负责尽快 flush", async () => {
        Logger.configure({
            dir: testLogDir,
            console: 0,
            debug: 1,
            excludeFields: ["*Secret", "*nick*"]
        });

        Logger.info({ token: "t", mySecret: "s", msg: "flush" });
        await Logger.flush();

        // flush 不应影响后续写入
        Logger.info("after flush");
        await Logger.flush();

        await Logger.shutdown();
    });
});
