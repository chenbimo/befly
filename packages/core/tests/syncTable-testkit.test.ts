import { describe, expect, it } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

describe("syncTable - SyncTable 静态工具", () => {
    it("should expose helpers directly on class", () => {
        expect(typeof SyncTable).toBe("function");

        const descriptor = Object.getOwnPropertyDescriptor(SyncTable, "TestKit");
        expect(descriptor).toBeUndefined();

        expect(typeof SyncTable.quoteIdentifier).toBe("function");
        expect(typeof SyncTable.getTypeMapping).toBe("function");
        expect(typeof SyncTable.buildIndexSQL).toBe("function");
        expect(typeof SyncTable.getSqlType).toBe("function");

        expect(SyncTable.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
    });
});
