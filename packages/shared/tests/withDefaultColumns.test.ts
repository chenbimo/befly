import { describe, expect, test } from "bun:test";

import { withDefaultColumns } from "befly-shared/utils/withDefaultColumns";

describe("befly-shared/withDefaultColumns", () => {
    test("should apply base defaults", () => {
        const cols = [{ colKey: "name" }];
        const out = withDefaultColumns(cols);
        expect(out).toHaveLength(1);
        expect(out[0].width).toBe(200);
        expect(out[0].ellipsis).toBe(true);
        expect(out[0].colKey).toBe("name");
    });

    test("should apply special config for operation/state/id", () => {
        const cols = [{ colKey: "operation" }, { colKey: "state" }, { colKey: "id" }];
        const out = withDefaultColumns(cols);

        expect(out[0].width).toBe(100);
        expect(out[0].align).toBe("center");
        expect(out[0].fixed).toBe("right");

        expect(out[1].width).toBe(100);
        expect(out[1].align).toBe("center");

        expect(out[2].width).toBe(200);
        expect(out[2].align).toBe("center");
    });

    test("col values should override defaults", () => {
        const cols = [{ colKey: "operation", width: 999, ellipsis: false }];
        const out = withDefaultColumns(cols);
        expect(out[0].width).toBe(999);
        expect(out[0].ellipsis).toBe(false);
        expect(out[0].fixed).toBe("right");
    });

    test("should default align center for *At/*At2 keys", () => {
        const cols = [{ colKey: "createdAt" }, { colKey: "updatedAt2" }];
        const out = withDefaultColumns(cols);
        expect(out[0].align).toBe("center");
        expect(out[1].align).toBe("center");
    });

    test("customConfig should override specialColumnConfig", () => {
        const cols = [{ colKey: "operation" }];
        const out = withDefaultColumns(cols, { operation: { width: 123 } });
        expect(out[0].width).toBe(123);
        // customConfig 对 operation 的覆盖是“替换”默认配置（浅合并），不会深合并保留 fixed
        expect(out[0].fixed).toBeUndefined();
    });
});
