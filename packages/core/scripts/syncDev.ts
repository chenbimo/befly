/**
 * 同步开发者管理员到数据库（使用 dbHelper）
 * - 邮箱: dev@qq.com
 * - 姓名: 开发者
 * - 密码: Crypto2.hmacMd5(Crypto2.md5(Env.DEV_PASSWORD), Env.MD5_SALT)
 * - 表名: addon_admin_admin
 */

import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { Crypto2 } from '../utils/crypto.js';
import { initDatabase, closeDatabase } from '../utils/database.js';

// CLI 参数类型
interface CliArgs {
    DRY_RUN: boolean;
}

// 解析命令行参数
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const CLI: CliArgs = { DRY_RUN: ARGV.includes('--plan') };

/**
 * 同步开发管理员账号（使用统一的 database 工具）
 * 表名: addon_admin_admin
 * 邮箱: dev@qq.com
 * 姓名: 开发者
 * @returns 是否成功
 */
export async function SyncDev(): Promise<boolean> {
    let dbInitialized = false;

    try {
        if (CLI.DRY_RUN) {
            Logger.info('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
            return true;
        }

        if (!Env.DEV_PASSWORD || !Env.MD5_SALT) {
            Logger.warn('跳过开发管理员初始化：缺少 DEV_PASSWORD 或 MD5_SALT 配置');
            return false;
        }

        // 初始化数据库连接（Redis + SQL + DbHelper）
        const { helper } = await initDatabase({ max: 1 });
        dbInitialized = true;

        // 检查 addon_admin_admin 表是否存在（使用 helper.query 执行元数据查询）
        const exist = await helper.query('SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1', [Env.DB_NAME || '', 'addon_admin_admin']);

        if (!exist || !exist[0] || Number(exist[0].cnt) === 0) {
            Logger.warn('跳过开发管理员初始化：未检测到 addon_admin_admin 表');
            return false;
        }

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
        // 清理资源：关闭所有数据库连接
        if (dbInitialized) {
            await closeDatabase();
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
