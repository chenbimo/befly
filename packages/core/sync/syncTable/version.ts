/**
 * syncTable 数据库版本检查模块
 *
 * 包含：
 * - 数据库版本验证（MySQL/PostgreSQL/SQLite）
 */

import type { SQL } from "bun";

import { DB_VERSION_REQUIREMENTS, isMySQL, isPG, isSQLite } from "./constants.js";

/**
 * 数据库版本检查（按方言）
 *
 * 根据当前数据库类型检查版本是否符合最低要求：
 * - MySQL: >= 8.0
 * - PostgreSQL: >= 17
 * - SQLite: >= 3.50.0
 *
 * @param sql - SQL 客户端实例
 * @throws {Error} 如果数据库版本不符合要求或无法获取版本信息
 */
export async function ensureDbVersion(sql: SQL): Promise<void> {
    if (!sql) throw new Error("SQL 客户端未初始化");

    if (isMySQL()) {
        const r = await sql`SELECT VERSION() AS version`;
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 MySQL 版本信息");
        }
        const version = r[0].version;
        const majorVersion = parseInt(String(version).split(".")[0], 10);
        if (!Number.isFinite(majorVersion) || majorVersion < DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR) {
            throw new Error(`此脚本仅支持 MySQL ${DB_VERSION_REQUIREMENTS.MYSQL_MIN_MAJOR}.0+，当前版本: ${version}`);
        }
        return;
    }

    if (isPG()) {
        const r = await sql`SELECT version() AS version`;
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 PostgreSQL 版本信息");
        }
        const versionText = r[0].version;
        const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
        const major = m ? parseInt(m[1], 10) : NaN;
        if (!Number.isFinite(major) || major < DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR) {
            throw new Error(`此脚本要求 PostgreSQL >= ${DB_VERSION_REQUIREMENTS.POSTGRES_MIN_MAJOR}，当前: ${versionText}`);
        }
        return;
    }

    if (isSQLite()) {
        const r = await sql`SELECT sqlite_version() AS version`;
        if (!r || r.length === 0 || !r[0]?.version) {
            throw new Error("无法获取 SQLite 版本信息");
        }
        const version = r[0].version;
        // 强制最低版本：SQLite ≥ 3.50.0
        const [maj, min, patch] = String(version)
            .split(".")
            .map((v) => parseInt(v, 10) || 0);
        const vnum = maj * 10000 + min * 100 + patch; // 3.50.0 -> 35000
        if (!Number.isFinite(vnum) || vnum < DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION_NUM) {
            throw new Error(`此脚本要求 SQLite >= ${DB_VERSION_REQUIREMENTS.SQLITE_MIN_VERSION}，当前: ${version}`);
        }
        return;
    }
}
