import { Field, Yes, No } from 'befly';
import type { ApiRoute } from 'befly';
import adminDictTable from '../tables/dict.json';

/**
 * 更新字典
 */
export default {
    name: '更新字典',
    fields: {
        id: Field._id,
        name: adminDictTable.name,
        code: adminDictTable.code,
        value: adminDictTable.value,
        sort: adminDictTable.sort,
        pid: adminDictTable.pid,
        description: adminDictTable.description,
        state: Field.state
    },
    handler: async (befly, ctx) => {
        try {
            await befly.db.updData({
                table: 'addon_admin_dict',
                data: {
                    name: ctx.body.name,
                    code: ctx.body.code,
                    value: ctx.body.value,
                    sort: ctx.body.sort,
                    pid: ctx.body.pid,
                    description: ctx.body.description,
                    state: ctx.body.state
                },
                where: {
                    id: ctx.body.id
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('更新字典失败:', error);
            return No('操作失败');
        }
    }
} as ApiRoute;
