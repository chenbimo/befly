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

/**
 * 令牌检测响应数据
 */
interface TokenCheckData {
    valid: boolean;
    payload?: JwtPayload;
    expiresIn?: number;
}

export default Api.POST('令牌检测', false, {}, [], async (befly: BeflyContext, ctx: any) => {
    try {
        // 从 Authorization 头获取 token
        const authHeader = ctx.req?.headers?.get('authorization') || '';
        const token = authHeader.split(' ')[1] || '';

        if (!token) {
            return No('令牌不能为空');
        }

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
        befly.logger.error({
            msg: '令牌检测失败',
            error: error.message,
            stack: error.stack
        });

        // 根据错误类型返回不同信息
        if (error.message.includes('expired')) {
            return No('令牌已过期', { expired: true });
        } else if (error.message.includes('invalid')) {
            return No('令牌无效', { invalid: true });
        } else {
            return No('令牌检测失败', { error: error.message });
        }
    }
});
