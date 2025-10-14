import { Api } from 'befly';

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
            const userRoles = await befly.db.query(
                `SELECT ar.role_id
                 FROM admin_admin_role ar
                 WHERE ar.admin_id = ?
                 AND ar.deleted_at IS NULL`,
                [userId]
            );

            if (!userRoles || userRoles.length === 0) {
                return {
                    ...befly.code.success,
                    data: []
                };
            }

            const roleIds = userRoles.map((r: any) => r.role_id);

            // 2. 查询角色对应的所有菜单ID
            const roleMenus = await befly.db.query(
                `SELECT DISTINCT rm.menu_id
                 FROM admin_role_menu rm
                 WHERE rm.role_id IN (?)
                 AND rm.deleted_at IS NULL`,
                [roleIds]
            );

            if (!roleMenus || roleMenus.length === 0) {
                return {
                    ...befly.code.success,
                    data: []
                };
            }

            const menuIds = roleMenus.map((m: any) => m.menu_id);

            // 3. 查询菜单详情（仅查询启用状态的菜单）
            const menus = await befly.db.query(
                `SELECT id, name, path, icon, sort, pid, type, status
                 FROM admin_menu
                 WHERE id IN (?)
                 AND status = 1
                 AND deleted_at IS NULL
                 ORDER BY sort ASC, id ASC`,
                [menuIds]
            );

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

            return {
                ...befly.code.success,
                data: menuTree
            };
        } catch (error) {
            befly.logger.error('获取用户菜单失败:', error);
            return befly.code.fail;
        }
    }
});
