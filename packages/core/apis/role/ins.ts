import { Yes, No } from '../../util.js';
import adminRoleTable from '../../tables/role.json';

/**
 * 创建角色
 */
export default {
    name: '创建角色',
    fields: adminRoleTable,
    handler: async (befly, ctx) => {
        // 检查角色代码是否已存在
        const existing = await befly.db.getOne({
            table: 'core_role',
            where: { code: ctx.body.code }
        });

        if (existing) {
            return No('角色代码已存在');
        }

        const roleId = await befly.db.insData({
            table: 'core_role',
            data: {
                name: ctx.body.name,
                code: ctx.body.code,
                description: ctx.body.description,
                menus: ctx.body.menus || '',
                apis: ctx.body.apis || '',
                sort: ctx.body.sort
                // state 由框架自动设置为 1
            }
        });

        // 增量缓存角色权限到 Redis Set
        await befly.cache.cacheRolePermissions(befly, ctx.body.code, ctx.body.apis || '');

        return Yes('操作成功', { id: roleId });
    }
};
