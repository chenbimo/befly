export default {
    name: '根据代码获取配置值',
    auth: false,
    fields: {
        code: { name: '配置代码', type: 'string', min: 1, max: 50 }
    },
    handler: async (befly, ctx) => {
        const config = await befly.db.getDetail({
            table: 'addon_admin_sys_config',
            fields: ['code', 'value', 'valueType'],
            where: { code: ctx.body.code }
        });

        if (!config) {
            return befly.tool.No('配置不存在');
        }

        // 根据类型转换值
        let value = config.value;
        if (config.valueType === 'number') {
            value = Number(config.value);
        } else if (config.valueType === 'boolean') {
            value = config.value === 'true' || config.value === '1';
        } else if (config.valueType === 'json') {
            try {
                value = JSON.parse(config.value);
            } catch {
                value = config.value;
            }
        }

        return befly.tool.Yes('操作成功', { code: config.code, value: value });
    }
};
