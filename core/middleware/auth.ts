/**
 * JWT 认证中间件
 * 处理用户身份验证
 */

import { Jwt } from '../utils/jwt.js';
import type { RequestContext } from '../types/context.js';

/**
 * 从请求头中提取并验证JWT token
 */
export async function authenticate(ctx: RequestContext): Promise<void> {
    const authHeader = ctx.header('authorization');

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
}
