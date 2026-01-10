import { describe, expect, test } from "bun:test";

import { arrayToTree } from "../utils/arrayToTree";

describe("befly-shared/arrayToTree", () => {
    test("should build tree by id/pid", () => {
        const result = arrayToTree(
            [
                { id: "1", pid: "", name: "root", sort: 2 },
                { id: "2", pid: "1", name: "child", sort: 1 }
            ],
            "id",
            "pid",
            "children",
            "sort"
        );

        expect(result.tree.length).toBe(1);
        expect((result.tree[0] as any).id).toBe("1");

        const children = (result.tree[0] as any).children as any[];
        expect(Array.isArray(children)).toBe(true);
        expect(children.length).toBe(1);
        expect(children[0].id).toBe("2");
    });

    test("should sort by sort asc, then id natural", () => {
        const result = arrayToTree(
            [
                { id: "10", pid: "", sort: 1 },
                { id: "2", pid: "", sort: 1 },
                { id: "3", pid: "", sort: 0 }
            ],
            "id",
            "pid",
            "children",
            "sort"
        );

        // sort=0 视为 999999，应排最后
        expect(result.tree.map((x) => (x as any).id)).toEqual(["2", "10", "3"]);
    });
});
