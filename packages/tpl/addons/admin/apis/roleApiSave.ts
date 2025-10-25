/**
 * 保存角色的接口权限
 */

import { Yes, No, Fields } from 'befly';
import { cacheRolePermissions } from '../util';

export default {
    name: '保存角色接口权限',
    auth: true,
    fields: {
        roleId: Fields._id,
        apiIds: '接口ID列表|array_text|0|1000|null|0|null'
    },
    handler: async (befly, ctx) => {
        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId }
        });

        if (!role) {
            return No('角色不存在');
        }

        // 将数组转为逗号分隔的字符串存储
        const apiIdsStr = Array.isArray(ctx.body.apiIds) ? ctx.body.apiIds.join(',') : '';

        // 更新角色的接口权限
        await befly.db.updData({
            table: 'addon_admin_role',
            where: { id: ctx.body.roleId },
            data: {
                apis: apiIdsStr
            }
        });

        // 增量更新 Redis 缓存
        await cacheRolePermissions(befly, role.code, apiIdsStr);

        return Yes('操作成功');
    }
};
