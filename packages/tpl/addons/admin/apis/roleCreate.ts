import { Yes, No } from 'befly';
import adminRoleTable from '../tables/role.json';

/**
 * 创建角色
 */
export default {
    name: '创建角色',
    fields: {
        name: adminRoleTable.name,
        code: adminRoleTable.code,
        description: adminRoleTable.description,
        menus: adminRoleTable.menus,
        apis: adminRoleTable.apis,
        sort: adminRoleTable.sort,
        status: adminRoleTable.status
    },
    handler: async (befly, ctx) => {
        try {
            // 检查角色代码是否已存在
            const existing = await befly.db.getDetail({
                table: 'addon_admin_role',
                where: { code: ctx.body.code }
            });

            if (existing) {
                return No('角色代码已存在');
            }

            const roleId = await befly.db.insData({
                table: 'addon_admin_role',
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    description: ctx.body.description,
                    menus: ctx.body.menus || '',
                    apis: ctx.body.apis || '',
                    sort: ctx.body.sort,
                    status: ctx.body.status
                }
            });

            return Yes('操作成功', { id: roleId });
        } catch (error) {
            befly.logger.error('创建角色失败:', error);
            return No('操作失败');
        }
    }
};
