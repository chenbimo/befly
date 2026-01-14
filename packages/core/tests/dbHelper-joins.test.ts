/**
 * DbHelper JOIN 功能测试
 * 测试多表联查相关功能（推荐使用表别名）
 */

import { describe, test, expect } from "bun:test";

import { DbUtils } from "../lib/dbUtils.ts";

describe("DbUtils tableRef - normalizeTableRef/getJoinMainQualifier", () => {
    test("普通表名转下划线（无 alias）", () => {
        expect(DbUtils.normalizeTableRef("userProfile")).toBe("user_profile");
        expect(DbUtils.normalizeTableRef("orderDetail")).toBe("order_detail");
        expect(DbUtils.normalizeTableRef("user")).toBe("user");
        expect(DbUtils.normalizeTableRef("order")).toBe("order");
    });

    test("带 alias 的 tableRef：只转换 schema/table，不改 alias", () => {
        expect(DbUtils.normalizeTableRef("UserProfile up")).toBe("user_profile up");
        expect(DbUtils.normalizeTableRef("myDb.UserProfile up")).toBe("my_db.user_profile up");
    });

    test("JOIN 主限定符：优先 alias", () => {
        expect(DbUtils.getJoinMainQualifier("order o")).toBe("o");
        expect(DbUtils.getJoinMainQualifier("userProfile")).toBe("user_profile");
    });
});

describe("DbHelper JOIN - processJoinField", () => {
    test("带表名的字段", () => {
        expect(DbUtils.processJoinField("o.userId")).toBe("o.user_id");
        expect(DbUtils.processJoinField("u.userName")).toBe("u.user_name");
        expect(DbUtils.processJoinField("o.createdAt")).toBe("o.created_at");
    });

    test("表/别名部分保持原样（JOIN 场景点号前通常是别名）", () => {
        expect(DbUtils.processJoinField("orderDetail.productId")).toBe("orderDetail.product_id");
        expect(DbUtils.processJoinField("userProfile.avatarUrl")).toBe("userProfile.avatar_url");
    });

    test("普通字段（无表名）", () => {
        expect(DbUtils.processJoinField("userName")).toBe("user_name");
        expect(DbUtils.processJoinField("createdAt")).toBe("created_at");
    });

    test("带 AS 别名的字段", () => {
        expect(DbUtils.processJoinField("o.totalAmount AS total")).toBe("o.total_amount AS total");
        expect(DbUtils.processJoinField("u.userName AS name")).toBe("u.user_name AS name");
        expect(DbUtils.processJoinField("p.name AS productName")).toBe("p.name AS productName");
    });

    test("函数字段应被禁止（请使用 selectRaw）", () => {
        let thrownError1: any = null;
        try {
            DbUtils.processJoinField("COUNT(*)");
        } catch (error: any) {
            thrownError1 = error;
        }
        expect(Boolean(thrownError1)).toBe(true);
        expect(String(thrownError1?.message || "")).toContain("字段包含函数/表达式");

        let thrownError2: any = null;
        try {
            DbUtils.processJoinField("SUM(o.amount)");
        } catch (error: any) {
            thrownError2 = error;
        }
        expect(Boolean(thrownError2)).toBe(true);
        expect(String(thrownError2?.message || "")).toContain("字段包含函数/表达式");
    });

    test("星号保持原样", () => {
        expect(DbUtils.processJoinField("*")).toBe("*");
    });

    test("已转义字段保持原样", () => {
        expect(DbUtils.processJoinField("`order`")).toBe("`order`");
    });
});

describe("DbHelper JOIN - processJoinWhereKey", () => {
    test("带表名的字段名", () => {
        expect(DbUtils.processJoinWhereKey("o.userId")).toBe("o.user_id");
        expect(DbUtils.processJoinWhereKey("u.userName")).toBe("u.user_name");
    });

    test("带表名和操作符的字段名", () => {
        expect(DbUtils.processJoinWhereKey("o.createdAt$gt")).toBe("o.created_at$gt");
        expect(DbUtils.processJoinWhereKey("u.status$in")).toBe("u.status$in");
        expect(DbUtils.processJoinWhereKey("o.amount$gte")).toBe("o.amount$gte");
    });

    test("普通字段带操作符", () => {
        expect(DbUtils.processJoinWhereKey("createdAt$gt")).toBe("created_at$gt");
        expect(DbUtils.processJoinWhereKey("userId$ne")).toBe("user_id$ne");
    });

    test("逻辑操作符保持原样", () => {
        expect(DbUtils.processJoinWhereKey("$or")).toBe("$or");
        expect(DbUtils.processJoinWhereKey("$and")).toBe("$and");
    });
});

describe("DbHelper JOIN - processJoinWhere", () => {
    test("简单条件", () => {
        const where = { "o.userId": 1, "o.state": 1 };
        const result = DbUtils.processJoinWhere(where);
        expect(result).toEqual({ "o.user_id": 1, "o.state": 1 });
    });

    test("带操作符的条件", () => {
        const where = { "o.createdAt$gt": 1000, "u.state$ne": 0 };
        const result = DbUtils.processJoinWhere(where);
        expect(result).toEqual({ "o.created_at$gt": 1000, "u.state$ne": 0 });
    });

    test("$or 条件", () => {
        const where = {
            $or: [{ "u.userName$like": "%test%" }, { "u.email$like": "%test%" }]
        };
        const result = DbUtils.processJoinWhere(where);
        expect(result).toEqual({
            $or: [{ "u.user_name$like": "%test%" }, { "u.email$like": "%test%" }]
        });
    });

    test("复杂嵌套条件", () => {
        const where = {
            "o.state": 1,
            "u.state": 1,
            $or: [{ "u.userName$like": "%test%" }, { "p.name$like": "%test%" }],
            "o.createdAt$gte": 1000
        };
        const result = DbUtils.processJoinWhere(where);
        expect(result).toEqual({
            "o.state": 1,
            "u.state": 1,
            $or: [{ "u.user_name$like": "%test%" }, { "p.name$like": "%test%" }],
            "o.created_at$gte": 1000
        });
    });
});

describe("DbHelper JOIN - processJoinOrderBy", () => {
    test("带表名的排序", () => {
        const orderBy = ["o.createdAt#DESC", "u.userName#ASC"];
        const result = DbUtils.processJoinOrderBy(orderBy);
        expect(result).toEqual(["o.created_at#DESC", "u.user_name#ASC"]);
    });

    test("普通排序", () => {
        const orderBy = ["createdAt#DESC"];
        const result = DbUtils.processJoinOrderBy(orderBy);
        expect(result).toEqual(["created_at#DESC"]);
    });

    test("无排序方向的保持原样", () => {
        const orderBy = ["id"];
        const result = DbUtils.processJoinOrderBy(orderBy);
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
            on: "product.category_id = category.id"
        };
        expect(join.type).toBe("right");
    });
});

describe("DbHelper JOIN - 完整场景模拟", () => {
    test("订单列表联查参数处理", () => {
        // 模拟输入
        const options = {
            table: "order o",
            joins: [
                { table: "user u", on: "o.user_id = u.id" },
                { table: "product p", on: "o.product_id = p.id" }
            ],
            fields: ["o.id", "o.totalAmount", "u.userName", "p.name AS productName"],
            where: {
                "o.state": 1,
                "u.state": 1,
                "o.createdAt$gte": 1701388800000
            },
            orderBy: ["o.createdAt#DESC"]
        };

        // 处理表名（tableRef 规范化）
        const processedTable = DbUtils.normalizeTableRef(options.table);
        expect(processedTable).toBe("order o");

        // 处理字段
        const processedFields = options.fields.map((f) => DbUtils.processJoinField(f));
        expect(processedFields).toEqual(["o.id", "o.total_amount", "u.user_name", "p.name AS productName"]);

        // 处理 where
        const processedWhere = DbUtils.processJoinWhere(options.where);
        expect(processedWhere).toEqual({
            "o.state": 1,
            "u.state": 1,
            "o.created_at$gte": 1701388800000
        });

        // 处理 orderBy
        const processedOrderBy = DbUtils.processJoinOrderBy(options.orderBy);
        expect(processedOrderBy).toEqual(["o.created_at#DESC"]);

        // 处理 joins
        const processedJoins = options.joins.map((j) => ({
            type: (j as any).type || "left",
            table: DbUtils.normalizeTableRef(j.table),
            on: j.on
        }));
        expect(processedJoins).toEqual([
            { type: "left", table: "user u", on: "o.user_id = u.id" },
            { type: "left", table: "product p", on: "o.product_id = p.id" }
        ]);
    });
});
