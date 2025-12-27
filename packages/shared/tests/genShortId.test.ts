import { describe, expect, test } from "bun:test";

import { genShortId } from "befly-shared/utils/genShortId";

describe("befly-shared/genShortId", () => {
    test("should generate a non-empty string", () => {
        const id = genShortId();
        expect(typeof id).toBe("string");
        expect(id.length > 0).toBe(true);
    });

    test("should be deterministic under mocked Date.now/Math.random", () => {
        const originalNow = Date.now;
        const originalRandom = Math.random;

        try {
            Date.now = () => 1700000000000;
            Math.random = () => 0.123456789;

            const id = genShortId();
            const expectedPrefix = (1700000000000).toString(36);
            const expectedSuffix = (0.123456789).toString(36).slice(2, 7);
            expect(id).toBe(expectedPrefix + expectedSuffix);
        } finally {
            Date.now = originalNow;
            Math.random = originalRandom;
        }
    });

    test("should usually produce different values across calls", () => {
        const id1 = genShortId();
        const id2 = genShortId();
        expect(id1).not.toBe(id2);
    });
});
