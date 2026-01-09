import type { ApiRoute } from "befly/types/api";

export default {
    name: "根据代码获取配置值",
    auth: false,
    fields: {
        code: { name: "配置代码", type: "string", min: 1, max: 50 }
    },
    handler: async (befly, ctx) => {
        const config = await befly.db.getOne<{
            id?: number;
            code?: string;
            value?: string;
            valueType?: string;
        }>({
            table: "addon_admin_sys_config",
            where: { code: ctx.body.code }
        });

        if (!config.data?.id) {
            return befly.tool.No("配置不存在");
        }

        const valueType = config.data.valueType;
        const rawValue = config.data.value;
        if (typeof valueType !== "string" || typeof rawValue !== "string") {
            return befly.tool.No("配置数据不完整");
        }

        const code = config.data.code;
        if (typeof code !== "string") {
            return befly.tool.No("配置数据不完整");
        }

        // 根据类型转换值
        let value: unknown = rawValue;
        if (valueType === "number") {
            value = Number(rawValue);
        } else if (valueType === "boolean") {
            value = rawValue === "true" || rawValue === "1";
        } else if (valueType === "json") {
            try {
                value = JSON.parse(rawValue);
            } catch {
                value = rawValue;
            }
        }

        return befly.tool.Yes("操作成功", { code: code, value: value });
    }
} as unknown as ApiRoute;
