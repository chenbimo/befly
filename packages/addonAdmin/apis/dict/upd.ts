import adminDictTable from '../../tables/dict.json';

export default {
    name: '更新字典',
    fields: {
        ...adminDictTable,
        '@id': true
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const { id, typeCode, key, label, value, sort, remark } = ctx.body;

        // 如果更新了 typeCode，验证其是否存在
        if (typeCode) {
            const dictType = await befly.db.getOne({
                table: 'addon_admin_dict_type',
                where: { code: typeCode }
            });

            if (!dictType?.id) {
                return befly.tool.No('字典类型不存在');
            }
        }

        // 如果更新了 typeCode 或 key，检查唯一性
        if (typeCode || key) {
            const current = await befly.db.getOne({
                table: 'addon_admin_dict',
                where: { id: id }
            });

            const checkTypeCode = typeCode || current?.typeCode;
            const checkKey = key || current?.key;

            const existing = await befly.db.getOne({
                table: 'addon_admin_dict',
                where: {
                    typeCode: checkTypeCode,
                    key: checkKey,
                    id$ne: id
                }
            });

            if (existing?.id) {
                return befly.tool.No('该类型下已存在相同的键名');
            }
        }

        const updateData: Record<string, any> = {};
        if (typeCode !== undefined) updateData.typeCode = typeCode;
        if (key !== undefined) updateData.key = key;
        if (label !== undefined) updateData.label = label;
        if (value !== undefined) updateData.value = value;
        if (sort !== undefined) updateData.sort = sort;
        if (remark !== undefined) updateData.remark = remark;

        await befly.db.updData({
            table: 'addon_admin_dict',
            data: updateData,
            where: { id: id }
        });

        return befly.tool.Yes('更新成功');
    }
};
