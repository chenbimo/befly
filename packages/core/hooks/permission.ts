// 类型导入
import type { Hook } from "../types/hook.js";

import { CacheKeys } from "../lib/cacheKeys.js";
// 相对导入
import { ErrorResponse } from "../utils/response.js";

/**
 * 权限检查钩子
 * - 接口无需权限（auth=false）：直接通过
 * - 用户未登录：返回 401
 * - 开发者角色（dev）：最高权限，直接通过
 * - 其他角色：检查 Redis 中的角色权限集合
 */
const hook: Hook = {
    order: 6,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 1. 接口无需权限
        if (ctx.api.auth === false) {
            return;
        }

        // 2. 用户未登录
        if (!ctx.user || !ctx.user.id) {
            ctx.response = ErrorResponse(ctx, "未登录", 1, null, null, "auth");
            return;
        }

        // 3. 开发者权限（最高权限）
        if (ctx.user.roleCode === "dev") {
            return;
        }

        // 4. 角色权限检查
        let hasPermission = false;
        if (ctx.user.roleCode && befly.redis) {
            try {
                // apiPath 在 apiHandler 中已统一生成并写入 ctx.route
                const apiPath = ctx.route;
                const roleCode = ctx.user.roleCode;

                // 极简方案：每个角色一个 Set，直接判断成员是否存在
                const roleApisKey = CacheKeys.roleApis(roleCode);
                hasPermission = await befly.redis.sismember(roleApisKey, apiPath);
            } catch {
                // Redis 异常时降级为拒绝访问（仅记录 ErrorResponse 日志，不在 hook 内单独打日志）
                hasPermission = false;
            }
        }

        if (!hasPermission) {
            ctx.response = ErrorResponse(ctx, "无权访问", 1, null, null, "permission");
            return;
        }
    }
};
export default hook;
