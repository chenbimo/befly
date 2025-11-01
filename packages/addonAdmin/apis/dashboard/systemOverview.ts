/**
 * 获取系统概览数据
 */

import { Yes } from '../../util.js';

export default {
    name: '获取系统概览数据',
    handler: async (befly, ctx) => {
        // 权限统计
        const menuCount = await befly.db.getCount({
            table: 'core_menu',
            where: { state: 1 }
        });

        const roleCount = await befly.db.getCount({
            table: 'core_role',
            where: { state: 1 }
        });

        const apiCount = await befly.db.getCount({
            table: 'core_api',
            where: { state: 1 }
        });

        return Yes('获取成功', {
            menuCount,
            roleCount,
            apiCount
        });
    }
};
