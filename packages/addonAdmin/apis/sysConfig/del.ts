import type { ApiRoute } from "befly/types/api";

import { fieldsScheme } from "../../utils/fieldsScheme";

const route: ApiRoute = {
    name: "删除系统配置",
    fields: {
        id: fieldsScheme.id
    },
    required: ["id"],
    handler: async (befly, ctx) => {
        try {
            // 检查是否为系统配置
            const config = await befly.db.getOne({
                table: "addon_admin_sys_config",
                where: { id: ctx.body.id }
            });

            if (!config.data?.id) {
                return befly.tool.No("配置不存在");
            }

            if (config.data.isSystem === 1) {
                return befly.tool.No("系统配置不允许删除");
            }

            await befly.db.delData({
                table: "addon_admin_sys_config",
                where: { id: ctx.body.id }
            });

            return befly.tool.Yes("操作成功");
        } catch (error) {
            befly.logger.error({ err: error, msg: "删除系统配置失败" });
            return befly.tool.No("操作失败");
        }
    }
};

export default route;
