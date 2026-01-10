import { describe, expect, test } from "bun:test";

import { hashPassword } from "../utils/hashPassword";

describe("befly-shared/hashPassword", () => {
    test("should return sha256 hex string (64 chars)", async () => {
        const hasWebCrypto = typeof globalThis.crypto === "object" && globalThis.crypto !== null && typeof globalThis.crypto.subtle === "object";
        if (!hasWebCrypto) {
            // 某些运行环境可能没有 WebCrypto：该包仍可用于其它 utils
            expect(true).toBe(true);
            return;
        }

        const hash = await hashPassword("abc", "befly");
        expect(typeof hash).toBe("string");
        expect(hash.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);

        const hash2 = await hashPassword("abc", "befly");
        expect(hash2).toBe(hash);
    });

    test("edge cases: empty string and unicode inputs", async () => {
        const hasWebCrypto = typeof globalThis.crypto === "object" && globalThis.crypto !== null && typeof globalThis.crypto.subtle === "object";
        if (!hasWebCrypto) {
            expect(true).toBe(true);
            return;
        }

        const emptyHash = await hashPassword("", "");
        expect(typeof emptyHash).toBe("string");
        expect(emptyHash.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(emptyHash)).toBe(true);

        const unicodeHash = await hashPassword("中文😀", "盐🧂");
        expect(typeof unicodeHash).toBe("string");
        expect(unicodeHash.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(unicodeHash)).toBe(true);

        // 同输入应稳定
        const unicodeHash2 = await hashPassword("中文😀", "盐🧂");
        expect(unicodeHash2).toBe(unicodeHash);

        // 不同输入应变化（极小概率碰撞；此处作为 sanity check）
        expect(unicodeHash).not.toBe(emptyHash);
    });
});
