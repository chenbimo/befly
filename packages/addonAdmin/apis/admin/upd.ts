import type { ApiRoute } from "befly/types/api";

import adminTable from "../../tables/admin.json";
import { fieldsScheme } from "../../utils/fieldsScheme";
import { mergeTableFields } from "../../utils/mergeTableFields";

const route: ApiRoute = {
    name: "更新管理员",
    fields: mergeTableFields(adminTable, { id: fieldsScheme.id }),
    required: ["id"],
    handler: async (befly, ctx) => {
        const id = ctx.body.id;
        const username = ctx.body.username;
        const nickname = ctx.body.nickname;
        const roleCode = ctx.body.roleCode;

        // 检查管理员是否存在
        const admin = await befly.db.getOne<{
            id?: number;
            username?: string;
            nickname?: string;
            roleCode?: string;
        }>({
            table: "addon_admin_admin",
            where: { id }
        });

        if (!admin.data?.id) {
            return befly.tool.No("管理员不存在");
        }

        // 检查用户名是否已被其他管理员使用
        if (username && username !== admin.data.username) {
            const existingUsername = await befly.db.getOne<{ id?: number }>({
                table: "addon_admin_admin",
                where: { username, id: { $ne: id } }
            });
            if (existingUsername.data?.id) {
                return befly.tool.No("用户名已被使用");
            }
        }

        // 检查昵称是否已被其他管理员使用
        if (nickname && nickname !== admin.data.nickname) {
            const existingNickname = await befly.db.getOne<{ id?: number }>({
                table: "addon_admin_admin",
                where: { nickname, id: { $ne: id } }
            });
            if (existingNickname.data?.id) {
                return befly.tool.No("昵称已被使用");
            }
        }

        // 检查角色是否存在
        if (roleCode && roleCode !== admin.data.roleCode) {
            const role = await befly.db.getOne<{ id?: number }>({
                table: "addon_admin_role",
                where: { code: roleCode }
            });
            if (!role.data?.id) {
                return befly.tool.No("角色不存在");
            }
        }

        // 构建更新数据
        const dataToUpdate: Record<string, any> = {};

        if (ctx.body.avatar !== undefined) dataToUpdate["avatar"] = ctx.body.avatar;
        if (ctx.body.email !== undefined) dataToUpdate["email"] = ctx.body.email;
        if (ctx.body.lastLoginIp !== undefined) dataToUpdate["lastLoginIp"] = ctx.body.lastLoginIp;
        if (ctx.body.lastLoginTime !== undefined) dataToUpdate["lastLoginTime"] = ctx.body.lastLoginTime;
        if (ctx.body.password !== undefined) dataToUpdate["password"] = ctx.body.password;
        if (ctx.body.phone !== undefined) dataToUpdate["phone"] = ctx.body.phone;
        if (ctx.body.roleType !== undefined) dataToUpdate["roleType"] = ctx.body.roleType;

        if (username !== undefined) dataToUpdate["username"] = username;
        if (nickname !== undefined) dataToUpdate["nickname"] = nickname;
        if (roleCode !== undefined) dataToUpdate["roleCode"] = roleCode;

        // 更新管理员信息
        await befly.db.updData({
            table: "addon_admin_admin",
            data: dataToUpdate,
            where: { id }
        });

        return befly.tool.Yes("更新成功");
    }
};

export default route;
