/**
 * Befly 共享常量定义
 * 运行时使用的常量（非纯类型）
 */

// ============================================
// API 响应码常量
// ============================================

/**
 * API 响应码
 */
export const ApiCode = {
    /** 成功 */
    SUCCESS: 0,
    /** 通用失败 */
    FAIL: 1,
    /** 未授权 */
    UNAUTHORIZED: 401,
    /** 禁止访问 */
    FORBIDDEN: 403,
    /** 未找到 */
    NOT_FOUND: 404,
    /** 服务器错误 */
    SERVER_ERROR: 500
} as const;

/**
 * API 响应码类型
 */
export type ApiCodeType = (typeof ApiCode)[keyof typeof ApiCode];

// ============================================
// 错误消息常量
// ============================================

/**
 * 通用错误消息
 */
export const ErrorMessages = {
    /** 未授权 */
    UNAUTHORIZED: '请先登录',
    /** 禁止访问 */
    FORBIDDEN: '无访问权限',
    /** 未找到 */
    NOT_FOUND: '资源不存在',
    /** 服务器错误 */
    SERVER_ERROR: '服务器错误',
    /** 参数错误 */
    INVALID_PARAMS: '参数错误',
    /** Token 过期 */
    TOKEN_EXPIRED: 'Token 已过期',
    /** Token 无效 */
    TOKEN_INVALID: 'Token 无效'
} as const;

/**
 * 错误消息类型
 */
export type ErrorMessageType = (typeof ErrorMessages)[keyof typeof ErrorMessages];
