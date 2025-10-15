import { Api, Yes, No } from 'befly';
import adminRoleTable from '../tables/role.json';

/**
 * 创建角色
 */
export default Api('创建角色', {
    method: 'POST',
    auth: true,
    fields: {
        name: adminRoleTable.name,
        code: adminRoleTable.code,
        description: adminRoleTable.description,
        sort: adminRoleTable.sort,
        status: adminRoleTable.status
    },
    handler: async (befly, ctx) => {
        try {
            // 检查角色代码是否已存在
            const existing = await befly.db.getDetail({
                table: 'admin_role',
                where: { code: ctx.body.code }
            });

            if (existing) {
                return No('角色代码已存在');
            }

            const roleId = await befly.db.insData({
                table: 'admin_role',
                data: ctx.body
            });

            return Yes('操作成功', { id: roleId });
        } catch (error) {
            befly.logger.error('创建角色失败:', error);
            return No('操作失败');
        }
    }
});
