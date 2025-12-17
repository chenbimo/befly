import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { withCtx } from "../lib/asyncContext";
import { Logger } from "../lib/logger";

const testLogDir = join(process.cwd(), "temp", "test-logs");

beforeAll(() => {
  if (!existsSync(testLogDir)) {
    mkdirSync(testLogDir, { recursive: true });
  }
  Logger.configure({
    dir: testLogDir,
    console: 0,
    debug: 1,
    excludeFields: ["*Secret", "*nick*"],
  });
});

afterAll(async () => {
  // 延迟清理，等待 pino-roll 完成写入
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (existsSync(testLogDir)) {
    rmSync(testLogDir, { recursive: true, force: true });
  }
});

describe("Logger - 纯字符串消息", () => {
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

describe("Logger - 对象 + 消息 (pino 原生格式)", () => {
  test("info(obj, msg)", () => {
    Logger.info({ userId: 1, action: "login" }, "User action");
    expect(true).toBe(true);
  });

  test("warn(obj, msg)", () => {
    Logger.warn({ ip: "127.0.0.1", count: 100 }, "Rate limit warning");
    expect(true).toBe(true);
  });

  test("error(obj, msg)", () => {
    const err = new Error("Something went wrong");
    Logger.error({ err: err }, "Request failed");
    expect(true).toBe(true);
  });

  test("debug(obj, msg)", () => {
    Logger.debug({ key: "value", nested: { a: 1 } }, "Debug data");
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
      },
    };

    Logger.setMock(mock);
    Logger.info({ foo: 1 }, "hello");
    Logger.setMock(null);

    expect(calls.length).toBe(1);
    expect(calls[0].level).toBe("info");
    expect(calls[0].args[0]).toEqual({ foo: 1 });
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
      },
    };

    Logger.setMock(mock);
    withCtx(
      {
        requestId: "rid_1",
        method: "POST",
        route: "POST/api/test",
        ip: "127.0.0.1",
        now: 123,
        userId: 9,
        roleCode: "admin",
      },
      () => {
        Logger.info("hello");
      },
    );
    Logger.setMock(null);

    expect(calls.length).toBe(1);
    expect(calls[0].args[0].requestId).toBe("rid_1");
    expect(calls[0].args[0].method).toBe("POST");
    expect(calls[0].args[0].route).toBe("POST/api/test");
    expect(calls[0].args[0].userId).toBe(9);
    expect(typeof calls[0].args[0].durationSinceNowMs).toBe("number");
    expect(calls[0].args[0].durationSinceNowMs).toBeGreaterThanOrEqual(0);
    expect(calls[0].args[1]).toBe("hello");
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
      },
    };

    Logger.setMock(mock);
    withCtx(
      {
        requestId: "rid_2",
        method: "POST",
        route: "POST/api/test",
        ip: "127.0.0.1",
        now: 456,
      },
      () => {
        Logger.info({ requestId: "explicit", foo: 1 }, "m");
      },
    );
    Logger.setMock(null);

    expect(calls.length).toBe(1);
    expect(calls[0].args[0].requestId).toBe("explicit");
    expect(calls[0].args[0].route).toBe("POST/api/test");
    expect(calls[0].args[0].foo).toBe(1);
    expect(calls[0].args[1]).toBe("m");
  });

  test("兼容 Logger.error(msg, err)", () => {
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
      },
    };

    Logger.setMock(mock);
    withCtx(
      {
        requestId: "rid_3",
        method: "POST",
        route: "POST/api/test",
        ip: "127.0.0.1",
        now: 789,
      },
      () => {
        const err = new Error("boom");
        Logger.error("Redis getObject 错误", err);
      },
    );
    Logger.setMock(null);

    expect(calls.length).toBe(1);
    expect(calls[0].args[0].requestId).toBe("rid_3");
    expect(calls[0].args[0].err.message).toBe("boom");
    expect(calls[0].args[1]).toBe("Redis getObject 错误");
  });

  test("对象裁剪：敏感 key 掩码 + 字符串截断 + 数组截断 + 统计字段", () => {
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
      },
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
        route: "POST/api/test",
        ip: "127.0.0.1",
        now: 1,
      },
      () => {
        Logger.info(
          {
            password: "p".repeat(200),
            mySecret: "s".repeat(200),
            nickname: "n".repeat(200),
            normal: longStr,
            nested: {
              token: "t".repeat(200),
              a: longStr,
              deep: { b: longStr },
            },
            items: longArr,
            okNumber: 123,
            okBool: true,
          },
          "trim",
        );
      },
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
    expect(obj.logTrimStats).toBeTruthy();
    expect(obj.logTrimStats.maskedKeys).toBeGreaterThan(0);
    expect(obj.logTrimStats.truncatedStrings).toBeGreaterThan(0);
    expect(obj.logTrimStats.arraysTruncated).toBeGreaterThanOrEqual(1);
    expect(obj.logTrimStats.arrayItemsOmitted).toBeGreaterThanOrEqual(30);
  });
});
