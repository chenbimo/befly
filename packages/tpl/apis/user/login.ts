/**
 * 用户登录接口 - TypeScript 示例
 */

import { No } from 'befly';

import { Crypto2 } from 'befly';
import { Jwt } from 'befly';

export default {
    name: '用户登录',
    auth: false, // 公开接口
    fields: {
        username: '用户名|string|3|50|null|0|^[a-zA-Z0-9_]+$',
        password: '密码|string|6|100|null|0|null'
    },
    required: ['username', 'password'],
    handler: async (befly, ctx) => {
        // 查询用户
        const user = await befly.db.getOne({
            table: 'user',
            where: { username: ctx.body.username }
        });

        if (!user) {
            return No('用户名或密码错误');
        }

        // 验证密码
        const isValid = await Crypto2.verifyPassword(ctx.body.password, user.password);
        if (!isValid) {
            return No('用户名或密码错误');
        }

        // 生成 JWT Token
        const token = await Jwt.sign(
            {
                userId: user.id.toString(),
                username: user.username,
                role: user.role
            },
            {
                expiresIn: '7d'
            }
        );

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = user;

        const response = {
            token,
            user: userWithoutPassword
        };

        return Yes('登录成功', response);
    }
};
