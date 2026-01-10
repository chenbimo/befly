import { describe, expect, test } from "bun:test";

import { withDefaultColumns } from "../utils/withDefaultColumns";

describe("befly-shared/withDefaultColumns", () => {
    test("should add base defaults", () => {
        const cols = withDefaultColumns([{ colKey: "name", title: "Name" }]);
        expect(cols.length).toBe(1);
        expect(cols[0].width).toBe(200);
        expect(cols[0].ellipsis).toBe(true);
    });

    test("should apply special column config", () => {
        const cols = withDefaultColumns([{ colKey: "operation", title: "操作" }]);
        expect(cols[0].width).toBe(100);
        expect(cols[0].align).toBe("center");
        expect(cols[0].fixed).toBe("right");
    });

    test("should align At/At2 columns center by default", () => {
        const cols = withDefaultColumns([{ colKey: "createdAt", title: "创建时间" }]);
        expect(cols[0].align).toBe("center");
    });

    test("customConfig should override defaults", () => {
        const cols = withDefaultColumns([{ colKey: "state", title: "状态" }], {
            state: { width: 88 }
        });
        expect(cols[0].width).toBe(88);
    });
});
