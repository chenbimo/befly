import { describe, test, expect } from "bun:test";

import { scheduleDeferredFlush } from "../utils/loggerUtils";

describe("loggerUtils - scheduleDeferredFlush", () => {
    test("currentTimer 存在时不应重复安排，且只触发一次 flush", async () => {
        let calls = 0;

        const flush = async () => {
            calls = calls + 1;
        };

        const t1 = scheduleDeferredFlush(null, 10, flush);
        const t2 = scheduleDeferredFlush(t1, 10, flush);

        expect(t2).toBe(t1);

        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(calls).toBe(1);
    });
});
