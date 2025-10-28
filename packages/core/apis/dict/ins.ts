import { Yes, No } from '../../util.js';
import adminDictTable from '../../tables/dict.json';

export default {
    name: '添加字典',
    fields: adminDictTable,
    handler: async (befly, ctx) => {
        try {
            const dictId = await befly.db.insData({
                table: 'addon_admin_dict',
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    value: ctx.body.value,
                    sort: ctx.body.sort,
                    pid: ctx.body.pid,
                    description: ctx.body.description
                }
            });

            return Yes('操作成功', { id: dictId });
        } catch (error) {
            befly.logger.error('添加字典失败:', error);
            return No('操作失败');
        }
    }
};
