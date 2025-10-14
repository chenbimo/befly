import { Api } from 'befly';

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
                table: 'admin_role',
                order: 'sort ASC, id ASC'
            });

            return {
                ...befly.code.success,
                data: roles
            };
        } catch (error) {
            befly.logger.error('获取角色列表失败:', error);
            return befly.code.fail;
        }
    }
});
