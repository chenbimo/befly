import { describe, expect, it } from "bun:test";

import { getDialectByName } from "../lib/dbDialect.ts";

describe("dbDialect - getDialectByName cache", () => {
    it("should return stable singleton instances", () => {
        const mysql1 = getDialectByName("mysql");
        const mysql2 = getDialectByName("mysql");
        expect(mysql1).toBe(mysql2);

        const pg1 = getDialectByName("postgresql");
        const pg2 = getDialectByName("postgresql");
        expect(pg1).toBe(pg2);

        const sqlite1 = getDialectByName("sqlite");
        const sqlite2 = getDialectByName("sqlite");
        expect(sqlite1).toBe(sqlite2);

        expect(mysql1).not.toBe(pg1);
        expect(mysql1).not.toBe(sqlite1);
        expect(pg1).not.toBe(sqlite1);
    });
});
