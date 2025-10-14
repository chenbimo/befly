/**
 * Admin 插件配置
 */

export default {
    // 插件名称
    name: 'admin',

    // 插件描述
    description: '管理后台基础功能',

    // 插件版本
    version: '1.0.0',

    // 是否启用
    enabled: true,

    // 配置选项
    config: {
        // JWT 密钥(建议从环境变量读取)
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',

        // Token 有效期(天)
        tokenExpireDays: 7,

        // 验证码有效期(秒)
        smsCodeExpire: 300,

        // 短信服务配置(需要根据实际使用的服务商配置)
        sms: {
            // 服务商: aliyun, tencent, etc.
            provider: 'aliyun',

            // 访问密钥
            accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
            accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',

            // 短信签名
            signName: '您的签名',

            // 模板代码
            templateCode: 'SMS_123456789'
        }
    }
};
