import { Api } from 'befly';
import adminRoleTable from '../tables/role.json';

/**
 * 更新角色
 */
export default Api('更新角色', {
    method: 'POST',
    auth: true,
    fields: {
        id: '角色ID|number|1|999999999999999|null|1|null',
        name: adminRoleTable.name,
        code: adminRoleTable.code,
        description: adminRoleTable.description,
        sort: adminRoleTable.sort,
        status: adminRoleTable.status
    },
    handler: async (befly, ctx) => {
        try {
            // 检查角色代码是否被其他角色占用
            const existing = await befly.db.query('SELECT id FROM admin_role WHERE code = ? AND id != ? AND deleted_at IS NULL', [ctx.body.code, ctx.body.id]);

            if (existing && existing.length > 0) {
                return {
                    ...befly.code.fail,
                    msg: '角色代码已被其他角色使用'
                };
            }

            await befly.db.updData({
                table: 'admin_role',
                where: { id: ctx.body.id },
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    description: ctx.body.description,
                    sort: ctx.body.sort,
                    status: ctx.body.status
                }
            });

            return befly.code.success;
        } catch (error) {
            befly.logger.error('更新角色失败:', error);
            return befly.code.fail;
        }
    }
});
