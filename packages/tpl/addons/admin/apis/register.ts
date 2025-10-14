/**
 * 管理员注册接口
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { RegisterRequest } from '../types';
import { Crypto2 } from 'befly/utils/crypto';
import adminTable from '../tables/admin.json';

export default Api('管理员注册', {
    method: 'POST',
    auth: false, // 公开接口
    fields: {
        name: adminTable.name,
        email: adminTable.email,
        password: adminTable.password
    },
    required: ['name', 'email', 'password'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const { name, email, password } = ctx.body as RegisterRequest;

        // 检查邮箱是否已存在
        const existingAdmin = await befly.db.getDetail({
            table: 'admin_admin',
            where: { email }
        });

        if (existingAdmin) {
            return No('该邮箱已被注册');
        }

        // 加密密码
        const hashedPassword = await Crypto2.hashPassword(password);

        // 创建管理员
        const adminId = await befly.db.insert({
            table: 'admin_admin',
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'user', // 默认为普通用户
                status: 1,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return Yes('注册成功', {
            id: adminId,
            name,
            email
        });
    }
});
