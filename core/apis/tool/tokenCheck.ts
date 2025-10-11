/**
 * 令牌检测接口 - TypeScript 版本
 * 验证 JWT 令牌是否有效
 */

import { Env } from '../../config/env.js';
import { Api } from '../../utils/api.js';
import { Yes, No } from '../../utils/index.js';
import { Jwt } from '../../utils/jwt.js';
import type { BeflyContext } from '../../types/befly.js';
import type { JwtPayload } from '../../utils/jwt.js';
import type { TokenCheckData } from '../../types/api.js';

export default Api('令牌检测', {
    method: 'POST',
    auth: false,
    fields: {},
    required: [],
    handler: async (befly: BeflyContext, ctx: any) => {
        // 从 Authorization 头获取 token
        const authHeader = ctx.req?.headers?.get('authorization') || '';
        const token = authHeader.split(' ')[1] || '';

        if (!token) {
            return No('令牌不能为空');
        }

        try {
            // 验证令牌
            const jwtData = await Jwt.verify(token);

            // 计算剩余有效期
            const expiresIn = jwtData.exp ? jwtData.exp - Math.floor(Date.now() / 1000) : undefined;

            const data: TokenCheckData = {
                valid: true,
                payload: jwtData,
                expiresIn
            };

            return Yes('令牌有效', data);
        } catch (error: any) {
            // 针对预期的令牌错误，返回友好提示（非致命错误）
            if (error.message.includes('expired')) {
                return No('令牌已过期', { expired: true });
            } else if (error.message.includes('invalid')) {
                return No('令牌无效', { invalid: true });
            }
            // 其他未知错误向上抛出，由路由层统一处理
            throw error;
        }
    }
});
