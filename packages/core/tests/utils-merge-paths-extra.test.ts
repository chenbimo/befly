import { describe, expect, test } from "bun:test";

import { mergeAndConcat } from "../utils/mergeAndConcat";
import { getByPath, setByPath } from "../utils/util";

describe("utils - getByPath / setByPath extra", () => {
    test("setByPath should overwrite existing leaf", () => {
        const obj: Record<string, unknown> = { a: { b: { c: 1 } } };
        setByPath(obj, "a.b.c", 2);
        expect(getByPath(obj, "a.b.c")).toBe(2);
    });

    test("setByPath should replace non-plain intermediate with object", () => {
        const obj: Record<string, unknown> = { a: [] };
        setByPath(obj, "a.b", 1);
        expect(obj).toEqual({ a: { b: 1 } });
    });

    test("getByPath should read nested values", () => {
        const obj: Record<string, unknown> = { a: { b: { c: 3 } } };
        expect(getByPath(obj, "a.b.c")).toBe(3);
    });

    test("getByPath should return undefined when encountering null", () => {
        const obj: Record<string, unknown> = { a: null };
        expect(getByPath(obj, "a.b")).toBeUndefined();
    });
});

describe("utils - mergeAndConcat extra", () => {
    test("arrays should not share references after merge", () => {
        const a = { list: [{ x: 1 }] };
        const b = { list: [{ x: 2 }] };

        const merged = mergeAndConcat<{ list: Array<{ x: number }> }>(a, b);
        expect(merged.list.length).toBe(2);
        expect(merged.list[0]).toEqual({ x: 1 });
        expect(merged.list[1]).toEqual({ x: 2 });

        // mutate merged, input should remain stable
        merged.list[0].x = 99;
        expect(a.list[0].x).toBe(1);
    });

    test("undefined in source should not override existing value", () => {
        const merged = mergeAndConcat({ a: 1 }, { a: undefined });
        expect(merged).toEqual({ a: 1 });
    });

    test("non-object values should be replaced by later value (cloned when needed)", () => {
        const merged = mergeAndConcat({ a: 1 }, { a: { x: 1 } });
        expect(merged).toEqual({ a: { x: 1 } });

        const merged2 = mergeAndConcat<{ a: unknown }>({ a: { x: 1 } }, { a: [1, 2] });
        expect(merged2).toEqual({ a: [1, 2] });

        const arr = merged2.a;
        if (!Array.isArray(arr)) {
            throw new Error("Expected merged2.a to be an array");
        }
        arr.push(3);
        expect(arr.length).toBe(3);
    });

    test("should not mutate input plain objects and should deep-clone nested objects", () => {
        const a = { obj: { nested: { n: 1 } } };
        const b = { obj: { nested: { m: 2 } } };

        const merged = mergeAndConcat<{ obj: { nested: { n?: number; m?: number } } }>(a, b);
        expect(merged).toEqual({ obj: { nested: { n: 1, m: 2 } } });

        merged.obj.nested.n = 99;
        expect(a.obj.nested.n).toBe(1);
        expect(b.obj.nested.m).toBe(2);
    });

    test("type replacement should still clone arrays/objects (no shared references)", () => {
        const srcArr: Array<{ x: number }> = [{ x: 1 }];
        const merged = mergeAndConcat<{ a: Array<{ x: number }> }>({ a: 1 }, { a: srcArr });
        expect(Array.isArray(merged.a)).toBe(true);

        merged.a[0].x = 99;
        expect(srcArr[0].x).toBe(1);

        const srcObj: { x: { y: number } } = { x: { y: 1 } };
        const merged2 = mergeAndConcat<{ a: { x: { y: number } } }>({ a: [1] }, { a: srcObj });
        expect(merged2).toEqual({ a: { x: { y: 1 } } });

        merged2.a.x.y = 9;
        expect(srcObj.x.y).toBe(1);
    });
});
