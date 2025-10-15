import { Api, Yes, No } from 'befly';

/**
 * 获取当前用户的菜单权限
 * 说明：
 * 1. 根据当前登录用户的角色，查询其可访问的菜单
 * 2. 返回树形结构的菜单数据
 * 3. 仅返回状态为启用的菜单
 */
export default Api('获取用户菜单', {
    method: 'GET',
    auth: true, // 需要登录
    handler: async (befly, ctx) => {
        try {
            // 获取当前登录用户ID
            const userId = ctx.user.id;

            // 1. 查询用户的所有角色
            const userRoles = await befly.db.getAll({
                table: 'addon_admin_admin_role',
                fields: ['role_id'],
                where: { admin_id: userId }
            });

            if (!userRoles || userRoles.length === 0) {
                return Yes('获取菜单成功', []);
            }

            const roleIds = userRoles.map((r: any) => r.role_id);

            // 2. 查询角色对应的所有菜单ID
            const roleMenus = await befly.db.getAll({
                table: 'addon_admin_role_menu',
                fields: ['menu_id'],
                where: {
                    role_id: { $in: roleIds }
                }
            });

            if (!roleMenus || roleMenus.length === 0) {
                return Yes('获取菜单成功', []);
            }

            // 去重菜单ID
            const menuIds = [...new Set(roleMenus.map((m: any) => m.menu_id))];

            // 3. 查询菜单详情（仅查询启用状态的菜单）
            const menus = await befly.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'name', 'path', 'icon', 'sort', 'pid', 'type', 'status'],
                where: {
                    id: { $in: menuIds },
                    status: 1
                },
                orderBy: [
                    { field: 'sort', direction: 'ASC' },
                    { field: 'id', direction: 'ASC' }
                ]
            });

            // 4. 构建树形结构
            const buildTree = (items: any[], pid = 0) => {
                const tree: any[] = [];
                for (const item of items) {
                    if (item.pid === pid) {
                        const children = buildTree(items, item.id);
                        const node: any = {
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
});
