import type { Hook } from '../types/hook.js';
import { Jwt } from '../lib/jwt.js';

const hook: Hook = {
    after: ['cors'],
    handler: async (befly, ctx, next) => {
        // 初始化配置（如果有）
        // 注意：Hook 没有 onInit，如果需要初始化，可以在 handler 首次执行时做，或者保留 Plugin 机制专门做初始化
        // 这里 auth 插件原本有 onInit 来配置 Jwt，现在需要迁移
        // 临时方案：直接在 handler 里判断是否配置过，或者让 Jwt 自身处理配置

        const authHeader = ctx.request.headers.get('authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                const payload = await Jwt.verify(token);
                ctx.user = payload;
            } catch (error: any) {
                ctx.user = {};
            }
        } else {
            ctx.user = {};
        }
        await next();
    }
};
export default hook;
