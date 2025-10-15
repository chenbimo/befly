import { Api, Yes, No } from 'befly';

/**
 * 获取所有菜单列表
 * 说明：用于后台管理的菜单配置页面
 */
export default Api('获取菜单列表', {
    method: 'GET',
    auth: true,
    handler: async (befly, ctx) => {
        try {
            const menus = await befly.db.getAll({
                table: 'admin_menu',
                fields: ['id', 'name', 'path', 'icon', 'sort', 'pid', 'type', 'status', 'created_at', 'updated_at'],
                orderBy: [
                    { field: 'sort', direction: 'ASC' },
                    { field: 'id', direction: 'ASC' }
                ]
            });

            return Yes('操作成功', menus);
        } catch (error) {
            befly.logger.error('获取菜单列表失败:', error);
            return No('操作失败');
        }
    }
});
