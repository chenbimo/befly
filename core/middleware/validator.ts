/**
 * 参数验证中间件
 * 验证请求参数是否符合要求
 */

import { Validator } from '../utils/validate.js';
import type { ApiRoute } from '../types/api.js';

// 创建全局validator实例
const validator = new Validator();

export interface ValidateContext {
    body: any;
}

/**
 * 验证请求参数
 */
export function validateParams(api: ApiRoute, ctx: ValidateContext) {
    return validator.validate(ctx.body, api.fields, api.required);
}
