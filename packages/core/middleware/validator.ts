/**
 * 参数验证中间件
 * 验证请求参数是否符合要求
 */

import { Validator } from '../util.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

// 创建全局validator实例
const validator = new Validator();

/**
 * 验证请求参数
 */
export function validateParams(api: ApiRoute, ctx: RequestContext) {
    return validator.validate(ctx.body, api.fields, api.required);
}
