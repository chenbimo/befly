export default {
    name: "获取用户角色",
    fields: {
        id: "@id"
    },
    handler: async (befly, ctx) => {
        let roleInfo = null;
        if (ctx.body.id && ctx.user.roleType === "admin") {
            const roleInfoResult = await befly.db.getOne({
                table: "addon_admin_role",
                where: { code: ctx.body.id }
            });

            const roleId = (roleInfoResult.data as any)?.id;
            if (typeof roleId === "number") {
                roleInfo = roleInfoResult.data;
            }
        }

        return befly.tool.Yes("操作成功", {
            roleCode: ctx.body.id,
            role: roleInfo
        });
    }
};
