/**
 * 退出登录接口
 */

import { Yes } from '../../util.js';

export default {
    name: '退出登录',
    handler: async (befly, ctx) => {
        // JWT token 是无状态的,前端删除 token 即可
        // 如果需要实现 token 黑名单,可以在这里将 token 加入 Redis 黑名单

        const token = ctx.headers.authorization?.replace('Bearer ', '');

        if (token && befly.redis) {
            // 将 token 加入黑名单,有效期设置为 token 的剩余有效期
            const key = `token_blacklist:${token}`;
            await befly.redis.set(key, '1', 'EX', 7 * 24 * 60 * 60); // 7天
        }

        return Yes('退出成功');
    }
};
