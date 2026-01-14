import { describe, expect, it, mock } from "bun:test";

import { DbHelper } from "../lib/dbHelper.ts";
import { DbUtils } from "../lib/dbUtils.ts";

const DB_NAME = "test";

describe("DbHelper - autoId write", () => {
    it("insData(autoId): 不应写入 id，且应返回 lastInsertRowid", async () => {
        const genTimeID = mock(async () => 999);

        const originalBuildInsertRow = DbUtils.buildInsertRow;
        const builtRows: Array<Record<string, any>> = [];
        DbUtils.buildInsertRow = ((options: any) => {
            const row = originalBuildInsertRow(options as any);
            builtRows.push(row);
            return row;
        }) as any;

        const sqlMock = {
            unsafe: mock(async (sql: string, params?: unknown[]) => {
                return { lastInsertRowid: 123, changes: 1, sql: sql, params: params } as any;
            })
        };

        const dbHelper = new DbHelper({
            redis: { getObject: async () => null, setObject: async () => "OK", genTimeID: genTimeID } as any,
            dbName: DB_NAME,
            sql: sqlMock as any,
            idMode: "autoId"
        });

        try {
            const res = await dbHelper.insData({ table: "user", data: { name: "a" } } as any);

            expect(res.data).toBe(123);
            expect(genTimeID).toHaveBeenCalledTimes(0);

            expect(sqlMock.unsafe).toHaveBeenCalledTimes(1);
            const call = (sqlMock.unsafe as any).mock.calls[0];
            const sql = String(call[0]);

            expect(sql.includes("`id`")).toBe(false);
            expect(sql.includes("`created_at`")).toBe(true);
            expect(sql.includes("`updated_at`")).toBe(true);
            expect(sql.includes("`state`")).toBe(true);

            expect(builtRows.length).toBe(1);
            expect("id" in builtRows[0]).toBe(false);
        } finally {
            DbUtils.buildInsertRow = originalBuildInsertRow;
        }
    });

    it("insBatch(autoId): 不应写入 id，且应推导返回 ids", async () => {
        const genTimeID = mock(async () => 999);

        const originalBuildInsertRow = DbUtils.buildInsertRow;
        const builtRows: Array<Record<string, any>> = [];
        DbUtils.buildInsertRow = ((options: any) => {
            const row = originalBuildInsertRow(options as any);
            builtRows.push(row);
            return row;
        }) as any;

        const sqlMock = {
            unsafe: mock(async (sql: string, params?: unknown[]) => {
                return { lastInsertRowid: 10, changes: 2, sql: sql, params: params } as any;
            })
        };

        const dbHelper = new DbHelper({
            redis: { getObject: async () => null, setObject: async () => "OK", genTimeID: genTimeID } as any,
            dbName: DB_NAME,
            sql: sqlMock as any,
            idMode: "autoId"
        });

        try {
            const res = await dbHelper.insBatch("user", [{ name: "a" } as any, { name: "b" } as any]);

            expect(res.data).toEqual([10, 11]);
            expect(genTimeID).toHaveBeenCalledTimes(0);

            expect(sqlMock.unsafe).toHaveBeenCalledTimes(1);
            const call = (sqlMock.unsafe as any).mock.calls[0];
            const sql = String(call[0]);

            expect(sql.includes("`id`")).toBe(false);
            expect(sql.includes("`created_at`")).toBe(true);
            expect(sql.includes("`updated_at`")).toBe(true);
            expect(sql.includes("`state`")).toBe(true);

            expect(builtRows.length).toBe(2);
            expect("id" in builtRows[0]).toBe(false);
            expect("id" in builtRows[1]).toBe(false);
        } finally {
            DbUtils.buildInsertRow = originalBuildInsertRow;
        }
    });
});
