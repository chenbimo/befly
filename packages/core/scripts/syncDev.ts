/**
 * 同步开发者管理员到数据库（使用 sqlHelper）
 * - 邮箱: dev@qq.com
 * - 姓名: 开发者
 * - 密码: Crypto2.hmacMd5(Crypto2.md5(Env.DEV_PASSWORD), Env.MD5_SALT)
 * - 表名: addon_admin_admin
 */

import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { Crypto2 } from '../utils/crypto.js';
import { SqlHelper } from '../utils/sqlHelper.js';
import { createSqlClient } from '../utils/dbHelper.js';
import { Redis } from '../plugins/redis.js';
import type { BeflyContext } from '../types/befly.js';

// CLI 参数类型
interface CliArgs {
    DRY_RUN: boolean;
}

// 解析命令行参数
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const CLI: CliArgs = { DRY_RUN: ARGV.includes('--plan') };

/**
 * 执行 SQL 查询
 */
const exec = async (client: any, query: string, params: any[] = []): Promise<any> => {
    if (params && params.length > 0) {
        return await client.unsafe(query, params);
    }
    return await client.unsafe(query);
};

/**
 * 同步开发管理员账号（使用 sqlHelper）
 * 表名: addon_admin_admin
 * 邮箱: dev@qq.com
 * 姓名: 开发者
 * @param client 可选，复用已有 SQL 客户端；不传则内部创建与关闭
 * @returns 是否成功
 */
export async function SyncDev(client: any = null): Promise<boolean> {
    let ownClient = false;
    let redis: Redis | null = null;

    try {
        if (CLI.DRY_RUN) {
            Logger.info('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
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

        // 检查 addon_admin_admin 表是否存在（保留原始 SQL，元数据查询）
        const exist = await exec(client, 'SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1', [Env.DB_NAME || '', 'addon_admin_admin']);

        if (!exist || !exist[0] || Number(exist[0].cnt) === 0) {
            Logger.warn('跳过开发管理员初始化：未检测到 addon_admin_admin 表');
            return false;
        }

        // 初始化 Redis（用于生成 ID）
        redis = new Redis();
        await redis.init();

        // 创建最小化 befly 上下文
        const befly: BeflyContext = {
            redis: redis,
            db: null as any,
            tool: null as any,
            logger: null as any
        };

        // 创建 sqlHelper 实例
        const helper = new SqlHelper(befly, client);

        // 对密码进行双重加密
        const hashed = Crypto2.hmacMd5(Crypto2.md5(Env.DEV_PASSWORD), Env.MD5_SALT);

        // 准备开发管理员数据
        const devData = {
            name: '开发者',
            nickname: '开发者',
            email: 'dev@qq.com',
            username: 'dev',
            password: hashed,
            role: 'dev',
            roleType: 'admin' // 小驼峰，自动转换为 role_type
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'addon_admin_admin',
            where: { email: 'dev@qq.com' },
            fields: ['id']
        });

        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'addon_admin_admin',
                where: { email: 'dev@qq.com' },
                data: devData
            });
            Logger.info('开发管理员已更新：email=dev@qq.com, username=dev, role=dev, role_type=admin');
        } else {
            // 插入新账号
            await helper.insData({
                table: 'addon_admin_admin',
                data: devData
            });
            Logger.info('开发管理员已初始化：email=dev@qq.com, username=dev, role=dev, role_type=admin');
        }

        return true;
    } catch (error: any) {
        Logger.warn(`开发管理员初始化步骤出错：${error.message}`);
        return false;
    } finally {
        // 清理资源
        if (redis) {
            try {
                await redis.close();
            } catch (error: any) {
                Logger.warn('关闭 Redis 连接时出错:', error.message);
            }
        }

        if (ownClient && client) {
            try {
                await client.close();
            } catch (error: any) {
                Logger.warn('关闭数据库连接时出错:', error.message);
            }
        }
    }
}

/**
 * 允许直接运行该脚本
 */
if (import.meta.main) {
    SyncDev()
        .then((ok: boolean) => {
            if (CLI.DRY_RUN) {
                process.exit(0);
            }
            process.exit(ok ? 0 : 1);
        })
        .catch((err: Error) => {
            Logger.error('❌ 开发管理员同步失败:', err);
            process.exit(1);
        });
}
