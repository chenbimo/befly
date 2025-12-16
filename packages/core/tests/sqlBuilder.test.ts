import { describe, test, expect } from "bun:test";

import { SqlBuilder } from "../lib/sqlBuilder";

describe("SqlBuilder - SELECT 查询", () => {
  test("简单查询", () => {
    const builder = new SqlBuilder();
    const result = builder.select(["id", "name"]).from("users").toSelectSql();
    expect(result.sql).toContain("SELECT `id`, `name` FROM `users`");
    expect(result.params).toEqual([]);
  });

  test("查询所有字段", () => {
    const builder = new SqlBuilder();
    const result = builder.select(["*"]).from("users").toSelectSql();
    expect(result.sql).toContain("SELECT * FROM `users`");
  });

  test("带 WHERE 条件", () => {
    const builder = new SqlBuilder();
    const result = builder.select(["*"]).from("users").where({ id: 1 }).toSelectSql();
    expect(result.sql).toContain("WHERE `id` = ?");
    expect(result.params).toEqual([1]);
  });

  test("多个 WHERE 条件", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ id: 1, status: "active" })
      .toSelectSql();
    expect(result.sql).toContain("WHERE");
    expect(result.sql).toContain("AND");
    expect(result.params).toEqual([1, "active"]);
  });

  test("ORDER BY", () => {
    const builder = new SqlBuilder();
    const result = builder.select(["*"]).from("users").orderBy(["created_at#DESC"]).toSelectSql();
    expect(result.sql).toContain("ORDER BY `created_at` DESC");
  });

  test("LIMIT 和 OFFSET", () => {
    const builder = new SqlBuilder();
    const result = builder.select(["*"]).from("users").limit(10).offset(20).toSelectSql();
    expect(result.sql).toContain("LIMIT 10 OFFSET 20");
  });
});

describe("SqlBuilder - WHERE 操作符", () => {
  test("$ne 不等于", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ status: { $ne: "deleted" } })
      .toSelectSql();
    expect(result.sql).toContain("`status` != ?");
    expect(result.params).toEqual(["deleted"]);
  });

  test("$in 包含", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ id: { $in: [1, 2, 3] } })
      .toSelectSql();
    expect(result.sql).toContain("`id` IN (?,?,?)");
    expect(result.params).toEqual([1, 2, 3]);
  });

  test("$gt 大于", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ age: { $gt: 18 } })
      .toSelectSql();
    expect(result.sql).toContain("`age` > ?");
    expect(result.params).toEqual([18]);
  });

  test("$gte 大于等于", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ age: { $gte: 18 } })
      .toSelectSql();
    expect(result.sql).toContain("`age` >= ?");
    expect(result.params).toEqual([18]);
  });

  test("$lt 小于", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ age: { $lt: 60 } })
      .toSelectSql();
    expect(result.sql).toContain("`age` < ?");
    expect(result.params).toEqual([60]);
  });

  test("$lte 小于等于", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ age: { $lte: 60 } })
      .toSelectSql();
    expect(result.sql).toContain("`age` <= ?");
    expect(result.params).toEqual([60]);
  });

  test("$like 模糊匹配", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["*"])
      .from("users")
      .where({ name: { $like: "%john%" } })
      .toSelectSql();
    expect(result.sql).toContain("`name` LIKE ?");
    expect(result.params).toEqual(["%john%"]);
  });
});

describe("SqlBuilder - INSERT", () => {
  test("插入单条数据", () => {
    const builder = new SqlBuilder();
    const result = builder.toInsertSql("users", { name: "John", age: 25 });
    expect(result.sql).toContain("INSERT INTO `users`");
    expect(result.sql).toContain("(`name`, `age`)");
    expect(result.sql).toContain("VALUES (?, ?)");
    expect(result.params).toEqual(["John", 25]);
  });
});

describe("SqlBuilder - UPDATE", () => {
  test("更新数据", () => {
    const builder = new SqlBuilder();
    const result = builder.where({ id: 1 }).toUpdateSql("users", { name: "Jane" });
    expect(result.sql).toContain("UPDATE `users`");
    expect(result.sql).toContain("SET `name` = ?");
    expect(result.sql).toContain("WHERE `id` = ?");
    expect(result.params).toEqual(["Jane", 1]);
  });
});

describe("SqlBuilder - DELETE", () => {
  test("删除数据", () => {
    const builder = new SqlBuilder();
    const result = builder.where({ id: 1 }).toDeleteSql("users");
    expect(result.sql).toContain("DELETE FROM `users`");
    expect(result.sql).toContain("WHERE `id` = ?");
    expect(result.params).toEqual([1]);
  });
});

describe("SqlBuilder - 链式调用", () => {
  test("复杂查询", () => {
    const builder = new SqlBuilder();
    const result = builder
      .select(["id", "name", "email"])
      .from("users")
      .where({ status: "active", age: { $gte: 18 } })
      .orderBy(["created_at#DESC"])
      .limit(10)
      .toSelectSql();

    expect(result.sql).toContain("SELECT");
    expect(result.sql).toContain("FROM `users`");
    expect(result.sql).toContain("WHERE");
    expect(result.sql).toContain("ORDER BY");
    expect(result.sql).toContain("LIMIT 10");
    expect(result.params.length).toBeGreaterThan(0);
  });

  test("reset 重置", () => {
    const builder = new SqlBuilder();
    builder.select(["*"]).from("users").where({ id: 1 });
    builder.reset();
    const result = builder.select(["*"]).from("posts").toSelectSql();
    expect(result.sql).toContain("FROM `posts`");
    expect(result.sql).not.toContain("users");
  });
});
