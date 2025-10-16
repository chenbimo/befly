/**
 * 管理员登录接口
 */

import { No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { ApiRoute } from 'befly/types';
import type { LoginRequest, LoginResponse, Admin } from '../types';
import { Crypto2 } from 'befly';
import { Jwt } from 'befly';
import adminTable from '../tables/admin.json';

export default {
    name: '管理员登录',
    auth: false,
    fields: {
        email: adminTable.email,
        password: adminTable.password,
        phone: adminTable.phone,
        code: '验证码|string|4|6|null|0|null'
    },
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        let admin: Admin | null = null;

        // 邮箱登录
        if (ctx.body.email && ctx.body.password) {
            // 查询管理员
            admin = await befly.db.getDetail<Admin>({
                table: 'addon_admin_admin',
                where: { email: ctx.body.email }
            });

            if (!admin) {
                return No('邮箱或密码错误');
            }

            // 验证密码
            const isValid = await Crypto2.verifyPassword(ctx.body.password, admin.password);
            if (!isValid) {
                return No('邮箱或密码错误');
            }
        }
        // 手机号登录
        else if (ctx.body.phone && ctx.body.code) {
            // 验证验证码
            if (befly.redis) {
                const key = `sms_code:${ctx.body.phone}`;
                const storedCode = await befly.redis.get(key);

                if (!storedCode) {
                    return No('验证码已过期或不存在');
                }

                if (storedCode !== ctx.body.code) {
                    return No('验证码错误');
                }

                // 验证成功后删除验证码
                await befly.redis.del(key);
            } else {
                // 没有 Redis 时的降级处理(开发环境)
                if (ctx.body.code !== '123456') {
                    return No('验证码错误');
                }
            }

            // 查询管理员
            admin = await befly.db.getDetail<Admin>({
                table: 'addon_admin_admin',
                where: { phone: ctx.body.phone }
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
            table: 'addon_admin_admin',
            where: { id: admin.id },
            data: {
                last_login_time: Date.now(),
                last_login_ip: ctx.ip || 'unknown'
            }
        });

        // 生成 JWT Token
        const token = await Jwt.sign(
            {
                id: admin.id,
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
};
