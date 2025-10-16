/**
 * 核心保留名称配置
 * 定义框架保留的资源名称，防止用户和 addon 使用
 */

/**
 * 保留名称配置
 */
export const RESERVED_NAMES = {
    /**
     * 核心表前缀（禁止用户使用）
     */
    tablePrefix: ['sys_'],

    /**
     * 核心 API 路由前缀（禁止用户使用）
     */
    apiRoutes: ['/api/health', '/api/tool'],

    /**
     * 核心插件名（禁止用户使用）
     */
    plugins: ['db', 'logger', 'redis', 'tool'],

    /**
     * 禁止用作 addon 名称
     */
    addonNames: ['app', 'api']
} as const;

/**
 * 检测表名是否使用了保留前缀
 */
export function isReservedTableName(tableName: string): boolean {
    return RESERVED_NAMES.tablePrefix.some((prefix) => tableName.startsWith(prefix));
}

/**
 * 检测 API 路由是否使用了保留路径
 */
export function isReservedRoute(route: string): boolean {
    // 移除方法前缀（如 POST/GET）
    const path = route.replace(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\//i, '/');
    return RESERVED_NAMES.apiRoutes.some((reserved) => path.startsWith(reserved));
}

/**
 * 检测插件名是否使用了保留名称
 */
export function isReservedPluginName(pluginName: string): boolean {
    // 检测核心插件名
    if (RESERVED_NAMES.plugins.includes(pluginName)) {
        return true;
    }
    // 检测是否使用点号命名空间但前缀是保留名称
    if (pluginName.includes('.')) {
        const prefix = pluginName.split('.')[0];
        return RESERVED_NAMES.plugins.includes(prefix);
    }
    return false;
}

/**
 * 检测 addon 名称是否使用了保留名称
 */
export function isReservedAddonName(addonName: string): boolean {
    return RESERVED_NAMES.addonNames.includes(addonName.toLowerCase());
}

/**
 * 获取保留前缀列表（用于错误提示）
 */
export function getReservedTablePrefixes(): string[] {
    return [...RESERVED_NAMES.tablePrefix];
}

/**
 * 获取保留路由列表（用于错误提示）
 */
export function getReservedRoutes(): string[] {
    return [...RESERVED_NAMES.apiRoutes];
}

/**
 * 获取保留插件名列表（用于错误提示）
 */
export function getReservedPlugins(): string[] {
    return [...RESERVED_NAMES.plugins];
}

/**
 * 获取保留 addon 名称列表（用于错误提示）
 */
export function getReservedAddonNames(): string[] {
    return [...RESERVED_NAMES.addonNames];
}
