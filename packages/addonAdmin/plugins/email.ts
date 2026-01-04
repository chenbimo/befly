/**
 * 邮件插件
 * 提供邮件发送功能，支持 SMTP 配置
 */

import type { EmailConfig } from "../libs/emailHelper.ts";

import { EmailHelper } from "../libs/emailHelper.ts";

/** 默认配置 */
const defaultConfig: EmailConfig = {
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    user: "",
    pass: "",
    fromName: "Befly System"
};

export default {
    deps: ["db", "logger", "config"],
    async handler(befly): Promise<EmailHelper> {
        // 从 befly.config.addons.admin.email 获取配置
        const addonEmailConfig = befly.config?.addons?.admin?.email || {};
        const emailConfig: EmailConfig = {
            ...defaultConfig,
            ...addonEmailConfig
        };

        return new EmailHelper(befly, emailConfig);
    }
};
