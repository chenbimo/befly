/**
 * Addon API 示例
 * 路由会自动添加组件名前缀：/api/{addonName}/example
 */

import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

export default Api('示例接口', {
    auth: false, // 不需要认证
    fields: {
        name: '名称|string|1|50|null|0|null',
        age: '年龄|number|1|150|18|0|null'
    },
    required: ['name'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 访问组件的插件（如果有）
        // const myPlugin = befly['addonName.pluginName'];

        // 访问数据库
        // const result = await befly.db.getData({
        //     table: 'addonName_tableName',
        //     where: { id: 1 }
        // });

        return Yes('操作成功', {
            name: ctx.body.name,
            age: ctx.body.age || 18
        });
    }
});
