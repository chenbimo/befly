/**
 * 添加管理员
 */

import { Yes, No, Field, Cipher } from 'befly';
import adminTable from '../tables/admin.json';

export default {
    name: '添加管理员',
    fields: adminTable,
    required: ['username', 'email', 'password'],
    handler: async (befly, ctx) => {
        // 检查用户名是否已存在
        if (ctx.body.username) {
            const existingByUsername = await befly.db.getOne({
                table: 'addon_admin_admin',
                where: { username: ctx.body.username }
            });

            if (existingByUsername) {
                return No('用户名已被使用');
            }
        }

        // 检查邮箱是否已存在
        const existingByEmail = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { email: ctx.body.email }
        });

        if (existingByEmail) {
            return No('邮箱已被使用');
        }

        // 加密密码
        const hashedPassword = await Cipher.hashPassword(ctx.body.password);

        // 创建管理员
        const adminId = await befly.db.insData({
            table: 'addon_admin_admin',
            data: {
                username: ctx.body.username,
                email: ctx.body.email,
                password: hashedPassword,
                name: ctx.body.name,
                nickname: ctx.body.nickname,
                phone: ctx.body.phone,
                roleId: ctx.body.roleId || 0,
                roleCode: ctx.body.roleCode || '',
                roleType: ctx.body.roleType || 'user'
            }
        });

        return Yes('添加成功', {
            id: adminId,
            username: ctx.body.username,
            email: ctx.body.email
        });
    }
};
