import type { BeflyContext } from "../types/befly";

import { Cipher } from "../lib/cipher";
import { Logger } from "../lib/logger";

export type SyncDevConfig = {
    devEmail?: string;
    devPassword?: string;
};

export async function syncDev(ctx: BeflyContext, config: SyncDevConfig = {}): Promise<void> {
    if (!config.devPassword) {
        return;
    }

    if (!ctx.db) {
        throw new Error("syncDev: ctx.db 未初始化（Db 插件未加载或注入失败）");
    }

    if (!ctx.cache) {
        throw new Error("syncDev: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    }

    if (!(await ctx.db.tableExists("addon_admin_admin")).data) {
        Logger.debug(`addon_admin_admin 表不存在`);
        return;
    }
    if (!(await ctx.db.tableExists("addon_admin_role")).data) {
        Logger.debug(`addon_admin_role 表不存在`);
        return;
    }
    if (!(await ctx.db.tableExists("addon_admin_menu")).data) {
        Logger.debug(`addon_admin_menu 表不存在`);
        return;
    }
    if (!(await ctx.db.tableExists("addon_admin_api")).data) {
        Logger.debug(`addon_admin_api 表不存在`);
        return;
    }

    const allMenus = await ctx.db.getAll<{ path?: string | null }>({
        table: "addon_admin_menu",
        fields: ["path"],
        where: { state$gte: 0 },
        orderBy: ["id#ASC"]
    } as any);

    const allApis = await ctx.db.getAll<{ path?: string | null }>({
        table: "addon_admin_api",
        fields: ["path"],
        where: { state$gte: 0 },
        orderBy: ["id#ASC"]
    } as any);

    const devRole = await ctx.db.getOne<{ id?: number }>({
        table: "addon_admin_role",
        where: { code: "dev" }
    });

    const devRoleData = {
        code: "dev",
        name: "开发者角色",
        description: "拥有所有菜单和接口权限的开发者角色",
        menus: allMenus.data.lists.map((item) => item.path).filter((v) => v),
        apis: allApis.data.lists.map((item) => item.path).filter((v) => v),
        sort: 0
    };

    if (typeof devRole.data.id === "number") {
        await ctx.db.updData({
            table: "addon_admin_role",
            where: { code: "dev" },
            data: {
                name: devRoleData.name,
                description: devRoleData.description,
                menus: devRoleData.menus,
                apis: devRoleData.apis,
                sort: devRoleData.sort
            }
        });
    } else {
        await ctx.db.insData({
            table: "addon_admin_role",
            data: devRoleData
        });
    }

    const devAdminData = {
        nickname: "开发者",
        email: config.devEmail || "dev@qq.com",
        username: "dev",
        password: await Cipher.hashPassword(Cipher.sha256(config.devPassword + "befly")),
        roleCode: "dev",
        roleType: "admin"
    };

    const devAdmin = await ctx.db.getOne<{ id?: number }>({
        table: "addon_admin_admin",
        where: { username: "dev" }
    });

    if (typeof devAdmin.data.id === "number") {
        await ctx.db.updData({
            table: "addon_admin_admin",
            where: { username: "dev" },
            data: {
                nickname: devAdminData.nickname,
                email: devAdminData.email,
                username: devAdminData.username,
                password: devAdminData.password,
                roleCode: devAdminData.roleCode,
                roleType: devAdminData.roleType
            }
        });
    } else {
        await ctx.db.insData({
            table: "addon_admin_admin",
            data: devAdminData
        });
    }

    const roles = [
        {
            code: "user",
            name: "用户角色",
            description: "普通用户角色",
            sort: 1
        },
        {
            code: "admin",
            name: "管理员角色",
            description: "管理员角色",
            sort: 2
        },
        {
            code: "guest",
            name: "访客角色",
            description: "访客角色",
            sort: 3
        }
    ];

    for (const roleConfig of roles) {
        const existingRole = await ctx.db.getOne<{ id?: number }>({
            table: "addon_admin_role",
            where: { code: roleConfig.code }
        });

        if (existingRole.data?.id) {
            // 角色存在则强制更新（不做差异判断）
            await ctx.db.updData({
                table: "addon_admin_role",
                where: { code: roleConfig.code },
                data: {
                    name: roleConfig.name,
                    description: roleConfig.description,
                    sort: roleConfig.sort
                }
            });
        } else {
            await ctx.db.insData({
                table: "addon_admin_role",
                data: {
                    code: roleConfig.code,
                    name: roleConfig.name,
                    description: roleConfig.description,
                    sort: roleConfig.sort
                }
            });
        }
    }
}
