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
        menus: adminRoleTable.menus,
        apis: adminRoleTable.apis,
        sort: adminRoleTable.sort
        // state 需要禁用时传 2，启用时传 1
    },
    handler: async (befly, ctx) => {
        // 检查角色代码是否被其他角色占用
        const existing = await befly.db.getList({
            table: 'addon_admin_role',
            where: {
                code: ctx.body.code,
                id$ne: ctx.body.id
            }
        });

        if (existing.total > 0) {
            return No('角色代码已被其他角色使用');
        }

        await befly.db.updData({
            table: 'addon_admin_role',
            where: { id: ctx.body.id },
            data: {
                name: ctx.body.name,
                code: ctx.body.code,
                description: ctx.body.description,
                menus: ctx.body.menus || '',
                apis: ctx.body.apis || '',
                sort: ctx.body.sort
                // state 字段不在此处更新，需要禁用/启用时单独处理
            }
        });

        return Yes('操作成功');
    }
};
