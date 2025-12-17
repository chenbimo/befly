/**
 * 标准化接口权限路径（用于写入/读取权限缓存时保持一致）
 * 规则（简化版）：method 大写；path 为空则为 '/'；确保以 '/' 开头
 * 说明：当前框架内 api.path 来源于目录结构生成、请求侧使用 URL.pathname，默认不包含 query/hash，且不期望出现尾部斜杠等异常输入。
 */
export function normalizeApiPath(method: string, path: string): string {
    const normalizedMethod = (method || "").toUpperCase();
    let normalizedPath = path || "/";

    if (!normalizedPath.startsWith("/")) {
        normalizedPath = "/" + normalizedPath;
    }

    return `${normalizedMethod}${normalizedPath}`;
}

/**
 * 生成路由 Key（用于路由匹配 / 权限缓存 / 日志等场景统一使用）
 * 格式：METHOD/path
 */
export function makeRouteKey(method: string, pathname: string): string {
    return normalizeApiPath(method, pathname);
}
