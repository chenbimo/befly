import { describe, expect, test } from "bun:test";

import { mergeAndConcat } from "../utils/mergeAndConcat";
import { getByPath, setByPath } from "../utils/util";

describe("utils - getByPath / setByPath extra", () => {
    test("setByPath should overwrite existing leaf", () => {
        const obj: any = { a: { b: { c: 1 } } };
        setByPath(obj, "a.b.c", 2);
        expect(obj.a.b.c).toBe(2);
    });

    test("setByPath should replace non-plain intermediate with object", () => {
        const obj: any = { a: [] };
        setByPath(obj, "a.b", 1);
        expect(obj).toEqual({ a: { b: 1 } });
    });

    test("getByPath should read nested values", () => {
        const obj: any = { a: { b: { c: 3 } } };
        expect(getByPath(obj, "a.b.c")).toBe(3);
    });

    test("getByPath should return undefined when encountering null", () => {
        const obj: any = { a: null };
        expect(getByPath(obj, "a.b")).toBeUndefined();
    });
});

describe("utils - mergeAndConcat extra", () => {
    test("arrays should not share references after merge", () => {
        const a = { list: [{ x: 1 }] };
        const b = { list: [{ x: 2 }] };

        const merged: any = mergeAndConcat(a, b);
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

        const merged2: any = mergeAndConcat({ a: { x: 1 } }, { a: [1, 2] });
        expect(merged2).toEqual({ a: [1, 2] });
        merged2.a.push(3);
        expect((merged2.a as any[]).length).toBe(3);
    });

    test("should not mutate input plain objects and should deep-clone nested objects", () => {
        const a: any = { obj: { nested: { n: 1 } } };
        const b: any = { obj: { nested: { m: 2 } } };

        const merged: any = mergeAndConcat(a, b);
        expect(merged).toEqual({ obj: { nested: { n: 1, m: 2 } } });

        merged.obj.nested.n = 99;
        expect(a.obj.nested.n).toBe(1);
        expect(b.obj.nested.m).toBe(2);
    });

    test("type replacement should still clone arrays/objects (no shared references)", () => {
        const srcArr: any[] = [{ x: 1 }];
        const merged: any = mergeAndConcat({ a: 1 }, { a: srcArr });
        expect(Array.isArray(merged.a)).toBe(true);

        merged.a[0].x = 99;
        expect(srcArr[0].x).toBe(1);

        const srcObj: any = { x: { y: 1 } };
        const merged2: any = mergeAndConcat({ a: [1] }, { a: srcObj });
        expect(merged2).toEqual({ a: { x: { y: 1 } } });

        merged2.a.x.y = 9;
        expect(srcObj.x.y).toBe(1);
    });
});
