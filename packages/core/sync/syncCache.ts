import type { BeflyContext } from "../types/befly";

export async function syncCache(ctx: Pick<BeflyContext, "cache">): Promise<void> {
    if (!ctx.cache) {
        throw new Error("syncCache: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    }

    // 1) 缓存接口列表
    await ctx.cache.cacheApis();

    // 2) 缓存菜单列表
    await ctx.cache.cacheMenus();

    // 3) 重建角色权限缓存（严格模式下要求 role.apis 必须为 pathname 字符串数组）
    await ctx.cache.rebuildRoleApiPermissions();
}
