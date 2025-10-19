#!/usr/bin/env bun
/**
 * 测试 adminMenus API 的逻辑
 */

import { initDatabase, closeDatabase } from 'befly';

async function testAdminMenus() {
    const { helper } = await initDatabase({ max: 1 });

    try {
        // 模拟当前登录用户
        const userId = '1760695696283001'; // dev 管理员的 ID

        // 1. 查询用户信息获取角色ID
        const admin = await helper.getOne({
            table: 'addon_admin_admin',
            where: { id: userId }
        });

        console.log('1. 查询用户信息:');
        console.log('   roleId:', admin?.roleId);

        if (!admin || !admin.roleId) {
            console.log('   结果: 用户无角色，返回空菜单');
            return;
        }

        // 2. 查询角色信息获取菜单权限
        const role = await helper.getOne({
            table: 'addon_admin_role',
            where: { id: admin.roleId }
        });

        console.log('\n2. 查询角色信息:');
        console.log('   menus:', role?.menus);

        if (!role || !role.menus) {
            console.log('   结果: 角色无菜单权限，返回空菜单');
            return;
        }

        // 3. 解析菜单ID列表
        const menuIds = role.menus
            .split(',')
            .map((id: string) => parseInt(id.trim()))
            .filter((id: number) => !isNaN(id));

        console.log('\n3. 解析菜单ID:');
        console.log('   菜单ID数组:', menuIds);
        console.log('   共计:', menuIds.length, '个');

        if (menuIds.length === 0) {
            console.log('   结果: 无有效菜单ID，返回空菜单');
            return;
        }

        // 4. 查询菜单详情
        const menus = await helper.getAll({
            table: 'addon_admin_menu',
            where: {
                id$in: menuIds,
                status: 1
            },
            orderBy: ['sort#ASC', 'id#ASC']
        });

        console.log('\n4. 查询菜单详情:');
        console.log('   查询到:', menus.length, '个菜单');
        menus.forEach((m: any) => {
            console.log('   -', m.name, '(ID:', m.id, ', PID:', m.pid, ', Path:', m.path, ')');
        });

        // 5. 构建树形结构
        const buildTree = (items: any[], pid = 0) => {
            const tree: any[] = [];
            for (const item of items) {
                if (item.pid === pid) {
                    const children = buildTree(items, item.id);
                    const node = {
                        id: item.id,
                        name: item.name,
                        path: item.path,
                        icon: item.icon,
                        type: item.type,
                        sort: item.sort
                    };
                    if (children.length > 0) {
                        node.children = children;
                    }
                    tree.push(node);
                }
            }
            return tree;
        };

        const menuTree = buildTree(menus);

        console.log('\n5. 构建树形结构:');
        console.log(JSON.stringify(menuTree, null, 2));

        console.log('\n✅ 测试完成！菜单数据正常返回');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await closeDatabase();
    }
}

testAdminMenus();
