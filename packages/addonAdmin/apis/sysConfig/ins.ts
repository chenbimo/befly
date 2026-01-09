import type { ApiRoute } from "befly/types/api";

import sysConfigTable from "../../tables/sysConfig.json";

export default {
    name: "添加系统配置",
    fields: sysConfigTable,
    handler: async (befly, ctx) => {
        try {
            // 检查 code 是否已存在
            const existing = await befly.db.getOne<{ id?: number }>({
                table: "addon_admin_sys_config",
                where: { code: ctx.body.code }
            });

            if (existing.data?.id) {
                return befly.tool.No("配置代码已存在");
            }

            const configId = await befly.db.insData({
                table: "addon_admin_sys_config",
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    value: ctx.body.value,
                    valueType: ctx.body.valueType || "string",
                    group: ctx.body.group || "",
                    sort: ctx.body.sort || 0,
                    isSystem: ctx.body.isSystem || 0,
                    description: ctx.body.description || ""
                }
            });

            return befly.tool.Yes("操作成功", { id: configId.data });
        } catch (error) {
            befly.logger.error({ err: error, msg: "添加系统配置失败" });
            return befly.tool.No("操作失败");
        }
    }
} as unknown as ApiRoute;
