/**
 * 获取系统概览数据
 */

import { Yes } from 'befly';
import os from 'node:os';

export default {
    name: '获取系统概览数据',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // 系统信息
        const systemInfo = {
            systemName: 'Befly Admin',
            version: 'v1.0.0',
            environment: process.env.NODE_ENV === 'production' ? 'Production' : 'Development'
        };

        // 权限统计（从数据库查询）
        const menuCount = await befly.db.query({
            sql: 'SELECT COUNT(*) as count FROM addon_admin_menu WHERE state = 1',
            type: 'one'
        });

        const roleCount = await befly.db.query({
            sql: 'SELECT COUNT(*) as count FROM addon_admin_role WHERE state = 1',
            type: 'one'
        });

        const apiCount = await befly.db.query({
            sql: 'SELECT COUNT(*) as count FROM addon_admin_api WHERE state = 1',
            type: 'one'
        });

        return Yes('获取成功', {
            systemInfo,
            permissionStats: {
                menuCount: menuCount.count || 0,
                roleCount: roleCount.count || 0,
                apiCount: apiCount.count || 0
            }
        });
    }
};
