import type { SqlValue } from "../types/common.ts";
import type { DbResult, SqlInfo } from "../types/database.ts";

import { beforeAll, describe, expect, test } from "bun:test";

import { SQL } from "bun";

import { SqlBuilder } from "../lib/sqlBuilder.ts";
import { SyncTable } from "../sync/syncTable.ts";
import { getDefaultDbConfig } from "./__testDbConfig.ts";

function toSqlParams(params?: unknown[]): SqlValue[] {
    if (!Array.isArray(params)) return [];

    const out: SqlValue[] = [];
    for (const p of params) {
        if (p === undefined) {
            out.push("undefined");
            continue;
        }

        if (p === null) {
            out.push(null);
            continue;
        }

        if (typeof p === "string" || typeof p === "number" || typeof p === "boolean") {
            out.push(p);
            continue;
        }

        if (p instanceof Date) {
            out.push(p);
            continue;
        }

        // 兜底：允许 JSON 对象/数组（用于 smoke 的最小适配器）
        if (typeof p === "object") {
            out.push(p as unknown as SqlValue);
            continue;
        }

        out.push(String(p));
    }

    return out;
}

function buildMySqlUrl(options: { host: string; port: number; username: string; password: string; database: string }): string {
    const user = encodeURIComponent(options.username);
    const pass = encodeURIComponent(options.password);
    const db = encodeURIComponent(options.database);

    return `mysql://${user}:${pass}@${options.host}:${options.port}/${db}`;
}

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

describe("smoke - mysql (real) - befly_test", () => {
    let host: string = "";
    let port: number = 0;
    let username: string = "";
    let password: string = "";

    // 清理兜底：测试启动时扫描并清理残留表（仅 befly_test 库）
    beforeAll(async () => {
        const dbConfig = await getDefaultDbConfig();

        host = String(dbConfig.host || "");
        port = Number(dbConfig.port || 0);
        username = String(dbConfig.username || "");
        password = String(dbConfig.password || "");

        if (!host || !Number.isFinite(port) || port < 1 || port > 65535 || !username) {
            throw new Error(`smoke - mysql (real) - befly_test: 默认 DB 配置不完整，host=${host}, port=${String(dbConfig.port)}, username=${username}`);
        }

        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        try {
            await sql.unsafe("SELECT 1 AS ok");

            const rows = await sql.unsafe("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME LIKE 'befly_smoke\\_%'");

            if (Array.isArray(rows)) {
                for (const row of rows) {
                    const name = typeof (row as any)?.name === "string" ? (row as any).name : "";
                    if (!name) continue;
                    if (!name.startsWith("befly_smoke_")) continue;

                    const quoted = SyncTable.quoteIdentifier(name);
                    await sql.unsafe(`DROP TABLE IF EXISTS ${quoted}`);
                }
            }
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("executeDDLSafely: 在真实 MySQL 中可在线优先，必要时可降级（固定 befly_test 库）", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        const tableName = `befly_smoke_${Date.now().toString(36)}`;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const colQuoted = SyncTable.quoteIdentifier("a");
        const idxQuoted = SyncTable.quoteIdentifier("idx_a");

        const db = {
            unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
                const start = Date.now();
                const p = toSqlParams(params);

                let data: unknown;
                if (p.length > 0) {
                    data = await sql.unsafe(sqlStr, p);
                } else {
                    data = await sql.unsafe(sqlStr);
                }

                return {
                    data: data as T,
                    sql: {
                        sql: sqlStr,
                        params: p,
                        duration: Date.now() - start
                    }
                };
            }
        };

        try {
            // 连接探活
            await sql.unsafe("SELECT 1 AS ok");

            // 固定只操作 befly_test 库：创建一个 MyISAM 表（常见会触发 INPLACE/LOCK=NONE 不兼容场景）
            await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            await sql.unsafe(`CREATE TABLE ${tableQuoted} (${colQuoted} BIGINT NOT NULL DEFAULT 0) ENGINE=MyISAM`);

            const ok = await SyncTable.executeDDLSafely(db, `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX ${idxQuoted} (${colQuoted})`);
            expect(ok).toBe(true);

            const indexCountRes = await db.unsafe<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME = ? AND INDEX_NAME = 'idx_a'", [tableName]);

            const c = Number(indexCountRes.data?.[0]?.c || 0);
            expect(c).toBeGreaterThan(0);
        } finally {
            try {
                await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            } catch {
                // noop
            }

            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("executeDDLSafely: INPLACE 不支持时应可降级并完成需要 COPY 的变更（ADD COLUMN ... FIRST）", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        const tableName = `befly_smoke_${Date.now().toString(36)}_copy`;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const aQuoted = SyncTable.quoteIdentifier("a");
        const bQuoted = SyncTable.quoteIdentifier("b");

        const db = {
            unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
                const start = Date.now();
                const p = toSqlParams(params);

                let data: unknown;
                if (p.length > 0) {
                    data = await sql.unsafe(sqlStr, p);
                } else {
                    data = await sql.unsafe(sqlStr);
                }

                return {
                    data: data as T,
                    sql: {
                        sql: sqlStr,
                        params: p,
                        duration: Date.now() - start
                    }
                };
            }
        };

        try {
            await sql.unsafe("SELECT 1 AS ok");

            await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            await sql.unsafe(`CREATE TABLE ${tableQuoted} (${aQuoted} BIGINT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

            // 关键：把列插入到 FIRST。该类操作通常不支持 INPLACE（需要 COPY / rebuild）。
            // 这里刻意指定 ALGORITHM=INPLACE 来触发“INPLACE 不支持”的路径，验证 executeDDLSafely 能自动降级并最终成功。
            const ok = await SyncTable.executeDDLSafely(db, `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, ADD COLUMN ${bQuoted} BIGINT NOT NULL DEFAULT 0 FIRST`);
            expect(ok).toBe(true);

            const rows = await db.unsafe<Array<{ name: string; pos: number }>>(
                "SELECT COLUMN_NAME AS name, ORDINAL_POSITION AS pos FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='befly_test' AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
                [tableName]
            );

            const firstName = String(rows.data?.[0]?.name || "").toLowerCase();
            const firstPos = Number(rows.data?.[0]?.pos || 0);
            const secondName = String(rows.data?.[1]?.name || "").toLowerCase();

            expect(firstPos).toBe(1);
            expect(firstName).toBe("b");
            expect(secondName).toBe("a");
        } finally {
            try {
                await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            } catch {
                // noop
            }

            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("executeDDLSafely: COPY 也失败时仍应能 strip 并在真实 MySQL 中成功执行（模拟 COPY 不支持）", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        const tableName = `befly_smoke_${Date.now().toString(36)}_strip`;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const colQuoted = SyncTable.quoteIdentifier("a");
        const idxQuoted = SyncTable.quoteIdentifier("idx_a");

        const calls: string[] = [];

        const db = {
            unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
                const sqlText = String(sqlStr);
                calls.push(sqlText);

                // 目的：确保会走到最后的 strip candidate，同时最终 SQL 仍在真实 MySQL 上执行。
                // 说明：这里是 smoke（真实 DB）测试，因此我们只“模拟”算法/锁不支持，让最后一次（无 ALGORITHM/LOCK）真正落库。
                if (sqlText.includes("ALGORITHM=INPLACE")) {
                    throw new Error("SQL执行失败: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY.");
                }
                if (sqlText.includes("ALGORITHM=COPY")) {
                    throw new Error("SQL执行失败: ALGORITHM=COPY is not supported for this operation.");
                }

                const start = Date.now();
                const p = toSqlParams(params);

                let data: unknown;
                if (p.length > 0) {
                    data = await sql.unsafe(sqlText, p);
                } else {
                    data = await sql.unsafe(sqlText);
                }

                return {
                    data: data as T,
                    sql: {
                        sql: sqlText,
                        params: p,
                        duration: Date.now() - start
                    }
                };
            }
        };

        try {
            await sql.unsafe("SELECT 1 AS ok");

            await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            await sql.unsafe(`CREATE TABLE ${tableQuoted} (${colQuoted} BIGINT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

            const ok = await SyncTable.executeDDLSafely(db, `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX ${idxQuoted} (${colQuoted})`);
            expect(ok).toBe(true);

            // 断言：确实经历了 INPLACE -> COPY -> strip
            expect(calls.length).toBe(3);
            expect(calls[0]?.includes("ALGORITHM=INPLACE")).toBe(true);
            expect(calls[1]?.includes("ALGORITHM=COPY")).toBe(true);
            expect(calls[2]?.includes("ALGORITHM=")).toBe(false);
            expect(calls[2]?.includes("LOCK=")).toBe(false);
            expect(calls[2]?.includes("ADD INDEX")).toBe(true);

            const indexCountRes = await sql.unsafe<Array<{ c: number }>>(
                "SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME = ? AND INDEX_NAME = 'idx_a'",
                [tableName]
            );
            const c = Number(indexCountRes?.[0]?.c || 0);
            expect(c).toBeGreaterThan(0);
        } finally {
            try {
                await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            } catch {
                // noop
            }

            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: 允许 CHAR -> VARCHAR 互转（固定 befly_test 库）", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        const tableName = `befly_smoke_${Date.now().toString(36)}_char_varchar`;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const idQuoted = SyncTable.quoteIdentifier("id");
        const createdAtQuoted = SyncTable.quoteIdentifier("created_at");
        const updatedAtQuoted = SyncTable.quoteIdentifier("updated_at");
        const deletedAtQuoted = SyncTable.quoteIdentifier("deleted_at");
        const stateQuoted = SyncTable.quoteIdentifier("state");
        const nameQuoted = SyncTable.quoteIdentifier("name");

        const db = {
            unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
                const start = Date.now();
                const p = toSqlParams(params);

                let data: unknown;
                if (p.length > 0) {
                    data = await sql.unsafe(sqlStr, p);
                } else {
                    data = await sql.unsafe(sqlStr);
                }

                return {
                    data: data as T,
                    sql: {
                        sql: sqlStr,
                        params: p,
                        duration: Date.now() - start
                    }
                };
            }
        };

        try {
            // 连接探活
            await sql.unsafe("SELECT 1 AS ok");

            // 构造一个“历史库”场景：name 使用 CHAR(10)
            await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            await sql.unsafe(
                `CREATE TABLE ${tableQuoted} (
                    ${idQuoted} BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
                    ${createdAtQuoted} BIGINT UNSIGNED NOT NULL DEFAULT 0,
                    ${updatedAtQuoted} BIGINT UNSIGNED NOT NULL DEFAULT 0,
                    ${deletedAtQuoted} BIGINT UNSIGNED NOT NULL DEFAULT 0,
                    ${stateQuoted} BIGINT UNSIGNED NOT NULL DEFAULT 1,
                    ${nameQuoted} CHAR(10) NOT NULL DEFAULT '' COMMENT '名称'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
            );

            await sql.unsafe(`INSERT INTO ${tableQuoted} (${nameQuoted}) VALUES ('abc')`);

            // 目标：按 befly 的 string 映射（VARCHAR(max)）同步为 varchar
            await SyncTable.modifyTable(db, "befly_test", tableName, {
                name: { name: "名称", type: "string", min: 0, max: 10, default: null, nullable: false, index: false, unique: false }
            });

            const colRes = await db.unsafe<Array<{ dataType: string; columnType: string }>>("SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME = ? AND COLUMN_NAME = 'name'", [tableName]);

            const dataType = String(colRes.data?.[0]?.dataType || "").toLowerCase();
            const columnType = String(colRes.data?.[0]?.columnType || "").toLowerCase();

            expect(dataType).toBe("varchar");
            expect(columnType).toContain("varchar(10)");

            const rows = await sql.unsafe(`SELECT ${nameQuoted} AS v FROM ${tableQuoted} LIMIT 1`);
            const v = String((rows as any)?.[0]?.v ?? "");
            expect(v).toBe("abc");
        } finally {
            try {
                await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            } catch {
                // noop
            }

            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });
});
