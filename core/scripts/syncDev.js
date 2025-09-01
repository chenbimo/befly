/**
 * 同步开发管理员账号脚本
 * - 账号: dev
 * - 密码: Crypto2.hmacMd5(Crypto2.md5(Env.DEV_PASSWORD), Env.MD5_SALT)
 * - 行为: 若存在则更新密码与 updated_at；不存在则插入新记录
 */

import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient } from '../utils/index.js';
import { Crypto2 } from '../utils/crypto.js';

// 命令行参数（保持与 syncDb.js 一致的 plan 行为）
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const CLI = { DRY_RUN: ARGV.includes('--plan') };

// 执行器封装
const exec = async (client, query, params = []) => {
    if (params && params.length > 0) return await client.unsafe(query, params);
    return await client.unsafe(query);
};

/**
 * 同步开发管理员账号
 * @param {import('bun').SQL | null} client 可选，复用已有 SQL 客户端；不传则内部创建与关闭
 */
export async function SyncDev(client = null) {
    let ownClient = false;
    try {
        if (CLI.DRY_RUN) {
            Logger.info('[计划] 同步完成后将初始化/更新 admin.dev 账号（plan 模式不执行）');
            return true;
        }

        if (!Env.DEV_PASSWORD || !Env.MD5_SALT) {
            Logger.warn('跳过开发管理员初始化：缺少 DEV_PASSWORD 或 MD5_SALT 配置');
            return false;
        }

        if (!client) {
            client = await createSqlClient({ max: 1 });
            ownClient = true;
        }

        // 检查 admin 表是否存在
        const [exist] = await exec(client, 'SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1', [Env.DB_NAME || '', 'admin']);
        if (!exist || Number(exist.cnt) === 0) {
            Logger.warn('跳过开发管理员初始化：未检测到 admin 表');
            return false;
        }

        const nowTs = Date.now();
        const hashed = Crypto2.hmacMd5(Crypto2.md5(Env.DEV_PASSWORD), Env.MD5_SALT);

        // 更新存在的 dev 账号
        const updateRes = await exec(client, 'UPDATE `admin` SET `password` = ?, `updated_at` = ? WHERE `account` = ? LIMIT 1', [hashed, nowTs, 'dev']);
        const affected = updateRes?.affectedRows ?? updateRes?.rowsAffected ?? 0;

        if (!affected || affected === 0) {
            // 插入新账号
            const id = nowTs;
            await exec(client, 'INSERT INTO `admin` (`id`, `created_at`, `updated_at`, `deleted_at`, `state`, `account`, `password`) VALUES (?, ?, ?, 0, 0, ?, ?)', [id, nowTs, nowTs, 'dev', hashed]);
            Logger.info('开发管理员已初始化：account=dev');
        } else {
            Logger.info('开发管理员已更新密码并刷新更新时间：account=dev');
        }

        return true;
    } catch (e) {
        Logger.warn(`开发管理员初始化步骤出错：${e.message}`);
        return false;
    } finally {
        if (ownClient && client) {
            try {
                await client.close();
            } catch (e) {
                Logger.warn('关闭数据库连接时出错:', e.message);
            }
        }
    }
}

// 允许直接运行该脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    SyncDev()
        .then((ok) => {
            if (CLI.DRY_RUN) {
                process.exit(0);
            }
            process.exit(ok ? 0 : 1);
        })
        .catch((err) => {
            console.error('❌ 开发管理员同步失败:', err);
            process.exit(1);
        });
}
