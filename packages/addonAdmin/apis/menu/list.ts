import { Yes, No } from 'befly';
export default {
    name: '获取菜单列表',
    handler: async (befly, ctx) => {
        try {
            const menus = await befly.db.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'name', 'path', 'icon', 'sort', 'pid', 'state', 'created_at', 'updated_at'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            return Yes('操作成功', menus);
        } catch (error) {
            befly.logger.error('获取菜单列表失败:', error);
            return No('操作失败');
        }
    }
};
