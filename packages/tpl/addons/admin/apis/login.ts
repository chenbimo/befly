/**
 * 管理员登录接口
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { LoginRequest, LoginResponse, Admin } from '../types';
import { Crypto2 } from 'befly/utils/crypto';
import { Jwt } from 'befly/utils/jwt';
import adminTable from '../tables/admin.json';

export default Api('管理员登录', {
    method: 'POST',
    auth: false, // 公开接口
    fields: {
        email: adminTable.email,
        password: adminTable.password,
        phone: adminTable.phone,
        code: '验证码|string|4|6|null|0|null'
    },
    required: [], // 不设置必填,因为要支持多种登录方式
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        const { email, password, phone, code } = ctx.body as LoginRequest;

        let admin: Admin | null = null;

        // 邮箱登录
        if (email && password) {
            // 查询管理员
            admin = await befly.db.getDetail<Admin>({
                table: 'admin_admin',
                where: { email }
            });

            if (!admin) {
                return No('邮箱或密码错误');
            }

            // 验证密码
            const isValid = await Crypto2.verifyPassword(password, admin.password);
            if (!isValid) {
                return No('邮箱或密码错误');
            }
        }
        // 手机号登录
        else if (phone && code) {
            // 验证验证码
            if (befly.redis) {
                const key = `sms_code:${phone}`;
                const storedCode = await befly.redis.get(key);

                if (!storedCode) {
                    return No('验证码已过期或不存在');
                }

                if (storedCode !== code) {
                    return No('验证码错误');
                }

                // 验证成功后删除验证码
                await befly.redis.del(key);
            } else {
                // 没有 Redis 时的降级处理(开发环境)
                if (code !== '123456') {
                    return No('验证码错误');
                }
            }

            // 查询管理员
            admin = await befly.db.getDetail<Admin>({
                table: 'admin_admin',
                where: { phone }
            });

            if (!admin) {
                return No('该手机号未注册');
            }
        } else {
            return No('请提供正确的登录信息');
        }

        // 检查账号状态
        if (admin.status !== 1) {
            return No('账号已被禁用');
        }

        // 更新最后登录信息
        await befly.db.updData({
            table: 'admin_admin',
            where: { id: admin.id },
            data: {
                last_login_time: Date.now(),
                last_login_ip: ctx.ip || 'unknown'
            }
        });

        // 生成 JWT Token
        const token = await Jwt.sign(
            {
                userId: admin.id.toString(),
                email: admin.email,
                role: admin.role
            },
            {
                expiresIn: '7d'
            }
        );

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        const response: LoginResponse = {
            token,
            userInfo: userWithoutPassword
        };

        return Yes<LoginResponse>('登录成功', response);
    }
});
