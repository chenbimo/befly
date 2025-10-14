import { Api } from 'befly';

/**
 * 获取用户的角色
 */
export default Api('获取用户角色', {
    method: 'POST',
    auth: true,
    fields: {
        adminId: '用户ID|number|1|999999999999999|null|1|null'
    },
    handler: async (befly, ctx) => {
        try {
            const { adminId } = ctx.body;

            const roleIds = await befly.db.query('SELECT role_id FROM admin_admin_role WHERE admin_id = ? AND deleted_at IS NULL', [adminId]);

            const ids = roleIds ? roleIds.map((item: any) => item.role_id) : [];

            return {
                ...befly.code.success,
                data: ids
            };
        } catch (error) {
            befly.logger.error('获取用户角色失败:', error);
            return befly.code.fail;
        }
    }
});
