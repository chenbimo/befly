/**
 * Befly 共享常量类型定义
 */

/**
 * API 响应码
 */
export declare const ApiCode: {
    readonly SUCCESS: 0;
    readonly FAIL: 1;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly SERVER_ERROR: 500;
};

/**
 * API 响应码类型
 */
export type ApiCodeType = (typeof ApiCode)[keyof typeof ApiCode];

/**
 * 通用错误消息
 */
export declare const ErrorMessages: {
    readonly UNAUTHORIZED: '请先登录';
    readonly FORBIDDEN: '无访问权限';
    readonly NOT_FOUND: '资源不存在';
    readonly SERVER_ERROR: '服务器错误';
    readonly INVALID_PARAMS: '参数错误';
    readonly TOKEN_EXPIRED: 'Token 已过期';
    readonly TOKEN_INVALID: 'Token 无效';
};

/**
 * 错误消息类型
 */
export type ErrorMessageType = (typeof ErrorMessages)[keyof typeof ErrorMessages];
