/**
 * Befly 共享常量定义
 * 运行时使用的常量（非纯类型）
 */
/**
 * API 响应码
 */
export declare const ApiCode: {
    /** 成功 */
    readonly SUCCESS: 0;
    /** 通用失败 */
    readonly FAIL: 1;
    /** 未授权 */
    readonly UNAUTHORIZED: 401;
    /** 禁止访问 */
    readonly FORBIDDEN: 403;
    /** 未找到 */
    readonly NOT_FOUND: 404;
    /** 服务器错误 */
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
    /** 未授权 */
    readonly UNAUTHORIZED: '请先登录';
    /** 禁止访问 */
    readonly FORBIDDEN: '无访问权限';
    /** 未找到 */
    readonly NOT_FOUND: '资源不存在';
    /** 服务器错误 */
    readonly SERVER_ERROR: '服务器错误';
    /** 参数错误 */
    readonly INVALID_PARAMS: '参数错误';
    /** Token 过期 */
    readonly TOKEN_EXPIRED: 'Token 已过期';
    /** Token 无效 */
    readonly TOKEN_INVALID: 'Token 无效';
};
/**
 * 错误消息类型
 */
export type ErrorMessageType = (typeof ErrorMessages)[keyof typeof ErrorMessages];
