import { initBefly } from 'befly';

/**
 * 初始化菜单和权限测试数据
 * 说明：创建基础的角色、菜单和权限关系
 */
const befly = await initBefly();

try {
    console.log('开始初始化权限数据...');

    // 1. 创建超级管理员角色
    const adminRoleId = await befly.db.insData({
        table: 'admin_role',
        data: {
            name: '超级管理员',
            code: 'super_admin',
            description: '拥有所有权限',
            sort: 1,
            status: 1
        }
    });
    console.log('✅ 创建超级管理员角色:', adminRoleId);

    // 2. 创建普通管理员角色
    const normalRoleId = await befly.db.insData({
        table: 'admin_role',
        data: {
            name: '普通管理员',
            code: 'normal_admin',
            description: '基础权限',
            sort: 2,
            status: 1
        }
    });
    console.log('✅ 创建普通管理员角色:', normalRoleId);

    // 3. 创建菜单
    const menus = [
        {
            name: '首页',
            path: '/',
            icon: 'index',
            sort: 1,
            pid: 0,
            type: 1,
            status: 1
        },
        {
            name: '管理员管理',
            path: '/admin',
            icon: 'user',
            sort: 2,
            pid: 0,
            type: 1,
            status: 1
        },
        {
            name: '新闻管理',
            path: '/news',
            icon: 'news',
            sort: 3,
            pid: 0,
            type: 1,
            status: 1
        },
        {
            name: '系统管理',
            path: '/system',
            icon: 'system',
            sort: 4,
            pid: 0,
            type: 0, // 目录类型
            status: 1
        }
    ];

    const menuIds: number[] = [];
    for (const menu of menus) {
        const menuId = await befly.db.insData({
            table: 'admin_menu',
            data: menu
        });
        menuIds.push(menuId);
        console.log(`✅ 创建菜单: ${menu.name} (ID: ${menuId})`);
    }

    // 3.1 创建系统管理的子菜单
    const systemMenuId = menuIds[3]; // 系统管理的ID
    const subMenus = [
        {
            name: '菜单管理',
            path: '/system/menu',
            icon: 'ViewListIcon',
            sort: 1,
            pid: systemMenuId,
            type: 1,
            status: 1
        },
        {
            name: '角色管理',
            path: '/system/role',
            icon: 'UserIcon',
            sort: 2,
            pid: systemMenuId,
            type: 1,
            status: 1
        }
    ];

    const subMenuIds: number[] = [];
    for (const subMenu of subMenus) {
        const subMenuId = await befly.db.insData({
            table: 'admin_menu',
            data: subMenu
        });
        subMenuIds.push(subMenuId);
        menuIds.push(subMenuId);
        console.log(`✅ 创建子菜单: ${subMenu.name} (ID: ${subMenuId})`);
    }

    // 4. 为超级管理员分配所有菜单权限
    for (const menuId of menuIds) {
        await befly.db.insData({
            table: 'admin_role_menu',
            data: {
                roleId: adminRoleId,
                menuId: menuId
            }
        });
    }
    console.log('✅ 超级管理员已分配所有菜单权限');

    // 5. 为普通管理员只分配首页和管理员管理权限
    await befly.db.insData({
        table: 'admin_role_menu',
        data: {
            roleId: normalRoleId,
            menuId: menuIds[0] // 首页
        }
    });
    await befly.db.insData({
        table: 'admin_role_menu',
        data: {
            roleId: normalRoleId,
            menuId: menuIds[1] // 管理员管理
        }
    });
    console.log('✅ 普通管理员已分配基础权限');

    // 6. 查询所有管理员，为他们分配超级管理员角色
    const admins = await befly.db.query('SELECT id FROM admin_admin WHERE deleted_at IS NULL');

    if (admins && admins.length > 0) {
        for (const admin of admins) {
            // 先检查是否已有角色
            const existing = await befly.db.query('SELECT id FROM admin_admin_role WHERE admin_id = ? AND deleted_at IS NULL', [admin.id]);

            if (!existing || existing.length === 0) {
                await befly.db.insData({
                    table: 'admin_admin_role',
                    data: {
                        adminId: admin.id,
                        roleId: adminRoleId
                    }
                });
                console.log(`✅ 管理员 ${admin.id} 已分配超级管理员角色`);
            }
        }
    }

    console.log('\n🎉 权限数据初始化完成！');
    console.log('\n使用说明：');
    console.log('1. 登录后台管理系统');
    console.log('2. 菜单将根据用户角色动态显示');
    console.log('3. 超级管理员可以看到所有菜单');
    console.log('4. 普通管理员只能看到首页和管理员管理');

    process.exit(0);
} catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
}
