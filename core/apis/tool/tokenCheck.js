import { Env } from '../../config/env.js';
import { Api } from '../../utils/api.js';
import { Yes, No } from '../../utils/index.js';
import { Jwt } from '../../utils/jwt.js';

export default Api.POST(
    //
    '令牌检测',
    false,
    {},
    [],
    async (befly, ctx) => {
        try {
            const token = ctx.headers?.authorization?.split(' ')[1] || '';
            if (!token) {
                return No('令牌不能为空');
            }
            const jwtData = await Jwt.verify(token);
            return Yes('令牌有效');
        } catch (error) {
            befly.logger.error({
                msg: '令牌检测失败',
                error: error.message,
                stack: error.stack
            });
            return No('令牌检测失败');
        }
    }
);
