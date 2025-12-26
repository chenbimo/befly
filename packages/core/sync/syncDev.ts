import type { BeflyContext } from "../types/befly.js";

import { Cipher } from "../lib/cipher.js";
import { Logger } from "../lib/logger.js";

export type SyncDevConfig = {
    devEmail?: string;
    devPassword?: string;
};

export async function syncDev(ctx: BeflyContext, config: SyncDevConfig = {}): Promise<void> {
    if (!config.devPassword) {
        return;
    }

    const devEmail = typeof config.devEmail === "string" && config.devEmail.length > 0 ? config.devEmail : "dev@qq.com";

    if (!ctx.db) {
        throw new Error("syncDev: ctx.db 未初始化（Db 插件未加载或注入失败）");
    }

    if (!ctx.cache) {
        throw new Error("syncDev: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    }

    if (!(await ctx.db.tableExists("addon_admin_admin"))) {
        Logger.debug(`addon_admin_admin 表不存在`);
        return;
    }
    if (!(await ctx.db.tableExists("addon_admin_role"))) {
        Logger.debug(`addon_admin_role 表不存在`);
        return;
    }
    if (!(await ctx.db.tableExists("addon_admin_menu"))) {
        Logger.debug(`addon_admin_menu 表不存在`);
        return;
    }

    const allMenus = await ctx.db.getAll({
        table: "addon_admin_menu",
        fields: ["id"],
        where: { state$gte: 0 },
        orderBy: ["id#ASC"]
    } as any);

    const menuIds = allMenus.lists.map((m: any) => m.id);

    const existApi = await ctx.db.tableExists("addon_admin_api");
    let apiIds: number[] = [];
    if (existApi) {
        const allApis = await ctx.db.getAll({
            table: "addon_admin_api",
            fields: ["id"],
            where: { state$gte: 0 },
            orderBy: ["id#ASC"]
        } as any);

        apiIds = allApis.lists.map((a: any) => a.id);
    }

    const roles = [
        {
            code: "dev",
            name: "开发者角色",
            description: "拥有所有菜单和接口权限的开发者角色",
            menus: menuIds,
            apis: apiIds,
            sort: 0
        },
        {
            code: "user",
            name: "用户角色",
            description: "普通用户角色",
            menus: [],
            apis: [],
            sort: 1
        },
        {
            code: "admin",
            name: "管理员角色",
            description: "管理员角色",
            menus: [],
            apis: [],
            sort: 2
        },
        {
            code: "guest",
            name: "访客角色",
            description: "访客角色",
            menus: [],
            apis: [],
            sort: 3
        }
    ];

    let devRole = null;
    for (const roleConfig of roles) {
        const existingRole = await ctx.db.getOne({
            table: "addon_admin_role",
            where: { code: roleConfig.code }
        });

        if (existingRole) {
            const nextMenus = roleConfig.menus;
            const nextApis = roleConfig.apis;

            const menusChanged = existingRole.menus.length !== nextMenus.length || existingRole.menus.some((v: any, i: number) => v !== nextMenus[i]);
            const apisChanged = existingRole.apis.length !== nextApis.length || existingRole.apis.some((v: any, i: number) => v !== nextApis[i]);

            const hasChanges = existingRole.name !== roleConfig.name || existingRole.description !== roleConfig.description || menusChanged || apisChanged || existingRole.sort !== roleConfig.sort;

            if (hasChanges) {
                await ctx.db.updData({
                    table: "addon_admin_role",
                    where: { code: roleConfig.code },
                    data: {
                        name: roleConfig.name,
                        description: roleConfig.description,
                        menus: roleConfig.menus,
                        apis: roleConfig.apis,
                        sort: roleConfig.sort
                    }
                });
            }
            if (roleConfig.code === "dev") {
                devRole = existingRole;
            }
        } else {
            const roleId = await ctx.db.insData({
                table: "addon_admin_role",
                data: roleConfig
            });
            if (roleConfig.code === "dev") {
                devRole = { id: roleId };
            }
        }
    }

    if (!devRole) {
        Logger.error("dev 角色不存在，无法创建开发者账号");
        return;
    }

    const sha256Hashed = Cipher.sha256(config.devPassword + "befly");
    const hashed = await Cipher.hashPassword(sha256Hashed);

    const devData = {
        nickname: "开发者",
        email: devEmail,
        username: "dev",
        password: hashed,
        roleCode: "dev",
        roleType: "admin"
    };

    const existing = await ctx.db.getOne({
        table: "addon_admin_admin",
        where: { email: devEmail }
    });

    if (existing) {
        await ctx.db.updData({
            table: "addon_admin_admin",
            where: { email: devEmail },
            data: devData
        });
    } else {
        await ctx.db.insData({
            table: "addon_admin_admin",
            data: devData
        });
    }

    await ctx.cache.rebuildRoleApiPermissions();
}
