import type { SyncDataContext } from "./types.js";

import { beflyConfig } from "../../befly.config.js";
import { Cipher } from "../../lib/cipher.js";
import { Logger } from "../../lib/logger.js";
import { assertTablesExist } from "./assertTablesExist.js";

export async function syncDev(ctx: SyncDataContext): Promise<void> {
    if (!beflyConfig.devPassword) {
        return;
    }

    const helper = ctx.helper as any;

    const tablesOk = await assertTablesExist({
        helper: helper,
        tables: [
            {
                table: "addon_admin_admin",
                skipMessage: "[SyncDev] 表 addon_admin_admin 不存在，跳过开发者账号同步"
            },
            {
                table: "addon_admin_role",
                skipMessage: "[SyncDev] 表 addon_admin_role 不存在，跳过开发者账号同步"
            },
            {
                table: "addon_admin_menu",
                skipMessage: "[SyncDev] 表 addon_admin_menu 不存在，跳过开发者账号同步"
            }
        ]
    });
    if (!tablesOk) {
        return;
    }

    const allMenus = await helper.getAll({
        table: "addon_admin_menu",
        fields: ["id"],
        orderBy: ["id#ASC"]
    });

    if (!allMenus || !Array.isArray(allMenus.lists)) {
        Logger.debug("[SyncDev] 菜单数据为空，跳过开发者账号同步");
        return;
    }

    const menuIds = allMenus.lists.length > 0 ? allMenus.lists.map((m: any) => m.id) : [];

    const existApi = await helper.tableExists("addon_admin_api");
    let apiIds: number[] = [];
    if (existApi) {
        const allApis = await helper.getAll({
            table: "addon_admin_api",
            fields: ["id"],
            orderBy: ["id#ASC"]
        });

        if (allApis && Array.isArray(allApis.lists) && allApis.lists.length > 0) {
            apiIds = allApis.lists.map((a: any) => a.id);
        }
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
        const existingRole = await helper.getOne({
            table: "addon_admin_role",
            where: { code: roleConfig.code }
        });

        if (existingRole) {
            const existingMenusJson = JSON.stringify(existingRole.menus || []);
            const existingApisJson = JSON.stringify(existingRole.apis || []);
            const nextMenusJson = JSON.stringify(roleConfig.menus);
            const nextApisJson = JSON.stringify(roleConfig.apis);

            const hasChanges = existingRole.name !== roleConfig.name || existingRole.description !== roleConfig.description || existingMenusJson !== nextMenusJson || existingApisJson !== nextApisJson || existingRole.sort !== roleConfig.sort;

            if (hasChanges) {
                await helper.updData({
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
            const roleId = await helper.insData({
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

    const sha256Hashed = Cipher.sha256(beflyConfig.devPassword + "befly");
    const hashed = await Cipher.hashPassword(sha256Hashed);

    const devData = {
        nickname: "开发者",
        email: beflyConfig.devEmail,
        username: "dev",
        password: hashed,
        roleCode: "dev",
        roleType: "admin"
    };

    const existing = await helper.getOne({
        table: "addon_admin_admin",
        where: { email: beflyConfig.devEmail }
    });

    if (existing) {
        await helper.updData({
            table: "addon_admin_admin",
            where: { email: beflyConfig.devEmail },
            data: devData
        });
    } else {
        await helper.insData({
            table: "addon_admin_admin",
            data: devData
        });
    }

    await ctx.cacheHelper.rebuildRoleApiPermissions();
}
