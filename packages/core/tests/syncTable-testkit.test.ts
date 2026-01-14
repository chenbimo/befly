import { describe, expect, it } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";
import { escapeComment } from "../utils/sqlUtil.ts";

describe("syncTable - SyncTable 静态工具", () => {
    it("should expose helpers directly on class", () => {
        expect(typeof SyncTable).toBe("function");

        const descriptor = Object.getOwnPropertyDescriptor(SyncTable, "TestKit");
        expect(descriptor).toBeUndefined();

        const syncTableStatics = SyncTable as unknown as Record<string, unknown>;
        expect(syncTableStatics["escapeComment"]).toBeUndefined();
        expect(typeof SyncTable.getTypeMapping).toBe("function");
        expect(typeof SyncTable.quoteIdentifier).toBe("function");
        expect(typeof SyncTable.buildIndexSQL).toBe("function");
        expect(typeof SyncTable.getSqlType).toBe("function");

        expect(typeof escapeComment).toBe("function");

        expect(SyncTable.DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR).toBe(8);
    });
});
