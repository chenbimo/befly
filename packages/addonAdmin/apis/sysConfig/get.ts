export default {
    name: "根据代码获取配置值",
    auth: false,
    fields: {
        code: { name: "配置代码", type: "string", min: 1, max: 50 }
    },
    handler: async (befly, ctx) => {
        const config = await befly.db.getOne<{
            id: number;
            code: string;
            value: string;
            valueType: string;
        }>({
            table: "addon_admin_sys_config",
            where: { code: ctx.body.code }
        });

        if (!config.data?.id) {
            return befly.tool.No("配置不存在");
        }

        // 根据类型转换值
        let value = config.data.value;
        if (config.data.valueType === "number") {
            value = Number(config.data.value);
        } else if (config.data.valueType === "boolean") {
            value = config.data.value === "true" || config.data.value === "1";
        } else if (config.data.valueType === "json") {
            try {
                value = JSON.parse(config.data.value);
            } catch {
                value = config.data.value;
            }
        }

        return befly.tool.Yes("操作成功", { code: config.data.code, value: value });
    }
};
