// 类型导入
import type { Hook } from "../types/hook";

import { CacheKeys } from "../lib/cacheKeys";
import { Logger } from "../lib/logger";
// 相对导入
import { ErrorResponse } from "../utils/response";

/**
 * 权限检查钩子
 * - 接口无需权限（auth=false）：直接通过
 * - 用户未登录：返回 401
 * - 开发者角色（dev）：最高权限，直接通过
 * - 其他角色：检查 Redis 中的角色权限集合
 */
const permissionHook: Hook = {
    name: "permission",
    enable: true,
    deps: ["validator"],
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 1. 接口无需权限
        if (ctx.api.auth === false) {
            return;
        }

        // 2. 用户未登录
        if (typeof ctx.user.id !== "number") {
            ctx.response = ErrorResponse(ctx, "未登录", 1, null, null, "auth");
            return;
        }

        // 3. 开发者权限（最高权限）
        if (ctx.user.roleCode === "dev") {
            return;
        }

        // 4. 角色权限检查
        // apiPath 在 apiHandler 中已统一生成并写入 ctx.route
        const apiPath = ctx.route;
        const roleCode = ctx.user.roleCode;

        let hasPermission = false;
        if (roleCode && befly.redis) {
            try {
                // 极简方案：每个角色一个 Set，直接判断成员是否存在
                const roleApisKey = CacheKeys.roleApis(roleCode);
                hasPermission = await befly.redis.sismember(roleApisKey, apiPath);
            } catch (err: unknown) {
                // Redis 异常：记录到 error 日志文件（不回传给客户端），并降级为拒绝访问
                Logger.error({
                    event: "hook_permission_redis_error",
                    apiPath: apiPath,
                    roleCode: roleCode,
                    err: err,
                    msg: "hook permission redis error"
                });
                hasPermission = false;
            }
        }

        if (!hasPermission) {
            const apiNameLabel = typeof ctx.api.name === "string" && ctx.api.name.length > 0 ? ctx.api.name : null;
            const apiPathLabel = typeof apiPath === "string" && apiPath.length > 0 ? apiPath : null;
            const apiLabel = apiNameLabel ? apiNameLabel : apiPathLabel ? apiPathLabel : "未知接口";
            ctx.response = ErrorResponse(ctx, `无权访问 ${apiLabel} 接口`, 1, null, { apiLabel: apiLabel }, "permission");
            return;
        }
    }
};

export default permissionHook;
