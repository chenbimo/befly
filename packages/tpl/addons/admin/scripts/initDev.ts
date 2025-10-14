import { SqlHelper } from 'befly/utils/sqlHelper';
import { Crypto2 } from 'befly/utils/crypto';
import { Env } from 'befly/config/env';
import { createSqlClient } from 'befly/utils/dbHelper';

/**
 * 初始化开发者账号和权限
 * 说明：
 * 1. 创建 dev 开发者角色（拥有所有权限，用 * 表示）
 * 2. 创建 dev 管理员账号，密码为 dev
 * 3. 为 dev 管理员分配 dev 角色
 * 4. 为 dev 角色分配所有菜单权限
 */

// 创建数据库客户端
const SQL = await createSqlClient();
const mockBefly: any = { sql: SQL };
const db = new SqlHelper(mockBefly, SQL);

try {
    console.log('开始初始化开发者账号和权限...\n');

    // 1. 创建 dev 开发者角色
    console.log('=== 步骤 1: 创建开发者角色 ===');

    // 先检查是否已存在
    const existingRole = await db.query("SELECT id FROM admin_role WHERE code = 'dev' AND deleted_at = 0 LIMIT 1");

    let devRoleId: number;
    if (existingRole && existingRole.length > 0) {
        devRoleId = existingRole[0].id;
        console.log(`⏭️  开发者角色已存在 (ID: ${devRoleId})`);
    } else {
        devRoleId = await db.insData({
            table: 'admin_role',
            data: {
                name: '开发者',
                code: 'dev',
                description: '开发者角色，拥有所有权限（*）',
                sort: 0,
                status: 1
            }
        });
        console.log(`✅ 创建开发者角色 (ID: ${devRoleId})`);
    }

    // 2. 为 dev 角色分配所有菜单权限
    console.log('\n=== 步骤 2: 分配菜单权限 ===');

    // 获取所有菜单
    const allMenus = await db.query('SELECT id FROM admin_menu WHERE deleted_at = 0');

    if (allMenus && allMenus.length > 0) {
        // 先清除旧的权限分配
        await db.query('UPDATE admin_role_menu SET deleted_at = ? WHERE role_id = ? AND deleted_at = 0', [Date.now(), devRoleId]);

        // 分配所有菜单权限
        for (const menu of allMenus) {
            await db.insData({
                table: 'admin_role_menu',
                data: {
                    roleId: devRoleId,
                    menuId: menu.id
                }
            });
        }
        console.log(`✅ 已分配所有菜单权限 (${allMenus.length} 个)`);
    } else {
        console.log('⚠️  未找到菜单数据，请先运行 initMenu.ts');
    }

    // 3. 创建或更新 dev 管理员账号
    console.log('\n=== 步骤 3: 创建开发者账号 ===');

    // 密码加密：先 MD5，再 HMAC-MD5
    const devPassword = 'dev';
    const md5Password = Crypto2.md5(devPassword);
    const encryptedPassword = Crypto2.hmacMd5(md5Password, Env.MD5_SALT);

    // 先检查是否已存在
    const existingAdmin = await db.query("SELECT id FROM admin_admin WHERE name = 'dev' AND deleted_at = 0 LIMIT 1");

    let devAdminId: number;
    if (existingAdmin && existingAdmin.length > 0) {
        devAdminId = existingAdmin[0].id;
        // 更新密码
        await db.updData({
            table: 'admin_admin',
            where: { id: devAdminId },
            data: {
                password: encryptedPassword,
                status: 1
            }
        });
        console.log(`⏭️  开发者账号已存在，已更新密码 (ID: ${devAdminId})`);
    } else {
        devAdminId = await db.insData({
            table: 'admin_admin',
            data: {
                name: 'dev',
                nickname: '开发者',
                password: encryptedPassword,
                email: 'dev@example.com',
                phone: '13800138000',
                status: 1
            }
        });
        console.log(`✅ 创建开发者账号 (ID: ${devAdminId})`);
    }

    // 4. 为 dev 管理员分配 dev 角色
    console.log('\n=== 步骤 4: 分配角色 ===');

    // 先检查是否已有角色分配
    const existingRoleAssign = await db.query('SELECT id FROM admin_admin_role WHERE admin_id = ? AND role_id = ? AND deleted_at = 0 LIMIT 1', [devAdminId, devRoleId]);

    if (existingRoleAssign && existingRoleAssign.length > 0) {
        console.log(`⏭️  角色分配已存在，跳过`);
    } else {
        // 先清除旧的角色分配
        await db.query('UPDATE admin_admin_role SET deleted_at = ? WHERE admin_id = ? AND deleted_at = 0', [Date.now(), devAdminId]);

        // 分配新角色
        await db.insData({
            table: 'admin_admin_role',
            data: {
                adminId: devAdminId,
                roleId: devRoleId
            }
        });
        console.log(`✅ 已为 dev 管理员分配 dev 角色`);
    }

    // 5. 输出统计信息
    console.log('\n=== 初始化完成 ===');
    console.log('📋 开发者信息：');
    console.log(`  - 账号: dev`);
    console.log(`  - 密码: dev`);
    console.log(`  - 角色: 开发者 (拥有所有权限 *)`);
    console.log(`  - 菜单权限: ${allMenus?.length || 0} 个（全部）`);
    console.log(`  - 接口权限: * （全部）`);
    console.log('\n使用说明：');
    console.log('1. 使用 dev/dev 登录后台管理系统');
    console.log('2. 开发者账号拥有所有菜单和接口权限');
    console.log('3. 可以在后台管理中创建其他角色和管理员');

    await SQL.end();
    process.exit(0);
} catch (error) {
    console.error('❌ 初始化失败:', error);
    await SQL.end();
    process.exit(1);
}
