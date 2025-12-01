/**
 * addonAdmin 组件配置覆盖
 * 在此文件中配置 addonAdmin 的自定义参数
 */

export default {
    // 邮件配置
    email: {
        host: 'smtp.qq.com',
        port: 465,
        secure: true,
        user: '', // 发件人邮箱
        pass: '', // 邮箱授权码（非登录密码）
        fromName: 'Befly System'
    }
};
