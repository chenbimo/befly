// 相对导入
import { Validator } from '../lib/validator.js';

// 类型导入
import type { Hook } from '../types/hook.js';

/**
 * 参数验证中间件
 * 根据 API 定义的 fields 和 required 验证请求参数
 */
const hook: Hook = {
    after: ['parser'],
    handler: async (befly, ctx, next) => {
        if (!ctx.api) return next();

        // 无需验证
        if (!ctx.api.fields) {
            return next();
        }

        // 验证参数
        const result = Validator.validate(ctx.body, ctx.api.fields, ctx.api.required || []);

        if (result.code !== 0) {
            ctx.response = Response.json(
                {
                    code: 1,
                    msg: '无效的请求参数格式',
                    data: result.fields
                },
                {
                    headers: ctx.corsHeaders
                }
            );
            return;
        }

        await next();
    }
};
export default hook;
