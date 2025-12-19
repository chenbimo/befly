import { describe, expect, test } from "bun:test";

import { arrayToTree } from "../utils/arrayToTree.js";

describe("arrayToTree - sortField", () => {
    test("should keep input order when default sortField=sort but sort is missing", () => {
        const items = [
            { id: 1, pid: 0, name: "A" },
            { id: 2, pid: 0, name: "B" },
            { id: 3, pid: 0, name: "C" }
        ];

        const tree = arrayToTree(items);
        expect(tree.map((x: any) => x.id)).toEqual([1, 2, 3]);
    });

    test("should default sortField to sort", () => {
        const items = [
            { id: 1, pid: 0, name: "A", sort: 2 },
            { id: 2, pid: 0, name: "B", sort: 1 },
            { id: 3, pid: 0, name: "C", sort: 3 }
        ];

        const tree = arrayToTree(items);
        expect(tree.map((x: any) => x.id)).toEqual([2, 1, 3]);
    });

    test("should not sort when sortField is empty/undefined/null", () => {
        const items = [
            { id: 1, pid: 0, name: "A", sort: 2 },
            { id: 2, pid: 0, name: "B", sort: 1 },
            { id: 3, pid: 0, name: "C", sort: 3 }
        ];

        const cases = [
            { label: "empty string", options: { sortField: "" } },
            { label: "undefined", options: { sortField: undefined } },
            { label: "null", options: { sortField: null } }
        ];

        for (const c of cases) {
            const tree = arrayToTree(items, c.options as any);
            expect(
                tree.map((x: any) => x.id),
                c.label
            ).toEqual([1, 2, 3]);
        }
    });

    test("should sort siblings by numeric field", () => {
        const items = [
            { id: 1, pid: 0, name: "A", sort: 2 },
            { id: 2, pid: 0, name: "B", sort: 1 },
            { id: 3, pid: 0, name: "C", sort: 3 }
        ];

        const tree = arrayToTree(items, { sortField: "sort" });
        expect(tree.map((x: any) => x.id)).toEqual([2, 1, 3]);
    });

    test("should do natural sort for strings", () => {
        const items = [
            { id: 1, pid: 0, name: "item 10" },
            { id: 2, pid: 0, name: "item 2" },
            { id: 3, pid: 0, name: "item 1" }
        ];

        const tree = arrayToTree(items, { sortField: "name" });
        expect(tree.map((x: any) => x.id)).toEqual([3, 2, 1]);
    });

    test("should place missing sortField values last", () => {
        const items = [
            { id: 1, pid: 0, sort: 2 },
            { id: 2, pid: 0 },
            { id: 3, pid: 0, sort: 1 },
            { id: 4, pid: 0, sort: null }
        ];

        const tree = arrayToTree(items, { sortField: "sort" });
        expect(tree.map((x: any) => x.id)).toEqual([3, 1, 2, 4]);
    });

    test("should keep input order among missing values and among equal sort values", () => {
        const items = [
            { id: 1, pid: 0, sort: 2 },
            { id: 2, pid: 0 },
            { id: 3, pid: 0, sort: 1 },
            { id: 4, pid: 0 },
            { id: 5, pid: 0, sort: 1 },
            { id: 6, pid: 0 }
        ];

        const tree = arrayToTree(items);
        expect(tree.map((x: any) => x.id)).toEqual([3, 5, 1, 2, 4, 6]);
    });

    test("should not infinite loop on cyclic pid relationships", () => {
        const items = [
            { id: 1, pid: 2, name: "A" },
            { id: 2, pid: 1, name: "B" }
        ];

        const tree = arrayToTree(items, { rootPid: 1, sortField: "" });
        expect(tree).toHaveLength(1);
        expect(tree[0]).toMatchObject({ id: 2, pid: 1, name: "B" });
        expect((tree[0] as any).children).toHaveLength(1);
        expect((tree[0] as any).children[0]).toMatchObject({ id: 1, pid: 2, name: "A" });
        expect(((tree[0] as any).children[0] as any).children).toHaveLength(1);
        expect(((tree[0] as any).children[0] as any).children[0] as any).toMatchObject({ id: 2, pid: 1, name: "B" });
        expect((((tree[0] as any).children[0] as any).children[0] as any).children).toBeUndefined();
    });

    test("should also sort children at each level", () => {
        const items = [
            { id: 1, pid: 0, name: "root" },
            { id: 10, pid: 1, name: "item 10" },
            { id: 2, pid: 1, name: "item 2" },
            { id: 3, pid: 1, name: "item 1" }
        ];

        const tree = arrayToTree(items, { sortField: "name" });
        expect(tree).toHaveLength(1);
        expect((tree[0] as any).children.map((x: any) => x.id)).toEqual([3, 2, 10]);
    });
});
