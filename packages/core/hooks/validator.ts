// 相对导入
import { Validator } from '../lib/validator.js';
import { JsonResponse } from '../util.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 参数验证钩子
 * 根据 API 定义的 fields 和 required 验证请求参数
 */
const hook: Hook = {
    order: 5,
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 无需验证
        if (!ctx.api.fields) {
            return;
        }

        // 验证参数
        const result = Validator.validate(ctx.body, ctx.api.fields, ctx.api.required || []);

        if (result.code !== 0) {
            ctx.response = JsonResponse(ctx, '无效的请求参数格式', 1, result.fields);
            return;
        }
    }
};
export default hook;
