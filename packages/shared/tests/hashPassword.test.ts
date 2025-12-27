import { describe, expect, test } from "bun:test";

import { hashPassword } from "befly-shared/utils/hashPassword";

describe("befly-shared/hashPassword", () => {
    test("should return a 64-char hex string (sha256)", async () => {
        const out = await hashPassword("pass123", "salt");
        expect(typeof out).toBe("string");
        expect(out.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(out)).toBe(true);
    });

    test("should be deterministic for same inputs", async () => {
        const a = await hashPassword("pass123", "salt");
        const b = await hashPassword("pass123", "salt");
        expect(a).toBe(b);
    });

    test("should differ when salt differs", async () => {
        const a = await hashPassword("pass123", "salt-a");
        const b = await hashPassword("pass123", "salt-b");
        expect(a).not.toBe(b);
    });
});
