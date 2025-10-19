#!/usr/bin/env bun
/**
 * 测试从 Redis 缓存读取菜单并按角色过滤
 */

import { initDatabase, closeDatabase } from 'befly';
import { RedisHelper } from 'befly/utils/redisHelper';

async function testAdminMenusWithCache() {
    const { helper } = await initDatabase({ max: 1 });

    try {
        console.log('=== 测试 adminMenus API（使用 Redis 缓存）===\n');

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

        // 4. 从 Redis 缓存读取所有菜单
        console.log('\n4. 从 Redis 缓存读取菜单:');
        let allMenus = await RedisHelper.getObject<any[]>('befly:menus:all');

        if (!allMenus || allMenus.length === 0) {
            console.log('   ⚠️ 缓存未命中，从数据库查询');
            allMenus = await helper.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort', 'status'],
                where: { status: 1 },
                orderBy: ['sort#ASC', 'id#ASC']
            });

            // 回写缓存
            if (allMenus.length > 0) {
                await RedisHelper.setObject('befly:menus:all', allMenus);
                console.log('   ✅ 已缓存', allMenus.length, '个菜单到 Redis');
            }
        } else {
            console.log('   ✅ 从 Redis 缓存读取', allMenus.length, '个菜单');
        }

        // 5. 根据角色权限过滤菜单
        console.log('\n5. 根据角色权限过滤菜单:');
        const menuIdSet = new Set(menuIds.map(String));
        const authorizedMenus = allMenus.filter((menu: any) => menuIdSet.has(String(menu.id)));
        console.log('   过滤后:', authorizedMenus.length, '个菜单');

        // 6. 构建树形结构
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

        const menuTree = buildTree(authorizedMenus);

        console.log('\n6. 构建树形结构:');
        console.log(JSON.stringify(menuTree, null, 2));

        console.log('\n✅ 测试完成！菜单数据从 Redis 缓存读取成功');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await closeDatabase();
    }
}

testAdminMenusWithCache();
