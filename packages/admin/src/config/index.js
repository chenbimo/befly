/**
 * 内部配置
 * 存放框架内置的配置变量，不建议修改
 */

/**
 * 内置配置对象
 */
export const $Config = {
    /** 应用标题 */
    appTitle: import.meta.env.VITE_APP_TITLE || "野蜂飞舞",
    /** API 基础地址 */
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
    /** 存储命名空间 */
    storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE || "befly_admin",
    /** 是否开发环境 */
    isDev: import.meta.env.DEV,
    /** 是否生产环境 */
    isProd: import.meta.env.PROD
};
