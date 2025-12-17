/**
 * 刷新全部缓存接口
 *
 * 功能：
 * 1. 刷新接口缓存（apis:all）
 * 2. 刷新菜单缓存（menus:all）
 * 3. 刷新角色权限缓存（role:info:{code}）
 *
 * 使用场景：
 * - 执行数据库同步后
 * - 手动修改配置需要立即生效
 * - 缓存出现异常需要重建
 */

import { CacheKeys } from "befly/lib/cacheKeys";

export default {
  name: "刷新全部缓存",
  handler: async (befly, _ctx) => {
    try {
      const results: Record<string, any> = {
        apis: { success: false, count: 0 },
        menus: { success: false, count: 0 },
        roles: { success: false, count: 0 },
        roleApiPermissions: { success: false },
      };

      // 1. 刷新接口缓存
      try {
        const apis = await befly.db.getAll({
          table: "addon_admin_api",
        });

        await befly.redis.setObject(CacheKeys.apisAll(), apis.lists);
        results.apis = { success: true, count: apis.lists.length };
      } catch (error: any) {
        befly.logger.error({ err: error }, "刷新接口缓存失败");
        results.apis = { success: false, error: error.message };
      }

      // 2. 刷新菜单缓存
      try {
        const menus = await befly.db.getAll({
          table: "addon_admin_menu",
        });

        await befly.redis.setObject(CacheKeys.menusAll(), menus.lists);

        const parentCount = menus.lists.filter((m: any) => m.pid === 0).length;
        const childCount = menus.lists.filter((m: any) => m.pid !== 0).length;

        results.menus = {
          success: true,
          count: menus.lists.length,
          parentCount: parentCount,
          childCount: childCount,
        };
      } catch (error: any) {
        befly.logger.error({ err: error }, "刷新菜单缓存失败");
        results.menus = { success: false, error: error.message };
      }

      // 3. 刷新角色权限缓存
      try {
        const roles = await befly.db.getAll({
          table: "addon_admin_role",
        });

        // 使用 setBatch 批量缓存所有角色
        const count = await befly.redis.setBatch(
          roles.lists.map((role: any) => ({
            key: CacheKeys.roleInfo(role.code),
            value: role,
          })),
        );

        results.roles = { success: true, count: count };
      } catch (error: any) {
        befly.logger.error({ err: error }, "刷新角色缓存失败");
        results.roles = { success: false, error: error.message };
      }

      // 4. 重建角色接口权限缓存（版本化 + 原子切换）
      try {
        await befly.cache.rebuildRoleApiPermissions();
        results.roleApiPermissions = { success: true };
      } catch (error: any) {
        befly.logger.error({ err: error }, "重建角色接口权限缓存失败");
        results.roleApiPermissions = { success: false, error: error.message };
      }

      // 检查是否全部成功
      const allSuccess =
        results.apis.success &&
        results.menus.success &&
        results.roles.success &&
        results.roleApiPermissions.success;

      if (allSuccess) {
        return befly.tool.Yes("全部缓存刷新成功", results);
      } else {
        return befly.tool.No("部分缓存刷新失败", results);
      }
    } catch (error: any) {
      befly.logger.error({ err: error }, "刷新全部缓存失败");
      return befly.tool.No("刷新全部缓存失败", { error: error.message });
    }
  },
};
