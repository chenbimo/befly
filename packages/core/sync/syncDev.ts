import type { BeflyContext } from "../types/befly.ts";

import { Cipher } from "../lib/cipher.ts";
import { Logger } from "../lib/logger.ts";

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

    const allMenus = await ctx.db.getAll({
        table: "addon_admin_menu",
        fields: ["path"],
        where: { state$gte: 0 },
        orderBy: ["id#ASC"]
    } as any);

    const menuPaths = Array.from(new Set((allMenus.data.lists || []).map((m: any) => (typeof m?.path === "string" ? m.path.trim() : "")).filter((p: string) => p.length > 0)));

    const existApi = await ctx.db.tableExists("addon_admin_api");
    let apiPaths: string[] = [];
    if (existApi.data) {
        const allApis = await ctx.db.getAll({
            table: "addon_admin_api",
            fields: ["routePath"],
            where: { state$gte: 0 },
            orderBy: ["id#ASC"]
        } as any);

        apiPaths = Array.from(
            new Set(
                (allApis.data.lists || []).map((a: any) => {
                    if (typeof a?.routePath !== "string") {
                        throw new Error("syncDev: addon_admin_api.routePath 必须是字符串");
                    }

                    const routePath = a.routePath.trim();
                    if (routePath.length === 0) {
                        throw new Error("syncDev: addon_admin_api.routePath 不允许为空字符串");
                    }

                    if (!routePath.startsWith("/")) {
                        throw new Error(`syncDev: addon_admin_api.routePath 必须是 pathname（以 / 开头），当前值=${routePath}`);
                    }

                    return routePath;
                })
            )
        );
    }

    const roles = [
        {
            code: "dev",
            name: "开发者角色",
            description: "拥有所有菜单和接口权限的开发者角色",
            menus: menuPaths,
            apis: apiPaths,
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

        if (existingRole.data) {
            const nextMenus = roleConfig.menus;
            const nextApis = roleConfig.apis;

            const existingMenus = Array.isArray((existingRole.data as any).menus) ? (existingRole.data as any).menus : [];
            const existingApis = Array.isArray((existingRole.data as any).apis) ? (existingRole.data as any).apis : [];

            const menusChanged = existingMenus.length !== nextMenus.length || existingMenus.some((v: any, i: number) => v !== nextMenus[i]);
            const apisChanged = existingApis.length !== nextApis.length || existingApis.some((v: any, i: number) => v !== nextApis[i]);

            const hasChanges = (existingRole.data as any).name !== roleConfig.name || (existingRole.data as any).description !== roleConfig.description || menusChanged || apisChanged || (existingRole.data as any).sort !== roleConfig.sort;

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
                devRole = existingRole.data;
            }
        } else {
            const roleId = await ctx.db.insData({
                table: "addon_admin_role",
                data: roleConfig
            });
            if (roleConfig.code === "dev") {
                devRole = { id: roleId.data };
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

    if (existing.data) {
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
}
