import type { Hook } from '../types/hook.js';
import { Validator } from '../lib/validator.js';
import { No, Yes } from '../response.js';
import type { ApiRoute } from '../types/api.js';
import type { RequestContext } from '../types/context.js';

/**
 * 验证请求参数
 */
function validateParams(api: ApiRoute, ctx: RequestContext) {
    if (!api.fields) {
        return Yes('无需验证');
    }

    const result = Validator.validate(ctx.body, api.fields, api.required || []);

    if (result.code !== 0) {
        return result;
    }

    return Yes('验证通过');
}

const hook: Hook = {
    name: 'validator',
    after: ['parser'],
    handler: async (befly, ctx, next) => {
        if (!ctx.api) return next();

        const validateResult = validateParams(ctx.api, ctx);
        if (validateResult.code !== 0) {
            ctx.response = Response.json(No('无效的请求参数格式', validateResult.fields), {
                headers: ctx.corsHeaders
            });
            return;
        }
        await next();
    }
};
export default hook;
