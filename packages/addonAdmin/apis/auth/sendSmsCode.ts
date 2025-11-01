/**
 * 发送短信验证码接口
 */

import { Yes } from 'befly';
import { Env } from '../../env.js';
import adminTable from '../../tables/admin.json';

export default {
    name: '发送短信验证码',
    auth: false,
    fields: {
        phone: adminTable.phone
    },
    required: ['phone'],
    handler: async (befly, ctx) => {
        // 生成6位数验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // TODO: 调用短信服务发送验证码
        // 这里需要集成实际的短信服务提供商(如阿里云、腾讯云等)
        // await smsService.send(phone, code);

        // 将验证码存储到 Redis 中,有效期5分钟
        // 如果项目没有 Redis,也可以存储到数据库中
        if (befly.redis) {
            const key = `sms_code:${ctx.body.phone}`;
            await befly.redis.set(key, code, 'EX', 300); // 5分钟过期
        }

        // 开发环境下返回验证码(生产环境应该删除)
        const isDev = Env.NODE_ENV === 'development';

        return Yes('验证码已发送', isDev ? { code } : null);
    }
};
