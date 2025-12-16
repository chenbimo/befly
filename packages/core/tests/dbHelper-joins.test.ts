/**
 * DbHelper JOIN 功能测试
 * 测试多表联查相关功能（不支持表别名）
 */

import { describe, test, expect } from "bun:test";

import { snakeCase } from "es-toolkit/string";

// ============================================
// 辅助函数单元测试（模拟 DbHelper 私有方法）
// ============================================

/**
 * 处理表名（转下划线格式）
 */
function processTableName(table: string): string {
  return snakeCase(table.trim());
}

/**
 * 处理联查字段（支持表名.字段名格式）
 */
function processJoinField(field: string): string {
  if (field.includes("(") || field === "*" || field.startsWith("`")) {
    return field;
  }

  if (field.toUpperCase().includes(" AS ")) {
    const [fieldPart, aliasPart] = field.split(/\s+AS\s+/i);
    return `${processJoinField(fieldPart.trim())} AS ${aliasPart.trim()}`;
  }

  if (field.includes(".")) {
    const [tableName, fieldName] = field.split(".");
    return `${snakeCase(tableName)}.${snakeCase(fieldName)}`;
  }

  return snakeCase(field);
}

/**
 * 处理联查 where 条件键名
 */
function processJoinWhereKey(key: string): string {
  if (key === "$or" || key === "$and") {
    return key;
  }

  if (key.includes("$")) {
    const lastDollarIndex = key.lastIndexOf("$");
    const fieldPart = key.substring(0, lastDollarIndex);
    const operator = key.substring(lastDollarIndex);

    if (fieldPart.includes(".")) {
      const [tableName, fieldName] = fieldPart.split(".");
      return `${snakeCase(tableName)}.${snakeCase(fieldName)}${operator}`;
    }
    return `${snakeCase(fieldPart)}${operator}`;
  }

  if (key.includes(".")) {
    const [tableName, fieldName] = key.split(".");
    return `${snakeCase(tableName)}.${snakeCase(fieldName)}`;
  }

  return snakeCase(key);
}

/**
 * 递归处理联查 where 条件
 */
function processJoinWhere(where: any): any {
  if (!where || typeof where !== "object") return where;

  if (Array.isArray(where)) {
    return where.map((item) => processJoinWhere(item));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(where)) {
    const newKey = processJoinWhereKey(key);

    if (key === "$or" || key === "$and") {
      result[newKey] = (value as any[]).map((item) => processJoinWhere(item));
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[newKey] = processJoinWhere(value);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * 处理联查 orderBy
 */
function processJoinOrderBy(orderBy: string[]): string[] {
  if (!orderBy || !Array.isArray(orderBy)) return orderBy;
  return orderBy.map((item) => {
    if (typeof item !== "string" || !item.includes("#")) return item;
    const [field, direction] = item.split("#");
    return `${processJoinField(field.trim())}#${direction.trim()}`;
  });
}

// ============================================
// 测试用例
// ============================================

describe("DbHelper JOIN - processTableName", () => {
  test("普通表名转下划线", () => {
    expect(processTableName("userProfile")).toBe("user_profile");
    expect(processTableName("orderDetail")).toBe("order_detail");
    expect(processTableName("user")).toBe("user");
    expect(processTableName("order")).toBe("order");
  });
});

describe("DbHelper JOIN - processJoinField", () => {
  test("带表名的字段", () => {
    expect(processJoinField("order.userId")).toBe("order.user_id");
    expect(processJoinField("user.userName")).toBe("user.user_name");
    expect(processJoinField("order.createdAt")).toBe("order.created_at");
  });

  test("表名也转下划线", () => {
    expect(processJoinField("orderDetail.productId")).toBe("order_detail.product_id");
    expect(processJoinField("userProfile.avatarUrl")).toBe("user_profile.avatar_url");
  });

  test("普通字段（无表名）", () => {
    expect(processJoinField("userName")).toBe("user_name");
    expect(processJoinField("createdAt")).toBe("created_at");
  });

  test("带 AS 别名的字段", () => {
    expect(processJoinField("order.totalAmount AS total")).toBe("order.total_amount AS total");
    expect(processJoinField("user.userName AS name")).toBe("user.user_name AS name");
    expect(processJoinField("product.name AS productName")).toBe("product.name AS productName");
  });

  test("函数字段保持原样", () => {
    expect(processJoinField("COUNT(*)")).toBe("COUNT(*)");
    expect(processJoinField("SUM(order.amount)")).toBe("SUM(order.amount)");
  });

  test("星号保持原样", () => {
    expect(processJoinField("*")).toBe("*");
  });

  test("已转义字段保持原样", () => {
    expect(processJoinField("`order`")).toBe("`order`");
  });
});

describe("DbHelper JOIN - processJoinWhereKey", () => {
  test("带表名的字段名", () => {
    expect(processJoinWhereKey("order.userId")).toBe("order.user_id");
    expect(processJoinWhereKey("user.userName")).toBe("user.user_name");
  });

  test("带表名和操作符的字段名", () => {
    expect(processJoinWhereKey("order.createdAt$gt")).toBe("order.created_at$gt");
    expect(processJoinWhereKey("user.status$in")).toBe("user.status$in");
    expect(processJoinWhereKey("order.amount$gte")).toBe("order.amount$gte");
  });

  test("普通字段带操作符", () => {
    expect(processJoinWhereKey("createdAt$gt")).toBe("created_at$gt");
    expect(processJoinWhereKey("userId$ne")).toBe("user_id$ne");
  });

  test("逻辑操作符保持原样", () => {
    expect(processJoinWhereKey("$or")).toBe("$or");
    expect(processJoinWhereKey("$and")).toBe("$and");
  });
});

describe("DbHelper JOIN - processJoinWhere", () => {
  test("简单条件", () => {
    const where = { "order.userId": 1, "order.state": 1 };
    const result = processJoinWhere(where);
    expect(result).toEqual({ "order.user_id": 1, "order.state": 1 });
  });

  test("带操作符的条件", () => {
    const where = { "order.createdAt$gt": 1000, "user.state$ne": 0 };
    const result = processJoinWhere(where);
    expect(result).toEqual({ "order.created_at$gt": 1000, "user.state$ne": 0 });
  });

  test("$or 条件", () => {
    const where = {
      $or: [{ "user.userName$like": "%test%" }, { "user.email$like": "%test%" }],
    };
    const result = processJoinWhere(where);
    expect(result).toEqual({
      $or: [{ "user.user_name$like": "%test%" }, { "user.email$like": "%test%" }],
    });
  });

  test("复杂嵌套条件", () => {
    const where = {
      "order.state": 1,
      "user.state": 1,
      $or: [{ "user.userName$like": "%test%" }, { "product.name$like": "%test%" }],
      "order.createdAt$gte": 1000,
    };
    const result = processJoinWhere(where);
    expect(result).toEqual({
      "order.state": 1,
      "user.state": 1,
      $or: [{ "user.user_name$like": "%test%" }, { "product.name$like": "%test%" }],
      "order.created_at$gte": 1000,
    });
  });
});

describe("DbHelper JOIN - processJoinOrderBy", () => {
  test("带表名的排序", () => {
    const orderBy = ["order.createdAt#DESC", "user.userName#ASC"];
    const result = processJoinOrderBy(orderBy);
    expect(result).toEqual(["order.created_at#DESC", "user.user_name#ASC"]);
  });

  test("普通排序", () => {
    const orderBy = ["createdAt#DESC"];
    const result = processJoinOrderBy(orderBy);
    expect(result).toEqual(["created_at#DESC"]);
  });

  test("无排序方向的保持原样", () => {
    const orderBy = ["id"];
    const result = processJoinOrderBy(orderBy);
    expect(result).toEqual(["id"]);
  });
});

describe("DbHelper JOIN - JoinOption 类型验证", () => {
  test("LEFT JOIN（默认）", () => {
    const join = { table: "user", on: "order.user_id = user.id" };
    expect(join.type).toBeUndefined();
    expect(join.table).toBe("user");
    expect(join.on).toBe("order.user_id = user.id");
  });

  test("INNER JOIN", () => {
    const join = { type: "inner" as const, table: "product", on: "order.product_id = product.id" };
    expect(join.type).toBe("inner");
  });

  test("RIGHT JOIN", () => {
    const join = {
      type: "right" as const,
      table: "category",
      on: "product.category_id = category.id",
    };
    expect(join.type).toBe("right");
  });
});

describe("DbHelper JOIN - 完整场景模拟", () => {
  test("订单列表联查参数处理", () => {
    // 模拟输入
    const options = {
      table: "order",
      joins: [
        { table: "user", on: "order.userId = user.id" },
        { table: "product", on: "order.productId = product.id" },
      ],
      fields: ["order.id", "order.totalAmount", "user.userName", "product.name AS productName"],
      where: {
        "order.state": 1,
        "user.state": 1,
        "order.createdAt$gte": 1701388800000,
      },
      orderBy: ["order.createdAt#DESC"],
    };

    // 处理表名
    const processedTable = processTableName(options.table);
    expect(processedTable).toBe("order");

    // 处理字段
    const processedFields = options.fields.map((f) => processJoinField(f));
    expect(processedFields).toEqual([
      "order.id",
      "order.total_amount",
      "user.user_name",
      "product.name AS productName",
    ]);

    // 处理 where
    const processedWhere = processJoinWhere(options.where);
    expect(processedWhere).toEqual({
      "order.state": 1,
      "user.state": 1,
      "order.created_at$gte": 1701388800000,
    });

    // 处理 orderBy
    const processedOrderBy = processJoinOrderBy(options.orderBy);
    expect(processedOrderBy).toEqual(["order.created_at#DESC"]);

    // 处理 joins
    const processedJoins = options.joins.map((j) => ({
      type: (j as any).type || "left",
      table: processTableName(j.table),
      on: j.on,
    }));
    expect(processedJoins).toEqual([
      { type: "left", table: "user", on: "order.userId = user.id" },
      { type: "left", table: "product", on: "order.productId = product.id" },
    ]);
  });
});
