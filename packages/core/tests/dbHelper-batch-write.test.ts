import { describe, expect, it, mock } from "bun:test";

import { MySqlDialect } from "../lib/dbDialect.js";
import { DbHelper } from "../lib/dbHelper.js";

function createRedisMock() {
    return {
        getObject: async () => null,
        setObject: async () => "OK",
        genTimeID: async () => 1
    };
}

describe("DbHelper - batch write helpers", () => {
    it("delForceBatch: 空数组直接返回 0 且不执行 SQL", async () => {
        const sqlMock = {
            unsafe: mock(() => Promise.resolve({ changes: 0 }))
        };

        const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const changes = await (dbHelper as any).delForceBatch("addon_admin_api", []);

        expect(changes).toBe(0);
        expect(sqlMock.unsafe).toHaveBeenCalledTimes(0);
    });

    it("delForceBatch: 生成单条 DELETE ... IN 并执行一次", async () => {
        const sqlMock = {
            unsafe: mock(() => Promise.resolve({ changes: 2 }))
        };

        const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const changes = await (dbHelper as any).delForceBatch("addon_admin_api", [1, 2]);

        expect(changes).toBe(2);
        expect(sqlMock.unsafe).toHaveBeenCalledTimes(1);

        const call = (sqlMock.unsafe as any).mock.calls[0];
        expect(call[0]).toBe("DELETE FROM `addon_admin_api` WHERE `id` IN (?,?)");
        expect(call[1]).toEqual([1, 2]);
    });

    it("updBatch: 空数组直接返回 0 且不执行 SQL", async () => {
        const sqlMock = {
            unsafe: mock(() => Promise.resolve({ changes: 0 }))
        };

        const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const changes = await (dbHelper as any).updBatch("addon_admin_api", []);

        expect(changes).toBe(0);
        expect(sqlMock.unsafe).toHaveBeenCalledTimes(0);
    });

    it("updBatch: 生成单条 UPDATE + CASE 并执行一次", async () => {
        const sqlMock = {
            unsafe: mock(() => Promise.resolve({ changes: 2 }))
        };

        const dbHelper = new DbHelper({ redis: createRedisMock() as any, sql: sqlMock, dialect: new MySqlDialect() });

        const changes = await (dbHelper as any).updBatch("addon_admin_api", [
            { id: 1, data: { name: "A", routePath: "/api/a", addonName: "x" } },
            { id: 2, data: { name: "B", routePath: "/api/b", addonName: "y" } }
        ]);

        expect(changes).toBe(2);
        expect(sqlMock.unsafe).toHaveBeenCalledTimes(1);

        const call = (sqlMock.unsafe as any).mock.calls[0];
        const sql = String(call[0]);
        const params = call[1] as any[];

        expect(sql.startsWith("UPDATE `addon_admin_api` SET")).toBe(true);
        expect(sql.includes("`name` = CASE `id`")).toBe(true);
        expect(sql.includes("`route_path` = CASE `id`")).toBe(true);
        expect(sql.includes("`addon_name` = CASE `id`")).toBe(true);
        expect(sql.includes("`updated_at` = ?")).toBe(true);
        expect(sql.endsWith("WHERE `id` IN (?,?) AND `state` > 0")).toBe(true);

        // 参数数量应包含：每个字段 2 行 * (id,value) *3字段 => 12，+ updated_at 1，+ where ids 2 => 15
        expect(params.length).toBe(15);
        // 末尾两个参数是 where ids
        expect(params[params.length - 2]).toBe(1);
        expect(params[params.length - 1]).toBe(2);
    });
});
