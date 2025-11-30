/**
 * 更新管理员信息
 */

import adminTable from '../../tables/admin.json';

export default {
    name: '更新管理员',
    fields: adminTable,
    required: ['id'],
    handler: async (befly, ctx) => {
        const { id, ...updateData } = ctx.body;

        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id }
        });

        if (!admin?.id) {
            return befly.tool.No('管理员不存在');
        }

        // 更新管理员信息
        await befly.db.updData({
            table: 'addon_admin_admin',
            data: updateData,
            where: { id }
        });

        return befly.tool.Yes('更新成功');
    }
};
