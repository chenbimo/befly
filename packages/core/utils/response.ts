/**
 * Befly API 响应工具
 * 提供统一的成功和失败响应格式
 */

import type { KeyValue } from '../types/common.js';

/**
 * 成功响应
 * @param msg - 响应消息
 * @param data - 响应数据
 * @param other - 其他字段
 * @returns 成功响应对象 { code: 0, msg, data, ...other }
 */
export const Yes = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 0; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

/**
 * 失败响应
 * @param msg - 错误消息
 * @param data - 错误数据
 * @param other - 其他字段
 * @returns 失败响应对象 { code: 1, msg, data, ...other }
 */
export const No = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 1; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 1,
        msg: msg,
        data: data
    };
};
