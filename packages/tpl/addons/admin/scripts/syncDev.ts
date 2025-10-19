/**
 * 同步开发者管理员到数据库（使用 dbHelper）
 * - 邮箱: dev@qq.com
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密
 * - 角色: roleCode=dev, roleType=admin
 * - 表名: addon_admin_admin
 */

import { Env, Logger, Crypto2, initDatabase, closeDatabase } from 'befly';

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
 * 用户名: dev
 * 姓名: 开发者
 * 角色: roleCode=dev, roleType=admin
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
        const existAdmin = await helper.tableExists('addon_admin_admin');
        if (!existAdmin) {
            Logger.warn('跳过开发管理员初始化：未检测到 addon_admin_admin 表');
            return false;
        }

        // 检查 addon_admin_role 表是否存在
        const existRole = await helper.tableExists('addon_admin_role');
        if (!existRole) {
            Logger.warn('跳过开发管理员初始化：未检测到 addon_admin_role 表');
            return false;
        }

        // 检查 addon_admin_menu 表是否存在
        const existMenu = await helper.tableExists('addon_admin_menu');
        if (!existMenu) {
            Logger.warn('跳过开发管理员初始化：未检测到 addon_admin_menu 表');
            return false;
        }

        // 查询所有菜单 ID
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id']
        });
        const menuIds = allMenus.map((m: any) => m.id).join(',');
        Logger.info(`查询到 ${allMenus.length} 个菜单，ID 列表: ${menuIds}`);

        // 查询或创建 dev 角色
        let devRole = await helper.getOne({
            table: 'addon_admin_role',
            where: { code: 'dev' }
        });

        if (devRole) {
            // 更新 dev 角色的菜单权限
            await helper.updData({
                table: 'addon_admin_role',
                where: { code: 'dev' },
                data: {
                    name: '开发者角色',
                    description: '拥有所有菜单权限的开发者角色',
                    menus: menuIds,
                    apis: '' // 接口权限暂时为空
                }
            });
            Logger.info('dev 角色菜单权限已更新');
        } else {
            // 创建 dev 角色
            const roleId = await helper.insData({
                table: 'addon_admin_role',
                data: {
                    name: '开发者角色',
                    code: 'dev',
                    description: '拥有所有菜单权限的开发者角色',
                    menus: menuIds,
                    apis: '', // 接口权限暂时为空
                    sort: 0
                }
            });
            devRole = { id: roleId };
            Logger.info('dev 角色已创建');
        }

        // 使用 bcrypt 加密密码（与登录验证一致）
        const hashed = await Crypto2.hashPassword(Env.DEV_PASSWORD);

        // 准备开发管理员数据
        const devData = {
            name: '开发者',
            nickname: '开发者',
            email: 'dev@qq.com',
            username: 'dev',
            password: hashed,
            roleId: devRole.id,
            roleCode: 'dev',
            roleType: 'admin' // 小驼峰，自动转换为 role_type
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'addon_admin_admin',
            where: { email: 'dev@qq.com' }
        });

        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'addon_admin_admin',
                where: { email: 'dev@qq.com' },
                data: devData
            });
            Logger.info('开发管理员已更新：email=dev@qq.com, username=dev, roleCode=dev, roleType=admin');
        } else {
            // 插入新账号
            await helper.insData({
                table: 'addon_admin_admin',
                data: devData
            });
            Logger.info('开发管理员已初始化：email=dev@qq.com, username=dev, roleCode=dev, roleType=admin');
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
