import { Yes, No, Fields } from 'befly';
import adminRoleTable from '../tables/role.json';

/**
 * 更新角色
 */
export default {
    name: '更新角色',
    fields: {
        id: Fields._id,
        name: adminRoleTable.name,
        code: adminRoleTable.code,
        description: adminRoleTable.description,
        sort: adminRoleTable.sort,
        status: adminRoleTable.status
    },
    handler: async (befly, ctx) => {
        try {
            // 检查角色代码是否被其他角色占用
            const existing = await befly.db.getAll({
                table: 'addon_admin_role',
                fields: ['id'],
                where: {
                    code: ctx.body.code,
                    id: { $ne: ctx.body.id }
                }
            });

            if (existing.length > 0) {
                return No('角色代码已被其他角色使用');
            }

            await befly.db.updData({
                table: 'addon_admin_role',
                where: { id: ctx.body.id },
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    description: ctx.body.description,
                    sort: ctx.body.sort,
                    status: ctx.body.status
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('更新角色失败:', error);
            return No('操作失败');
        }
    }
};
