import { describe, expect, it, mock } from "bun:test";

import { MySqlDialect } from "../lib/dbDialect.ts";
import { DbHelper } from "../lib/dbHelper.ts";

function createRedisMock() {
    return {
        getObject: mock(async () => null),
        setObject: mock(async () => "OK"),
        genTimeID: mock(async () => 123)
    };
}

describe("DbHelper - envelope contract", () => {
    it("所有返回 DbResult 的公共方法都应返回 { data, sql }（含边界分支）", async () => {
        const sqlMock = {
            unsafe: mock(async (...args: any[]) => {
                const sqlStr = String(args[0] || "");

                if (sqlStr.startsWith("SHOW COLUMNS FROM")) {
                    return [{ Field: "id" }, { Field: "name" }, { Field: "count" }, { Field: "state" }, { Field: "deleted_at" }, { Field: "created_at" }, { Field: "updated_at" }];
                }

                if (sqlStr.includes("COUNT(*) as total")) {
                    return [{ total: 0 }];
                }

                if (sqlStr.includes("COUNT(*) as count")) {
                    return [{ count: 0 }];
                }

                if (sqlStr.includes("COUNT(1) as cnt")) {
                    return [{ cnt: 0 }];
                }

                if (sqlStr.startsWith("INSERT")) {
                    return { changes: 1, lastInsertRowid: 0 };
                }

                if (sqlStr.startsWith("UPDATE") || sqlStr.startsWith("DELETE")) {
                    return { changes: 1 };
                }

                return [{ ok: 1 }];
            })
        };

        const db = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const tableExistsRes = await db.tableExists("user");
        expect("data" in tableExistsRes).toBe(true);
        expect("sql" in tableExistsRes).toBe(true);

        const getCountRes = await db.getCount({ table: "user" });
        expect("data" in getCountRes).toBe(true);
        expect("sql" in getCountRes).toBe(true);

        const existsRes = await db.exists({ table: "user", where: { id: 1 } });
        expect("data" in existsRes).toBe(true);
        expect("sql" in existsRes).toBe(true);

        const getOneRes = await db.getOne({ table: "user", where: { id: 1 }, fields: ["id"] });
        expect("data" in getOneRes).toBe(true);
        expect("sql" in getOneRes).toBe(true);

        const getListRes = await db.getList({ table: "user", fields: ["id"], page: 1, limit: 10 });
        expect("data" in getListRes).toBe(true);
        expect("sql" in getListRes).toBe(true);
        expect(getListRes.data.total).toBe(0);
        expect(getListRes.sql.count).toBeTruthy();

        const getAllRes = await db.getAll({ table: "user", fields: ["id"] });
        expect("data" in getAllRes).toBe(true);
        expect("sql" in getAllRes).toBe(true);
        expect(getAllRes.data.total).toBe(0);
        expect(getAllRes.sql.count).toBeTruthy();

        const insBatchEmptyRes = await db.insBatch("user", []);
        expect("data" in insBatchEmptyRes).toBe(true);
        expect("sql" in insBatchEmptyRes).toBe(true);
        expect(insBatchEmptyRes.data.length).toBe(0);

        const delForceBatchEmptyRes = await db.delForceBatch("user", []);
        expect("data" in delForceBatchEmptyRes).toBe(true);
        expect("sql" in delForceBatchEmptyRes).toBe(true);
        expect(delForceBatchEmptyRes.data).toBe(0);

        const updBatchEmptyRes = await db.updBatch("user", []);
        expect("data" in updBatchEmptyRes).toBe(true);
        expect("sql" in updBatchEmptyRes).toBe(true);
        expect(updBatchEmptyRes.data).toBe(0);

        const updBatchNoFieldsRes = await db.updBatch("user", [{ id: 1, data: {} }]);
        expect("data" in updBatchNoFieldsRes).toBe(true);
        expect("sql" in updBatchNoFieldsRes).toBe(true);
        expect(updBatchNoFieldsRes.data).toBe(0);

        const insDataRes = await db.insData({ table: "user", data: { name: "a" } } as any);
        expect("data" in insDataRes).toBe(true);
        expect("sql" in insDataRes).toBe(true);
        expect(insDataRes.data).toBe(123);

        const updDataRes = await db.updData({ table: "user", data: { name: "b" }, where: { id: 1 } } as any);
        expect("data" in updDataRes).toBe(true);
        expect("sql" in updDataRes).toBe(true);

        const delDataRes = await db.delData({ table: "user", where: { id: 1 } } as any);
        expect("data" in delDataRes).toBe(true);
        expect("sql" in delDataRes).toBe(true);

        const delForceRes = await db.delForce({ table: "user", where: { id: 1 } } as any);
        expect("data" in delForceRes).toBe(true);
        expect("sql" in delForceRes).toBe(true);

        const disableRes = await db.disableData({ table: "user", where: { id: 1 } } as any);
        expect("data" in disableRes).toBe(true);
        expect("sql" in disableRes).toBe(true);

        const enableRes = await db.enableData({ table: "user", where: { id: 1 } } as any);
        expect("data" in enableRes).toBe(true);
        expect("sql" in enableRes).toBe(true);

        const getFieldValueRes = await db.getFieldValue({ table: "user", where: { id: 1 }, field: "id" } as any);
        expect("data" in getFieldValueRes).toBe(true);
        expect("sql" in getFieldValueRes).toBe(true);

        const incrementRes = await db.increment("user", "count", { id: 1 }, 1);
        expect("data" in incrementRes).toBe(true);
        expect("sql" in incrementRes).toBe(true);

        const decrementRes = await db.decrement("user", "count", { id: 1 }, 1);
        expect("data" in decrementRes).toBe(true);
        expect("sql" in decrementRes).toBe(true);

        const queryRes = await db.query("SELECT 1");
        expect("data" in queryRes).toBe(true);
        expect("sql" in queryRes).toBe(true);

        const unsafeRes = await db.unsafe("SELECT 1");
        expect("data" in unsafeRes).toBe(true);
        expect("sql" in unsafeRes).toBe(true);
    });
});
