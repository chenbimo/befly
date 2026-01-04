import { expect, test } from "bun:test";

test("befly - default entry should only export Befly", async () => {
    const mod = await import("befly");

    const keys = Object.keys(mod).sort();
    expect(keys).toEqual(["Befly"]);
    expect(typeof (mod as any).Befly).toBe("function");
});
