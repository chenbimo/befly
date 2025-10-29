/**
 * 管理员登录接口
 */

import { Yes, No } from '../../util.js';
import { Cipher } from '../../lib/cipher.js';
import { Jwt } from '../../lib/jwt.js';
import adminTable from '../../tables/admin.json';

export default {
    name: '管理员登录',
    auth: false,
    fields: {
        username: adminTable.username,
        email: adminTable.email,
        password: adminTable.password
    },
    handler: async (befly, ctx) => {
        let admin = null;

        // 用户名登录
        if (ctx.body.username && ctx.body.password) {
            // 查询管理员
            admin = await befly.db.getOne({
                table: 'core_admin',
                where: { username: ctx.body.username }
            });

            if (!admin) {
                return No('用户名或密码错误');
            }

            // 验证密码
            try {
                const isValid = await Cipher.verifyPassword(ctx.body.password, admin.password);
                if (!isValid) {
                    return No('用户名或密码错误');
                }
            } catch (error) {
                befly.logger.error('密码验证失败:', {
                    error: error.message,
                    passwordLength: admin.password?.length,
                    passwordPrefix: admin.password?.substring(0, 10)
                });
                return No('密码格式错误，请重新设置密码');
            }
        }
        // 邮箱登录
        else if (ctx.body.email && ctx.body.password) {
            // 查询管理员
            admin = await befly.db.getOne({
                table: 'core_admin',
                where: { email: ctx.body.email }
            });

            if (!admin) {
                return No('邮箱或密码错误');
            }

            // 验证密码
            try {
                const isValid = await Cipher.verifyPassword(ctx.body.password, admin.password);
                if (!isValid) {
                    return No('邮箱或密码错误');
                }
            } catch (error) {
                befly.logger.error('密码验证失败:', {
                    error: error.message,
                    passwordLength: admin.password?.length,
                    passwordPrefix: admin.password?.substring(0, 10)
                });
                return No('密码格式错误，请重新设置密码');
            }
        } else {
            return No('请提供用户名或邮箱以及密码');
        }

        // 检查账号状态（state=1 表示正常，state=2 表示禁用）
        if (admin.state === 2) {
            return No('账号已被禁用');
        }

        // 更新最后登录信息
        await befly.db.updData({
            table: 'core_admin',
            where: { id: admin.id },
            data: {
                lastLoginTime: Date.now(),
                lastLoginIp: ctx.ip || 'unknown'
            }
        });

        // 生成 JWT Token（包含核心身份信息）
        const token = await Jwt.sign(
            {
                id: admin.id,
                nickname: admin.nickname,
                roleCode: admin.roleCode,
                roleType: admin.roleType
            },
            {
                expiresIn: '7d'
            }
        );

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        return Yes('登录成功', {
            token,
            userInfo: userWithoutPassword
        });
    }
};
