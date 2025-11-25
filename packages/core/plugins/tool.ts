/**
 * 工具插件
 * 提供常用的工具函数
 */

// 类型导入
import type { Plugin } from '../types/plugin.js';

/**
 * 成功响应
 * @param msg - 消息
 * @param data - 数据（可选）
 * @param other - 其他字段（可选）
 * @returns 成功响应对象
 */
export function Yes(msg: string, data: any = {}, other: Record<string, any> = {}) {
    return {
        code: 0,
        msg: msg,
        data: data,
        ...other
    };
}

/**
 * 失败响应
 * @param msg - 消息
 * @param data - 数据（可选）
 * @param other - 其他字段（可选）
 * @returns 失败响应对象
 */
export function No(msg: string, data: any = null, other: Record<string, any> = {}) {
    return {
        code: 1,
        msg: msg,
        data: data,
        ...other
    };
}

const plugin: Plugin = {
    handler: () => {
        return {
            Yes: Yes,
            No: No
        };
    }
};

export default plugin;
