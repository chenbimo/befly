import type { MockMySqlColumn, MockMySqlState } from "./_mocks/mockMySqlDb.ts";

import { describe, expect, test } from "bun:test";

import { createMockMySqlDb } from "./_mocks/mockMySqlDb.ts";

describe("mockMySqlDb - DDL parse", () => {
    test("ADD UNIQUE INDEX 支持多列（含空格）", async () => {
        const colA: MockMySqlColumn = {
            name: "a",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "",
            comment: ""
        };

        const colB: MockMySqlColumn = {
            name: "b",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "",
            comment: ""
        };

        const state: MockMySqlState = {
            executedSql: [],
            dbName: "x",
            tables: {
                t: {
                    columns: {
                        a: colA,
                        b: colB
                    },
                    indexes: {}
                }
            }
        };

        const db = createMockMySqlDb(state);

        await db.unsafe("ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, ADD UNIQUE INDEX `uk_ab` (`a`, `b`)");

        expect(state.tables.t.indexes.uk_ab).toEqual(["a", "b"]);
    });

    test("ADD INDEX 支持多列（无空格）", async () => {
        const colA: MockMySqlColumn = {
            name: "a",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "",
            comment: ""
        };

        const colB: MockMySqlColumn = {
            name: "b",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "",
            comment: ""
        };

        const state: MockMySqlState = {
            executedSql: [],
            dbName: "x",
            tables: {
                t: {
                    columns: {
                        a: colA,
                        b: colB
                    },
                    indexes: {}
                }
            }
        };

        const db = createMockMySqlDb(state);

        await db.unsafe("ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX `idx_ab` (`a`,`b`)");

        expect(state.tables.t.indexes.idx_ab).toEqual(["a", "b"]);
    });

    test("DROP INDEX 应删除索引", async () => {
        const colA: MockMySqlColumn = {
            name: "a",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "",
            comment: ""
        };

        const state: MockMySqlState = {
            executedSql: [],
            dbName: "x",
            tables: {
                t: {
                    columns: {
                        a: colA
                    },
                    indexes: {
                        idx_a: ["a"]
                    }
                }
            }
        };

        const db = createMockMySqlDb(state);

        await db.unsafe("ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, DROP INDEX `idx_a`");

        expect(state.tables.t.indexes.idx_a).toBeUndefined();
    });

    test("ALTER COLUMN ... SET DEFAULT 应更新 defaultValue", async () => {
        const colA: MockMySqlColumn = {
            name: "a",
            dataType: "varchar",
            columnType: "varchar(10)",
            max: 10,
            nullable: false,
            defaultValue: "old",
            comment: ""
        };

        const state: MockMySqlState = {
            executedSql: [],
            dbName: "x",
            tables: {
                t: {
                    columns: {
                        a: colA
                    },
                    indexes: {}
                }
            }
        };

        const db = createMockMySqlDb(state);

        await db.unsafe("ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, ALTER COLUMN `a` SET DEFAULT 'new'");

        expect(state.tables.t.columns.a.defaultValue).toBe("new");
    });
});
