import { describe, expect, it } from "bun:test";

import { MySqlDialect, PostgresDialect, SqliteDialect } from "../lib/dbDialect.ts";

describe("DbDialect - quoteIdent", () => {
    it("MySqlDialect: 使用反引号", () => {
        const dialect = new MySqlDialect();
        expect(dialect.quoteIdent("users")).toBe("`users`");
        expect(dialect.quoteIdent("created_at")).toBe("`created_at`");
    });

    it("PostgresDialect: 使用双引号", () => {
        const dialect = new PostgresDialect();
        expect(dialect.quoteIdent("users")).toBe('"users"');
        expect(dialect.quoteIdent("created_at")).toBe('"created_at"');
    });

    it("SqliteDialect: 使用双引号", () => {
        const dialect = new SqliteDialect();
        expect(dialect.quoteIdent("users")).toBe('"users"');
        expect(dialect.quoteIdent("created_at")).toBe('"created_at"');
    });
});

describe("DbDialect - getTableColumnsQuery/tableExistsQuery", () => {
    it("PostgresDialect: columns 查询应带参数", () => {
        const dialect = new PostgresDialect();
        const query = dialect.getTableColumnsQuery("users");
        expect(query.sql).toContain("information_schema.columns");
        expect(query.params).toEqual(["users"]);
    });

    it('SqliteDialect: columns 查询应为 PRAGMA table_info("table")', () => {
        const dialect = new SqliteDialect();
        const query = dialect.getTableColumnsQuery("users");
        expect(query.sql).toBe('PRAGMA table_info("users")');
        expect(query.params).toEqual([]);
    });

    it("SqliteDialect: tableExistsQuery 应查 sqlite_master", () => {
        const dialect = new SqliteDialect();
        const query = dialect.tableExistsQuery("users");
        expect(query.sql).toContain("sqlite_master");
        expect(query.params).toEqual(["users"]);
    });
});
