import { Api } from 'befly';

/**
 * 获取所有菜单列表
 * 说明：用于后台管理的菜单配置页面
 */
export default Api('获取菜单列表', {
    method: 'GET',
    auth: true,
    handler: async (befly, ctx) => {
        try {
            const menus = await befly.db.query(
                `SELECT id, name, path, icon, sort, pid, type, status, created_at, updated_at
                 FROM admin_menu
                 WHERE deleted_at IS NULL
                 ORDER BY sort ASC, id ASC`
            );

            return {
                ...befly.code.success,
                data: menus
            };
        } catch (error) {
            befly.logger.error('获取菜单列表失败:', error);
            return befly.code.fail;
        }
    }
});
