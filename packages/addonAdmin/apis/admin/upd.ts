import adminTable from "../../tables/admin.json";

export default {
    name: "更新管理员",
    fields: { id: "@id", ...adminTable },
    required: ["id"],
    handler: async (befly, ctx) => {
        const { id, username, nickname, roleCode, ...updateData } = ctx.body;

        // 检查管理员是否存在
        const admin = await befly.db.getOne({
            table: "addon_admin_admin",
            where: { id }
        });

        if (!admin.data?.id) {
            return befly.tool.No("管理员不存在");
        }

        // 检查用户名是否已被其他管理员使用
        if (username && username !== admin.data.username) {
            const existingUsername = await befly.db.getOne({
                table: "addon_admin_admin",
                where: { username, id: { $ne: id } }
            });
            if (existingUsername.data?.id) {
                return befly.tool.No("用户名已被使用");
            }
        }

        // 检查昵称是否已被其他管理员使用
        if (nickname && nickname !== admin.data.nickname) {
            const existingNickname = await befly.db.getOne({
                table: "addon_admin_admin",
                where: { nickname, id: { $ne: id } }
            });
            if (existingNickname.data?.id) {
                return befly.tool.No("昵称已被使用");
            }
        }

        // 检查角色是否存在
        if (roleCode && roleCode !== admin.data.roleCode) {
            const role = await befly.db.getOne({
                table: "addon_admin_role",
                where: { code: roleCode }
            });
            if (!role.data?.id) {
                return befly.tool.No("角色不存在");
            }
        }

        // 构建更新数据
        const dataToUpdate: Record<string, any> = { ...updateData };
        if (username) dataToUpdate.username = username;
        if (nickname) dataToUpdate.nickname = nickname;
        if (roleCode) dataToUpdate.roleCode = roleCode;

        // 更新管理员信息
        await befly.db.updData({
            table: "addon_admin_admin",
            data: dataToUpdate,
            where: { id }
        });

        return befly.tool.Yes("更新成功");
    }
};
