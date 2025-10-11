/**
 * 用户登录接口 - TypeScript 示例
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { LoginRequest, LoginResponse } from '../../../types/api';
import type { User } from '../../../types/models';
import { Crypto2 } from 'befly/utils/crypto';
import { Jwt } from 'befly/utils/jwt';

export default Api('用户登录', {
    method: 'POST',
    auth: false, // 公开接口
    fields: {
        username: '用户名|string|3|50|null|0|^[a-zA-Z0-9_]+$',
        password: '密码|string|6|100|null|0|null'
    },
    required: ['username', 'password'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const { username, password } = ctx.body as LoginRequest;

        // 查询用户
        const user = await befly.db.getDetail<User>({
            table: 'user',
            where: { username }
        });

        if (!user) {
            return No('用户名或密码错误');
        }

        // 验证密码
        const isValid = await Crypto2.verifyPassword(password, user.password);
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

        const response: LoginResponse = {
            token,
            user: userWithoutPassword
        };

        return Yes<LoginResponse>('登录成功', response);
    }
});
