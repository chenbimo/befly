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

    /** 上传地址（优先使用 VITE_UPLOAD_URL；否则基于 VITE_API_BASE_URL 拼接 /upload） */
    uploadUrl: import.meta.env.VITE_UPLOAD_URL || ((import.meta.env.VITE_API_BASE_URL || "").length > 0 ? `${import.meta.env.VITE_API_BASE_URL}/upload` : "/upload"),
    /** 存储命名空间 */
    storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE || "befly_admin",

    /** 登录页路径（可通过 VITE_LOGIN_PATH 覆盖） */
    loginPath: import.meta.env.VITE_LOGIN_PATH || "/addon/admin/login",

    /** 首页路径（可通过 VITE_HOME_PATH 覆盖） */
    homePath: import.meta.env.VITE_HOME_PATH || "/dashboard",
    /** 是否开发环境 */
    isDev: import.meta.env.DEV,
    /** 是否生产环境 */
    isProd: import.meta.env.PROD
};
