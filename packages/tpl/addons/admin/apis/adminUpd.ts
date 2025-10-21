/**
 * 更新管理员信息
 */

import { Yes, No, Fields } from 'befly';
import { Fields } from 'befly';
import adminTable from '../tables/admin.json';

export default {
    name: '更新管理员',
    fields: {
        id: Fields._id,
        name: adminTable.name,
        nickname: adminTable.nickname,
        email: adminTable.email,
        phone: adminTable.phone,
        state: Fields._state
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const { id, ...updateData } = ctx.body;

        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id }
        });

        if (!admin) {
            return No('管理员不存在');
        }

        // 如果更新邮箱，检查是否重复
        if (updateData.email && updateData.email !== admin.email) {
            const existingAdmin = await befly.db.getOne({
                table: 'addon_admin_admin',
                where: { email: updateData.email }
            });

            if (existingAdmin) {
                return No('邮箱已被使用');
            }
        }

        // 更新管理员信息
        await befly.db.updData({
            table: 'addon_admin_admin',
            data: updateData,
            where: { id }
        });

        return Yes('更新成功');
    }
};
