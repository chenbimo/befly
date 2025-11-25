import adminTable from '../../tables/admin.json';

export default {
    name: '管理员登录',
    auth: false,
    fields: {
        account: {
            name: '账号',
            type: 'string',
            min: 3,
            max: 100
        },
        password: adminTable.password
    },
    required: ['account', 'password'],
    handler: async (befly, ctx) => {
        // 查询管理员（account 匹配 username 或 email）
        const admin = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: {
                $or: [{ username: ctx.body.account }, { email: ctx.body.account }]
            }
        });

        if (!admin) {
            return befly.tool.No('账号或密码错误1');
        }

        // 验证密码
        try {
            const isValid = await befly.cipher.verifyPassword(ctx.body.password, admin.password);
            if (!isValid) {
                return befly.tool.No('账号或密码错误2');
            }
        } catch (error) {
            befly.logger.error('密码验证失败', error);
            return befly.tool.No('密码格式错误，请重新设置密码');
        }

        // 检查账号状态（state=1 表示正常，state=2 表示禁用）
        if (admin.state === 2) {
            return befly.tool.No('账号已被禁用');
        }

        // 更新最后登录信息
        await befly.db.updData({
            table: 'addon_admin_admin',
            where: { id: admin.id },
            data: {
                lastLoginTime: Date.now(),
                lastLoginIp: ctx.ip || 'unknown'
            }
        });

        // 生成 JWT Token（包含核心身份信息）
        const token = await befly.jwt.sign(
            {
                id: admin.id,
                nickname: admin.nickname,
                roleCode: admin.roleCode,
                roleType: admin.roleType
            },
            {
                expiresIn: '30d'
            }
        );

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = admin;

        return befly.tool.Yes('登录成功', {
            token,
            userInfo: userWithoutPassword
        });
    }
};
