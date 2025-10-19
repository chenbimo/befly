/**
 * 获取当前用户的菜单权限
 * 说明：
 * 1. 根据当前登录用户的角色，查询其可访问的菜单
 * 2. 返回树形结构的菜单数据
 * 3. 仅返回状态为启用的菜单
 */

import { Yes, No } from 'befly';

export default {
    name: '获取用户菜单',
    handler: async (befly, ctx) => {
        try {
            // 获取当前登录用户ID
            const userId = ctx.user.id;

            // 1. 查询用户信息获取角色ID
            const admin = await befly.db.getOne({
                table: 'addon_admin_admin',
                where: { id: userId }
            });

            if (!admin || !admin.roleId) {
                return Yes('获取菜单成功', []);
            }

            // 2. 查询角色信息获取菜单权限
            const role = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { id: admin.roleId }
            });

            if (!role || !role.menus) {
                return Yes('获取菜单成功', []);
            }

            // 3. 解析菜单ID列表（逗号分隔的字符串）
            const menuIds = role.menus
                .split(',')
                .map((id: string) => parseInt(id.trim()))
                .filter((id: number) => !isNaN(id));

            if (menuIds.length === 0) {
                return Yes('获取菜单成功', []);
            }

            // 4. 查询菜单详情（仅查询启用状态的菜单）
            const menus = await befly.db.getAll({
                table: 'addon_admin_menu',
                where: {
                    id$in: menuIds,
                    status: 1
                },
                orderBy: ['sort#ASC', 'id#ASC']
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

            return Yes('获取菜单成功', menuTree);
        } catch (error) {
            befly.logger.error('获取用户菜单失败:', error);
            return No('获取菜单失败');
        }
    }
};
