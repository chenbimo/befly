import { describe, expect, test } from "bun:test";

import { fieldClear } from "../utils/fieldClear";

describe("befly-shared/fieldClear", () => {
    test("should omit keys", () => {
        const out = fieldClear({ id: 1, name: "n", password: "p" }, { omitKeys: ["password"] });
        expect((out as any).password).toBeUndefined();
        expect((out as any).name).toBe("n");
    });

    test("keepMap should have priority", () => {
        const out = fieldClear({ state: 0, name: "n" }, { excludeValues: [0], keepMap: { state: 0 } });
        expect((out as any).state).toBe(0);
    });

    test("should support array of objects", () => {
        const out = fieldClear([{ a: 1, b: null }, { a: 2 }], { excludeValues: [null, undefined] });
        expect(Array.isArray(out)).toBe(true);
        expect((out as any[])[0].a).toBe(1);
    });
});
