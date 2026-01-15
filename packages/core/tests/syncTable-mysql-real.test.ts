import type { SqlValue } from "../types/common.ts";
import type { DbResult, SqlInfo } from "../types/database.ts";
import type { FieldDefinition } from "../types/validate.ts";

import { beforeAll, describe, expect, test } from "bun:test";

import { SQL } from "bun";

import { SyncTable } from "../sync/syncTable.ts";
import { getDefaultDbConfig } from "./__testDbConfig.ts";

const DB_NAME = "befly_test";
const TABLE_PREFIX = "befly_sync_";

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

        if (typeof p === "object") {
            out.push(p as SqlValue);
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

function buildTableName(tag: string): string {
    const safeTag = String(tag).replace(/[^a-zA-Z0-9_]+/g, "_");
    return `${TABLE_PREFIX}${Date.now().toString(36)}_${safeTag}`;
}

function createExecutor(sql: SQL) {
    return {
        unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
            const start = Date.now();
            const p = toSqlParams(params);

            let data: unknown;
            if (p.length > 0) {
                data = await sql.unsafe(sqlStr, p);
            } else {
                data = await sql.unsafe(sqlStr);
            }

            const end = Date.now();

            return {
                data: data as T,
                sql: {
                    sql: sqlStr,
                    params: p,
                    duration: end - start
                }
            };
        }
    };
}

async function cleanupTables(sql: SQL): Promise<number> {
    const rows = await sql.unsafe("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?", [DB_NAME, `${TABLE_PREFIX}%`]);

    if (!Array.isArray(rows)) return 0;

    let droppedCount = 0;

    for (const row of rows) {
        const name = typeof (row as any)?.name === "string" ? (row as any).name : "";
        if (!name || !name.startsWith(TABLE_PREFIX)) continue;
        const quoted = SyncTable.quoteIdentifier(name);
        await sql.unsafe(`DROP TABLE IF EXISTS ${quoted}`);
        droppedCount = droppedCount + 1;
    }

    return droppedCount;
}

describe("syncTable - mysql (real) - befly_test", () => {
    let host: string = "";
    let port: number = 0;
    let username: string = "";
    let password: string = "";

    beforeAll(async () => {
        const dbConfig = await getDefaultDbConfig();

        host = String(dbConfig.host || "");
        port = Number(dbConfig.port || 0);
        username = String(dbConfig.username || "");
        password = String(dbConfig.password || "");

        if (!host || !Number.isFinite(port) || port < 1 || port > 65535 || !username) {
            throw new Error(`syncTable - mysql (real) - befly_test: 默认 DB 配置不完整，host=${host}, port=${String(dbConfig.port)}, username=${username}`);
        }

        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        try {
            await sql.unsafe("SELECT 1 AS ok");
            const dropped = await cleanupTables(sql);
            expect(dropped).toBeGreaterThanOrEqual(0);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("createTable: 列与索引应完整", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("create_table");

        const fields: Record<string, FieldDefinition> = {
            name: { name: "名称", type: "varchar", input: "string", max: 50, default: null, unique: false, nullable: false, unsigned: false, index: true },
            age: { name: "年龄", type: "bigint", input: "number", max: null, default: 0, unique: false, nullable: false, unsigned: true, index: false },
            bio: { name: "简介", type: "mediumtext", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false },
            tags: { name: "标签", type: "varchar", input: "array", max: 30, default: null, unique: false, nullable: false, unsigned: false, index: false },
            notes: { name: "备注", type: "mediumtext", input: "array", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false },
            eventAt: { name: "事件时间", type: "datetime", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        try {
            await SyncTable.createTable(db, tableName, fields);

            const columns = await db.unsafe<Array<{ name: string; dataType: string; columnType: string; isNullable: string; defaultValue: unknown }>>(
                "SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
                [DB_NAME, tableName]
            );

            const byName: Record<string, { dataType: string; columnType: string; isNullable: string; defaultValue: unknown }> = {};
            for (const row of columns.data) {
                byName[row.name] = { dataType: row.dataType, columnType: row.columnType, isNullable: row.isNullable, defaultValue: row.defaultValue };
            }

            expect(String(byName.name.columnType).toLowerCase()).toContain("varchar(50)");
            expect(byName.name.isNullable).toBe("NO");
            expect(String(byName.name.defaultValue)).toBe("");

            expect(String(byName.age.columnType).toLowerCase()).toContain("bigint");
            expect(String(byName.age.columnType).toLowerCase()).toContain("unsigned");
            expect(String(byName.age.defaultValue)).toBe("0");

            expect(String(byName.bio.dataType).toLowerCase()).toBe("mediumtext");
            expect(byName.bio.isNullable).toBe("YES");
            expect(byName.bio.defaultValue).toBe(null);

            expect(String(byName.tags.columnType).toLowerCase()).toContain("varchar(30)");
            expect(String(byName.tags.defaultValue)).toBe("[]");

            expect(String(byName.notes.dataType).toLowerCase()).toBe("mediumtext");
            expect(byName.notes.defaultValue).toBe(null);

            expect(String(byName.event_at.dataType).toLowerCase()).toBe("datetime");
            expect(byName.event_at.defaultValue).toBe(null);

            const indexes = await db.unsafe<Array<{ indexName: string; columnName: string }>>("SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [DB_NAME, tableName]);

            const indexMap: Record<string, string[]> = {};
            for (const row of indexes.data) {
                if (!indexMap[row.indexName]) indexMap[row.indexName] = [];
                indexMap[row.indexName].push(row.columnName);
            }

            expect(indexMap.idx_created_at).toEqual(["created_at"]);
            expect(indexMap.idx_updated_at).toEqual(["updated_at"]);
            expect(indexMap.idx_state).toEqual(["state"]);
            expect(indexMap.idx_name).toEqual(["name"]);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: 字段增改与索引增删", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("modify_table");
        const initialFields: Record<string, FieldDefinition> = {
            name: { name: "名称", type: "varchar", input: "string", max: 20, default: null, unique: false, nullable: false, unsigned: false, index: true },
            age: { name: "年龄", type: "bigint", input: "number", max: null, default: 0, unique: false, nullable: false, unsigned: true, index: false },
            note: { name: "备注", type: "mediumtext", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        const updatedFields: Record<string, FieldDefinition> = {
            name: { name: "名称", type: "varchar", input: "string", max: 100, default: null, unique: false, nullable: false, unsigned: false, index: false },
            age: { name: "年龄", type: "bigint", input: "number", max: null, default: 1, unique: false, nullable: true, unsigned: true, index: false },
            note: { name: "备注", type: "mediumtext", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false },
            status: { name: "状态", type: "varchar", input: "string", max: 10, default: "ok", unique: false, nullable: false, unsigned: false, index: true }
        };

        try {
            await SyncTable.createTable(db, tableName, initialFields);
            await SyncTable.modifyTable(db, DB_NAME, tableName, updatedFields);

            const columns = await db.unsafe<Array<{ name: string; columnType: string; isNullable: string; defaultValue: unknown }>>(
                "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
                [DB_NAME, tableName]
            );

            const byName: Record<string, { columnType: string; isNullable: string; defaultValue: unknown }> = {};
            for (const row of columns.data) {
                byName[row.name] = { columnType: row.columnType, isNullable: row.isNullable, defaultValue: row.defaultValue };
            }

            expect(String(byName.name.columnType).toLowerCase()).toContain("varchar(100)");
            expect(byName.age.isNullable).toBe("YES");
            expect(String(byName.age.defaultValue)).toBe("1");
            expect(String(byName.status.columnType).toLowerCase()).toContain("varchar(10)");
            expect(String(byName.status.defaultValue)).toBe("ok");

            const indexes = await db.unsafe<Array<{ indexName: string; columnName: string }>>("SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [DB_NAME, tableName]);

            const indexMap: Record<string, string[]> = {};
            for (const row of indexes.data) {
                if (!indexMap[row.indexName]) indexMap[row.indexName] = [];
                indexMap[row.indexName].push(row.columnName);
            }

            expect(indexMap.idx_name).toBeUndefined();
            expect(indexMap.idx_status).toEqual(["status"]);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: INT -> BIGINT 允许", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("int_to_bigint");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);

        const fields: Record<string, FieldDefinition> = {
            count: { name: "数量", type: "bigint", input: "number", max: null, default: 0, unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await db.unsafe(`CREATE TABLE ${tableQuoted} (\n` + "`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,\n" + "`count` INT NOT NULL DEFAULT 0\n" + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

            await SyncTable.modifyTable(db, DB_NAME, tableName, fields);

            const columns = await db.unsafe<Array<{ dataType: string; columnType: string }>>("SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'count'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.dataType || "").toLowerCase()).toBe("bigint");
            expect(String(columns.data[0]?.columnType || "").toLowerCase()).toContain("bigint");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: DATETIME <-> BIGINT 禁止", async () => {
        const existingColumn = {
            type: "datetime",
            columnType: "datetime",
            max: null,
            nullable: true,
            defaultValue: null,
            comment: null
        };

        const fieldDef: FieldDefinition = {
            name: "事件时间",
            type: "bigint",
            input: "number",
            max: null,
            default: 0,
            unique: false,
            nullable: true,
            unsigned: false,
            index: false
        };

        const changes = SyncTable.compareFieldDefinition(existingColumn, fieldDef);
        const typeChange = changes.find((item) => item.type === "datatype");

        expect(typeChange).toBeDefined();
        expect(SyncTable.isCompatibleTypeChange(String(typeChange?.current || ""), String(typeChange?.expected || ""))).toBe(false);
    });

    test("modifyTable: array_number 类型与默认值", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("array_number");

        const fields: Record<string, FieldDefinition> = {
            nums: { name: "数值数组", type: "varchar", input: "array_number", max: 12, default: null, unique: false, nullable: false, unsigned: false, index: false },
            numsText: { name: "数值数组长文", type: "mediumtext", input: "array_number", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        try {
            await SyncTable.createTable(db, tableName, fields);

            const columns = await db.unsafe<Array<{ name: string; columnType: string; dataType: string; defaultValue: unknown }>>(
                "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType, DATA_TYPE AS dataType, COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
                [DB_NAME, tableName]
            );

            const byName: Record<string, { columnType: string; dataType: string; defaultValue: unknown }> = {};
            for (const row of columns.data) {
                byName[row.name] = { columnType: row.columnType, dataType: row.dataType, defaultValue: row.defaultValue };
            }

            expect(String(byName.nums.dataType).toLowerCase()).toBe("varchar");
            expect(String(byName.nums.columnType).toLowerCase()).toContain("varchar(12)");
            expect(String(byName.nums.defaultValue)).toBe("[]");
            expect(String(byName.nums_text.dataType).toLowerCase()).toBe("mediumtext");
            expect(String(byName.nums_text.columnType).toLowerCase()).toBe("mediumtext");
            expect(byName.nums_text.defaultValue).toBe(null);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: 默认值 null -> 有值", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("default_change");
        const initialFields: Record<string, FieldDefinition> = {
            status: { name: "状态", type: "varchar", input: "string", max: 10, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        const updatedFields: Record<string, FieldDefinition> = {
            status: { name: "状态", type: "varchar", input: "string", max: 10, default: "ok", unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await SyncTable.createTable(db, tableName, initialFields);
            await SyncTable.modifyTable(db, DB_NAME, tableName, updatedFields);

            const columns = await db.unsafe<Array<{ defaultValue: unknown }>>("SELECT COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'status'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.defaultValue)).toBe("ok");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: nullable true -> false", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("nullable_change");

        const initialFields: Record<string, FieldDefinition> = {
            title: { name: "标题", type: "varchar", input: "string", max: 40, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        const updatedFields: Record<string, FieldDefinition> = {
            title: { name: "标题", type: "varchar", input: "string", max: 40, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await SyncTable.createTable(db, tableName, initialFields);
            await SyncTable.modifyTable(db, DB_NAME, tableName, updatedFields);

            const columns = await db.unsafe<Array<{ isNullable: string }>>("SELECT IS_NULLABLE AS isNullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'title'", [DB_NAME, tableName]);

            expect(columns.data[0]?.isNullable).toBe("NO");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: 索引从无 -> 有", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("index_add");

        const initialFields: Record<string, FieldDefinition> = {
            title: { name: "标题", type: "varchar", input: "string", max: 30, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        const updatedFields: Record<string, FieldDefinition> = {
            title: { name: "标题", type: "varchar", input: "string", max: 30, default: null, unique: false, nullable: false, unsigned: false, index: true }
        };

        try {
            await SyncTable.createTable(db, tableName, initialFields);
            await SyncTable.modifyTable(db, DB_NAME, tableName, updatedFields);

            const indexes = await db.unsafe<Array<{ indexName: string; columnName: string }>>("SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [DB_NAME, tableName]);

            const indexMap: Record<string, string[]> = {};
            for (const row of indexes.data) {
                if (!indexMap[row.indexName]) indexMap[row.indexName] = [];
                indexMap[row.indexName].push(row.columnName);
            }

            expect(indexMap.idx_title).toEqual(["title"]);
            expect(indexMap.idx_created_at).toEqual(["created_at"]);
            expect(indexMap.idx_updated_at).toEqual(["updated_at"]);
            expect(indexMap.idx_state).toEqual(["state"]);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: 索引从有 -> 无", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("index_drop");

        const initialFields: Record<string, FieldDefinition> = {
            code: { name: "编号", type: "varchar", input: "string", max: 40, default: null, unique: false, nullable: false, unsigned: false, index: true }
        };

        const updatedFields: Record<string, FieldDefinition> = {
            code: { name: "编号", type: "varchar", input: "string", max: 40, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await SyncTable.createTable(db, tableName, initialFields);
            await SyncTable.modifyTable(db, DB_NAME, tableName, updatedFields);

            const indexes = await db.unsafe<Array<{ indexName: string; columnName: string }>>("SELECT INDEX_NAME AS indexName, COLUMN_NAME AS columnName FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [DB_NAME, tableName]);

            const indexMap: Record<string, string[]> = {};
            for (const row of indexes.data) {
                if (!indexMap[row.indexName]) indexMap[row.indexName] = [];
                indexMap[row.indexName].push(row.columnName);
            }

            expect(indexMap.idx_code).toBeUndefined();
            expect(indexMap.idx_state).toEqual(["state"]);
            expect(indexMap.idx_created_at).toEqual(["created_at"]);
            expect(indexMap.idx_updated_at).toEqual(["updated_at"]);
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: TEXT -> MEDIUMTEXT 转换", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("text_family");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);

        const fields: Record<string, FieldDefinition> = {
            content: { name: "内容", type: "mediumtext", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        try {
            await db.unsafe(`CREATE TABLE ${tableQuoted} (\n` + "`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,\n" + "`content` TEXT NULL\n" + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

            await SyncTable.modifyTable(db, DB_NAME, tableName, fields);

            const columns = await db.unsafe<Array<{ dataType: string }>>("SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'content'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.dataType || "").toLowerCase()).toBe("mediumtext");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: LONGTEXT -> MEDIUMTEXT 转换", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("longtext_to_mediumtext");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);

        const fields: Record<string, FieldDefinition> = {
            content: { name: "内容", type: "mediumtext", input: "string", max: null, default: null, unique: false, nullable: true, unsigned: false, index: false }
        };

        try {
            await db.unsafe(`CREATE TABLE ${tableQuoted} (\n` + "`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,\n" + "`content` LONGTEXT NULL\n" + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

            await SyncTable.modifyTable(db, DB_NAME, tableName, fields);

            const columns = await db.unsafe<Array<{ dataType: string }>>("SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'content'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.dataType || "").toLowerCase()).toBe("mediumtext");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: CHAR -> VARCHAR", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("char_to_varchar");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);

        const fields: Record<string, FieldDefinition> = {
            code: { name: "编码", type: "varchar", input: "string", max: 8, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await db.unsafe(`CREATE TABLE ${tableQuoted} (\n` + "`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,\n" + "`code` CHAR(8) NOT NULL\n" + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

            await SyncTable.modifyTable(db, DB_NAME, tableName, fields);

            const columns = await db.unsafe<Array<{ columnType: string }>>("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'code'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.columnType || "").toLowerCase()).toContain("varchar(8)");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("modifyTable: VARCHAR -> CHAR 后可回到 VARCHAR", async () => {
        const url = buildMySqlUrl({ host: host, port: port, username: username, password: password, database: DB_NAME });
        const sql = new SQL({ url: url, max: 1, bigint: false });
        const db = createExecutor(sql);

        const tableName = buildTableName("varchar_char_varchar");
        const tableQuoted = SyncTable.quoteIdentifier(tableName);

        const fields: Record<string, FieldDefinition> = {
            code: { name: "编码", type: "varchar", input: "string", max: 6, default: null, unique: false, nullable: false, unsigned: false, index: false }
        };

        try {
            await db.unsafe(`CREATE TABLE ${tableQuoted} (\n` + "`id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,\n" + "`code` VARCHAR(6) NOT NULL\n" + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

            await db.unsafe(`ALTER TABLE ${tableQuoted} MODIFY COLUMN \`code\` CHAR(6) NOT NULL`);
            await SyncTable.modifyTable(db, DB_NAME, tableName, fields);

            const columns = await db.unsafe<Array<{ columnType: string }>>("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'code'", [DB_NAME, tableName]);

            expect(String(columns.data[0]?.columnType || "").toLowerCase()).toContain("varchar(6)");
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });
});
