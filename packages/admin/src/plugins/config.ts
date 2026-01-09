/**
 * 内部配置
 * 存放框架内置的配置变量，不建议修改
 */

export type BeflyAdminConfig = {
    appTitle: string;
    apiBaseUrl: string;
    uploadUrl: string;
    storageNamespace: string;
    loginPath: string;
    homePath: string;
    isDev: boolean;
    isProd: boolean;
};

/**
 * 内置配置对象
 */
export const $Config: BeflyAdminConfig = {
    appTitle: import.meta.env.VITE_APP_TITLE || "野蜂飞舞",
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",

    uploadUrl: import.meta.env.VITE_UPLOAD_URL || ((import.meta.env.VITE_API_BASE_URL || "").length > 0 ? `${import.meta.env.VITE_API_BASE_URL}/upload` : "/upload"),
    storageNamespace: import.meta.env.VITE_STORAGE_NAMESPACE || "befly_admin",

    loginPath: import.meta.env.VITE_LOGIN_PATH || "/addon/admin/login",
    homePath: import.meta.env.VITE_HOME_PATH || "/addon/admin",
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD
};
