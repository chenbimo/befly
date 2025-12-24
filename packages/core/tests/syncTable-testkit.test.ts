import { describe, expect, it } from "bun:test";

import { syncTable } from "../sync/syncTable.js";

describe("syncTable - TestKit 挂载", () => {
    it("should expose TestKit as a stable object", () => {
        expect(typeof syncTable).toBe("function");
        expect(syncTable.TestKit).toBeDefined();

        expect(typeof syncTable.TestKit.quoteIdentifier).toBe("function");
        expect(typeof syncTable.TestKit.getTypeMapping).toBe("function");

        expect(syncTable.TestKit.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);

        const firstRef = syncTable.TestKit;
        const secondRef = syncTable.TestKit;
        expect(firstRef).toBe(secondRef);
    });
});
