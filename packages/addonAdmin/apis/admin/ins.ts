import adminTable from "../../tables/admin.json";

export default {
    name: "添加管理员",
    fields: adminTable,
    required: ["username", "password", "roleCode"],
    handler: async (befly, ctx) => {
        // 检查用户名是否已存在
        const existingByUsername = await befly.db.getOne<{ id: number }>({
            table: "addon_admin_admin",
            where: { username: ctx.body.username }
        });

        if (existingByUsername.data?.id) {
            return befly.tool.No("用户名已被使用");
        }

        // 检查昵称是否已存在
        if (ctx.body.nickname) {
            const existingByNickname = await befly.db.getOne<{ id: number }>({
                table: "addon_admin_admin",
                where: { nickname: ctx.body.nickname }
            });

            if (existingByNickname.data?.id) {
                return befly.tool.No("昵称已被使用");
            }
        }

        // 查询角色信息
        const roleData = await befly.db.getOne<{ id: number }>({
            table: "addon_admin_role",
            where: { code: ctx.body.roleCode }
        });

        if (!roleData.data?.id) {
            return befly.tool.No("角色不存在");
        }

        // 加密密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.password);

        // 创建管理员
        const adminId = await befly.db.insData({
            table: "addon_admin_admin",
            data: {
                username: ctx.body.username,
                password: hashedPassword,
                nickname: ctx.body.nickname,
                roleCode: ctx.body.roleCode
            }
        });

        return befly.tool.Yes("添加成功", {
            id: adminId.data
        });
    }
};
