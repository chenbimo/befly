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
        apiIds: '接口ID列表|string|0|10000|null|0|null'
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

        // apiIds 可能是 JSON 字符串或逗号分隔的字符串
        let apiIdsStr = '';
        if (ctx.body.apiIds) {
            try {
                // 尝试解析 JSON
                const parsed = JSON.parse(ctx.body.apiIds);
                if (Array.isArray(parsed)) {
                    apiIdsStr = parsed.join(',');
                } else {
                    apiIdsStr = ctx.body.apiIds;
                }
            } catch {
                // 如果不是 JSON，直接使用
                apiIdsStr = ctx.body.apiIds;
            }
        }

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
