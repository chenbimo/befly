import { describe, expect, it, mock } from "bun:test";

import { MySqlDialect } from "../lib/dbDialect.ts";
import { DbHelper } from "../lib/dbHelper.ts";

describe("DbHelper.getOne/getDetail default object", () => {
    function createRedisMock() {
        return {
            getObject: mock(async () => null),
            setObject: mock(async () => "OK"),
            genTimeID: mock(async () => 123)
        };
    }

    it("getOne: 未命中时 data 应返回 {}（且不为 null）", async () => {
        const sqlMock = {
            unsafe: mock(async (...args: any[]) => {
                const sqlStr = String(args[0] || "");

                if (sqlStr.startsWith("SHOW COLUMNS FROM")) {
                    return [{ Field: "id" }, { Field: "state" }];
                }

                if (sqlStr.startsWith("SELECT")) {
                    return [];
                }

                return [];
            })
        };

        const db = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const res = await db.getOne<{ id?: number }>({ table: "user", where: { id: 999 }, fields: ["id"] });

        expect(res.data).toEqual({});
        expect(res.data).not.toBeNull();
        expect(res.data.id).toBeUndefined();
    });

    it("getDetail: 未命中时 data 应返回 {}（且不为 null）", async () => {
        const sqlMock = {
            unsafe: mock(async (...args: any[]) => {
                const sqlStr = String(args[0] || "");

                if (sqlStr.startsWith("SHOW COLUMNS FROM")) {
                    return [{ Field: "id" }, { Field: "state" }];
                }

                if (sqlStr.startsWith("SELECT")) {
                    return [];
                }

                return [];
            })
        };

        const db = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const res = await db.getDetail<{ id?: number }>({ table: "user", where: { id: 999 }, fields: ["id"] });

        expect(res.data).toEqual({});
        expect(res.data).not.toBeNull();
        expect(res.data.id).toBeUndefined();
    });
});
