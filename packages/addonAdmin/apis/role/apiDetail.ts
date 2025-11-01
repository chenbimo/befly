/**
 * 获取角色的接口权限
 */

import { Yes, No } from '../../util.js';

export default {
    name: '获取角色接口权限',
    handler: async (befly, ctx) => {
        // 查询角色信息
        const role = await befly.db.getOne({
            table: 'core_role',
            where: { id: ctx.body.roleId }
        });

        if (!role) {
            return No('角色不存在');
        }

        // 解析接口ID列表（逗号分隔的字符串转为数组）
        const apiIds = role.apis
            ? role.apis
                  .split(',')
                  .map((id: string) => parseInt(id.trim()))
                  .filter((id: number) => !isNaN(id))
            : [];

        return Yes('操作成功', { apiIds });
    }
};
