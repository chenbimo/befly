/**
 * 获取当前用户的菜单权限
 * 说明：
 * 1. 从 Redis 缓存读取所有菜单（如果缓存不存在则从数据库查询并缓存）
 * 2. 根据当前登录用户的角色过滤可访问的菜单
 * 3. 返回一维数组（由前端构建树形结构）
 * 4. 仅返回状态为启用的菜单
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

            if (!admin || !admin.roleCode) {
                return Yes('获取菜单成功', []);
            }

            // 2. 查询角色信息获取菜单权限（使用 roleCode 而非 roleId）
            const role = await befly.db.getOne({
                table: 'addon_admin_role',
                where: { code: admin.roleCode }
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

            // 4. 从 Redis 缓存读取所有菜单
            let allMenus = await befly.redis.getObject<any[]>('befly:menus:all');
            console.log('🔥[ allMenus ]-51', allMenus);

            // 如果缓存不存在，从数据库查询并缓存
            if (!allMenus || allMenus.length === 0) {
                befly.logger.info('菜单缓存未命中，从数据库查询');
                allMenus = await befly.db.getAll({
                    table: 'addon_admin_menu',
                    fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                    orderBy: ['sort#ASC', 'id#ASC']
                });

                // 回写缓存
                if (allMenus.length > 0) {
                    await befly.redis.setObject('befly:menus:all', allMenus);
                    befly.logger.info(`已缓存 ${allMenus.length} 个菜单到 Redis`);
                }
            } else {
                befly.logger.debug(`从 Redis 缓存读取 ${allMenus.length} 个菜单`);
                // JSON.parse 会保持数字类型，无需额外转换
            }

            // 5. 根据角色权限过滤菜单
            const menuIdSet = new Set(menuIds.map(String)); // 转为字符串 Set 方便比较
            const authorizedMenus = allMenus.filter((menu: any) => menuIdSet.has(String(menu.id)));

            // 6. 返回一维数组（由前端构建树形结构）
            return Yes('获取菜单成功', authorizedMenus);
        } catch (error) {
            befly.logger.error('获取用户菜单失败:', error);
            return No('获取菜单失败');
        }
    }
};
