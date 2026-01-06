import { describe, test, expect } from "bun:test";

import { configure, flush, getLogger, shutdown } from "../lib/logger";

describe("logger - BufferedSink timer", () => {
    test("flushNow 应清理已安排的定时 flush，避免多个 timer 并存", async () => {
        const originalSetTimeout = globalThis.setTimeout;
        const originalClearTimeout = globalThis.clearTimeout;

        const active = new Set<any>();
        let setCalls = 0;
        let clearCalls = 0;

        globalThis.setTimeout = ((fn: (...args: any[]) => any, ms?: number, ...args: any[]) => {
            setCalls = setCalls + 1;
            const handle = { id: setCalls, ms: ms, fn: fn, args: args };
            active.add(handle);
            return handle as any;
        }) as any;

        globalThis.clearTimeout = ((handle: any) => {
            clearCalls = clearCalls + 1;
            active.delete(handle);
        }) as any;

        try {
            configure({
                dir: "./temp/logger-buffered-sink-timer",
                console: 0,
                debug: 1,
                maxSize: 20
            });

            const logger = getLogger();

            logger.info({ msg: "a" });
            expect(active.size).toBe(1);

            await flush();
            expect(active.size).toBe(0);

            logger.info({ msg: "b" });
            expect(active.size).toBe(1);

            expect(setCalls).toBe(2);
            expect(clearCalls).toBeGreaterThanOrEqual(1);
        } finally {
            globalThis.setTimeout = originalSetTimeout;
            globalThis.clearTimeout = originalClearTimeout;
            await shutdown();
        }
    });
});
