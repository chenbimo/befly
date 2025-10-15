import { Api, Yes, No } from 'befly';

/**
 * 获取角色列表
 */
export default Api('获取角色列表', {
    method: 'POST',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        try {
            const roles = await befly.db.getList({
                table: 'addon_admin_role',
                order: 'sort ASC, id ASC'
            });

            return Yes('操作成功', roles);
        } catch (error) {
            befly.logger.error('获取角色列表失败:', error);
            return No('操作失败');
        }
    }
});
