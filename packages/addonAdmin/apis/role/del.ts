﻿/**
 * 删除角色
 */

import { Yes, No } from 'befly';

export default {
    name: '删除角色',
    handler: async (befly, ctx) => {
        try {
            // 检查是否有用户使用此角色（使用 getList 代替 getAll）
            const adminList = await befly.db.getList({
                table: 'addon_admin_admin',
                where: { roleId: ctx.body.id }
            });

            if (adminList.total > 0) {
                return No('该角色已分配给用户，无法删除');
            }

            // 获取角色信息（用于删除缓存）
            const role = await befly.db.getDetail({
                table: 'addon_admin_role',
                where: { id: ctx.body.id }
            });

            // 删除角色
            await befly.db.delData({
                table: 'addon_admin_role',
                where: { id: ctx.body.id }
            });

            // 删除角色权限缓存
            if (role?.code) {
                await befly.cache.deleteRolePermissions(befly, role.code);
            }

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除角色失败:', error);
            return No('操作失败');
        }
    }
};
