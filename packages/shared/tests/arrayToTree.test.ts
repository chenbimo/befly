import { describe, expect, test } from "bun:test";

import { arrayToTree } from "befly-shared/utils/arrayToTree";

describe("befly-shared/arrayToTree - default sort", () => {
    test("should sort by sort asc; missing/invalid/<1 sort treated as 999999; tie-break by id natural order", () => {
        const items = [
            { id: "a2", pid: "" },
            { id: "a10", pid: "" },
            { id: "a1", pid: "" },
            { id: "x_nan", pid: "", sort: Number.NaN },
            { id: "x_inf", pid: "", sort: Number.POSITIVE_INFINITY },
            { id: "x_zero", pid: "", sort: 0 },
            { id: "b", pid: "", sort: 2 }
        ];

        const result = arrayToTree(items as any);
        expect(result.tree.map((x: any) => x.id)).toEqual(["b", "a1", "a2", "a10", "x_inf", "x_nan", "x_zero"]);

        // leaf nodes should have children: []
        for (const node of result.tree) {
            expect(Array.isArray((node as any).children)).toBe(true);
        }
    });

    test("should treat sort < 1 as default 999999", () => {
        const items = [
            { id: "b", pid: "", sort: 2 },
            { id: "a", pid: "", sort: -1 },
            { id: "c", pid: "", sort: 1 }
        ];

        const result = arrayToTree(items as any);
        expect(result.tree.map((x: any) => x.id)).toEqual(["c", "b", "a"]);
    });
});

describe("befly-shared/arrayToTree - parent handling", () => {
    test("should treat missing parent as root", () => {
        const items = [
            { id: "a", pid: "missing", sort: 1 },
            { id: "b", pid: "", sort: 2 }
        ];

        const result = arrayToTree(items as any);
        expect(result.tree.map((x: any) => x.id)).toEqual(["a", "b"]);
    });

    test("should build children list and sort children recursively", () => {
        const items = [
            { id: "p", pid: "", sort: 1 },
            { id: "c2", pid: "p", sort: 2 },
            { id: "c1", pid: "p", sort: 1 },
            { id: "c0", pid: "p", sort: 0 },
            { id: "g2", pid: "c2", sort: 2 },
            { id: "g1", pid: "c2", sort: 1 }
        ];

        const result = arrayToTree(items as any);
        expect(result.tree).toHaveLength(1);
        expect((result.tree[0] as any).id).toBe("p");

        const childrenIds = ((result.tree[0] as any).children || []).map((x: any) => x.id);
        expect(childrenIds).toEqual(["c1", "c2", "c0"]);

        const c2 = ((result.tree[0] as any).children || []).find((x: any) => x.id === "c2");
        const grandChildrenIds = ((c2 as any).children || []).map((x: any) => x.id);
        expect(grandChildrenIds).toEqual(["g1", "g2"]);
    });
});

describe("befly-shared/arrayToTree - key normalization", () => {
    test("should normalize numeric id/pid to string and populate map", () => {
        const items = [
            { id: 1, pid: 0, sort: 1 },
            { id: 2, pid: 1, sort: 1 }
        ];

        const result = arrayToTree(items as any);
        expect(result.flat.map((x: any) => x.id)).toEqual(["1", "2"]);
        expect(result.map.get("1")).toBeTruthy();

        // 0 parent does not exist -> treated as root
        expect(result.tree.map((x: any) => x.id)).toEqual(["1"]);
        expect(((result.tree[0] as any).children || []).map((x: any) => x.id)).toEqual(["2"]);
    });
});

describe("befly-shared/arrayToTree - cyclic relationships", () => {
    test("should not throw on cycles", () => {
        const items = [
            { id: "a", pid: "b", sort: 1 },
            { id: "b", pid: "a", sort: 1 }
        ];

        const result = arrayToTree(items as any);

        // current behavior: both nodes are attached as children, no explicit root
        expect(result.flat).toHaveLength(2);
        expect(Array.isArray(result.tree)).toBe(true);
    });
});
