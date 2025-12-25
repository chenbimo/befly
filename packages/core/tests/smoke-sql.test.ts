import { describe, expect, test } from "bun:test";

import { SqlBuilder } from "../lib/sqlBuilder.js";

describe("smoke - sql", () => {
    test("SqlBuilder: should build a simple SELECT with params", () => {
        const qb = new SqlBuilder();

        const result = qb.select(["id", "name"]).from("users").where({ id: 123 }).limit(10).offset(20).toSelectSql();

        expect(result).toBeDefined();
        expect(typeof result.sql).toBe("string");
        expect(Array.isArray(result.params)).toBe(true);

        // 关键特征：有 SELECT/FROM/WHERE/LIMIT，且参数化生效
        expect(result.sql).toContain("SELECT `id`, `name` FROM `users`");
        expect(result.sql).toContain("WHERE `id` = ?");
        expect(result.sql).toContain("LIMIT 10 OFFSET 20");
        expect(result.params).toEqual([123]);

        // 基础安全性：确保 where 使用占位符，而不是把值直接拼进 SQL
        expect(result.sql).not.toContain("123");
    });
});
