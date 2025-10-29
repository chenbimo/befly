/**
 * SyncDev 命令 - 同步开发者管理员到数据库
 * - 邮箱: dev@qq.com
 * - 姓名: 开发者
 * - 密码: 使用 bcrypt 加密
 * - 角色: roleCode=dev, roleType=admin
 * - 表名: core_admin
 */

import { Logger } from '../lib/logger.js';
import { Cipher } from '../lib/cipher.js';
import { Database } from '../lib/database.js';
import { Env } from '../config/env.js';

interface SyncDevOptions {
    plan?: boolean;
}

/**
 * SyncDev 命令主函数
 */
export async function syncDevCommand(options: SyncDevOptions = {}) {
    let dbConnected = false;

    try {
        if (options.plan) {
            Logger.info('[计划] 同步完成后将初始化/更新开发管理员账号（plan 模式不执行）');
            return;
        }

        if (!Env.DEV_PASSWORD || !Env.MD5_SALT) {
            Logger.warn('跳过开发管理员初始化：缺少 DEV_PASSWORD 或 MD5_SALT 配置');
            return;
        }

        Logger.info('开始同步开发管理员账号...\n');

        // 连接数据库（SQL + Redis）
        await Database.connect();
        dbConnected = true;

        const helper = Database.getDbHelper();

        // 检查 core_admin 表是否存在
        const existAdmin = await helper.tableExists('core_admin');
        if (!existAdmin) {
            Logger.warn('跳过开发管理员初始化：未检测到 core_admin 表');
            return;
        }

        // 检查 core_role 表是否存在
        const existRole = await helper.tableExists('core_role');
        if (!existRole) {
            Logger.warn('跳过开发管理员初始化：未检测到 core_role 表');
            return;
        }

        // 检查 core_menu 表是否存在
        const existMenu = await helper.tableExists('core_menu');
        if (!existMenu) {
            Logger.warn('跳过开发管理员初始化：未检测到 core_menu 表');
            return;
        }

        // 查询所有菜单 ID
        const allMenus = await helper.getAll({
            table: 'core_menu',
            fields: ['id']
        });

        if (!allMenus || !Array.isArray(allMenus)) {
            Logger.warn('查询菜单失败或菜单表为空');
            return;
        }

        const menuIds = allMenus.length > 0 ? allMenus.map((m: any) => m.id).join(',') : '';
        Logger.info(`查询到 ${allMenus.length} 个菜单，ID 列表: ${menuIds || '(空)'}`);

        // 查询所有接口 ID
        const existApi = await helper.tableExists('core_api');
        let apiIds = '';
        if (existApi) {
            const allApis = await helper.getAll({
                table: 'core_api',
                fields: ['id']
            });

            if (allApis && Array.isArray(allApis) && allApis.length > 0) {
                apiIds = allApis.map((a: any) => a.id).join(',');
                Logger.info(`查询到 ${allApis.length} 个接口，ID 列表: ${apiIds}`);
            } else {
                Logger.info('未查询到接口数据');
            }
        } else {
            Logger.info('接口表不存在，跳过接口权限配置');
        }

        // 查询或创建 dev 角色
        let devRole = await helper.getOne({
            table: 'core_role',
            where: { code: 'dev' }
        });

        if (devRole) {
            // 更新 dev 角色的菜单和接口权限
            await helper.updData({
                table: 'core_role',
                where: { code: 'dev' },
                data: {
                    name: '开发者角色',
                    description: '拥有所有菜单和接口权限的开发者角色',
                    menus: menuIds,
                    apis: apiIds
                }
            });
            Logger.info('dev 角色菜单和接口权限已更新');
        } else {
            // 创建 dev 角色
            const roleId = await helper.insData({
                table: 'core_role',
                data: {
                    name: '开发者角色',
                    code: 'dev',
                    description: '拥有所有菜单和接口权限的开发者角色',
                    menus: menuIds,
                    apis: apiIds,
                    sort: 0
                }
            });
            devRole = { id: roleId };
            Logger.info('dev 角色已创建');
        }

        // 使用 bcrypt 加密密码
        const hashed = await Cipher.hashPassword(Env.DEV_PASSWORD);

        // 准备开发管理员数据
        const devData = {
            name: '开发者',
            nickname: '开发者',
            email: 'dev@qq.com',
            username: 'dev',
            password: hashed,
            roleId: devRole.id,
            roleCode: 'dev',
            roleType: 'admin'
        };

        // 查询现有账号
        const existing = await helper.getOne({
            table: 'core_admin',
            where: { email: 'dev@qq.com' }
        });

        if (existing) {
            // 更新现有账号
            await helper.updData({
                table: 'core_admin',
                where: { email: 'dev@qq.com' },
                data: devData
            });
            Logger.info('✅ 开发管理员已更新：email=dev@qq.com, username=dev, roleCode=dev, roleType=admin');
        } else {
            // 插入新账号
            await helper.insData({
                table: 'core_admin',
                data: devData
            });
            Logger.info('✅ 开发管理员已初始化：email=dev@qq.com, username=dev, roleCode=dev, roleType=admin');
        }
    } catch (error: any) {
        Logger.error('开发管理员同步失败:', error);
        process.exit(1);
    } finally {
        if (dbConnected) {
            await Database.disconnectSql();
        }
    }
}
