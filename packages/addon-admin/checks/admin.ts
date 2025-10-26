/**
 * Admin Addon 启动检查
 * 验证组件配置和依赖
 */

import { util } from 'befly';

export default async function (): Promise<boolean> {
    try {
        // 检查组件是否启用
        const adminEnable = process.env.ADMIN_ENABLE;

        if (adminEnable === 'false') {
            util.Logger.info('[Admin] 组件已禁用');
            return true;
        }

        // 检查 JWT 密钥配置
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            util.Logger.warn('[Admin] 未配置 JWT_SECRET 环境变量，将使用默认密钥（不建议用于生产环境）');
        }

        // 检查短信服务配置
        const smsProvider = process.env.SMS_PROVIDER;
        if (!smsProvider) {
            util.Logger.info('[Admin] 未配置短信服务，手机登录功能将使用测试验证码');
        }

        util.Logger.info('[Admin] 组件检查通过');
        return true;
    } catch (error: any) {
        util.Logger.error('[Admin] 组件检查失败:', error);
        return false;
    }
}
