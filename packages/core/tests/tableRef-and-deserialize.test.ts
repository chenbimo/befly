import { describe, expect, it, mock } from "bun:test";

import { MySqlDialect } from "../lib/dbDialect.ts";
import { DbHelper } from "../lib/dbHelper.ts";
import { DbUtils } from "../lib/dbUtils.ts";
import { SqlBuilder } from "../lib/sqlBuilder.ts";

describe("tableRef normalize + escape", () => {
    it("DbUtils.normalizeTableRef: 保留 alias，仅 snakeCase 表名", () => {
        expect(DbUtils.normalizeTableRef("UserProfile up")).toBe("user_profile up");
        expect(DbUtils.normalizeTableRef("order o")).toBe("order o");
    });

    it("SqlBuilder.from: 支持 table alias", () => {
        const sql = new SqlBuilder().select(["*"]).from("order o").toSelectSql().sql;
        expect(sql).toContain("FROM `order` o");
    });

    it("SqlBuilder.from: 支持 schema.table alias", () => {
        const sql = new SqlBuilder().select(["*"]).from("my_db.users u").toSelectSql().sql;
        expect(sql).toContain("FROM `my_db`.`users` u");
    });

    it("SqlBuilder.from: 复杂表引用要求显式 fromRaw", () => {
        expect(() => new SqlBuilder().select(["*"]).from("users u FORCE INDEX (idx_user)")).toThrow();
    });
});

describe("DbHelper.getList deserialize", () => {
    it("getList: 数组字段应被 DbUtils.deserializeArrayFields 反序列化", async () => {
        const sqlMock = {
            unsafe: mock(async (sql: string, _params?: any[]) => {
                if (sql.includes("COUNT(*) as total")) {
                    return [{ total: 1 }];
                }
                return [
                    {
                        id: "1",
                        tags: '["a","b"]',
                        state: 1,
                        created_at: 0,
                        updated_at: 0
                    }
                ];
            })
        };

        const redisMock = {
            getObject: mock(async () => null),
            setObject: mock(async () => "OK"),
            genTimeID: mock(async () => 1)
        };

        const dbHelper = new DbHelper({ redis: redisMock as any, sql: sqlMock as any, dialect: new MySqlDialect() });

        const result = await dbHelper.getList<{ id: number; tags: string[] }>({
            table: "users",
            fields: ["id", "tags"],
            where: {}
        });

        expect(result.data.total).toBe(1);
        expect(result.data.lists.length).toBe(1);
        expect(Array.isArray(result.data.lists[0].tags)).toBe(true);
        expect(result.data.lists[0].tags).toEqual(["a", "b"]);
    });
});
