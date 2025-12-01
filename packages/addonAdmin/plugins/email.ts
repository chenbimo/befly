/**
 * 邮件插件
 * 提供邮件发送功能，支持 SMTP 配置
 */

import nodemailer from 'nodemailer';

import type { Transporter } from 'nodemailer';
import type { Plugin } from 'befly-core/types/plugin.js';
import type { BeflyContext } from 'befly-core/types/befly.js';

/** 邮件配置 */
export interface EmailConfig {
    /** SMTP 服务器地址 */
    host: string;
    /** SMTP 端口 */
    port: number;
    /** 是否使用 SSL */
    secure: boolean;
    /** 发件人邮箱 */
    user: string;
    /** 邮箱密码或授权码 */
    pass: string;
    /** 发件人名称 */
    fromName?: string;
}

/** 发送邮件参数 */
export interface SendEmailOptions {
    /** 收件人邮箱 */
    to: string;
    /** 邮件主题 */
    subject: string;
    /** 纯文本内容 */
    text?: string;
    /** HTML 内容 */
    html?: string;
    /** 抄送 */
    cc?: string;
    /** 密送 */
    bcc?: string;
    /** 发送人ID */
    adminId?: number;
    /** 发送人账号 */
    username?: string;
    /** 发送人昵称 */
    nickname?: string;
}

/** 发送结果 */
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/** 默认配置 */
const defaultConfig: EmailConfig = {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    fromName: 'Befly System'
};

/**
 * 邮件助手类
 */
class EmailHelper {
    private config: EmailConfig;
    private transporter: Transporter | null = null;
    private befly: BeflyContext;

    constructor(befly: BeflyContext, config: EmailConfig) {
        this.befly = befly;
        this.config = config;

        // 如果配置了邮箱，则创建 transporter
        if (this.config.user && this.config.pass) {
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: {
                    user: this.config.user,
                    pass: this.config.pass
                }
            });
        }
    }

    /**
     * 发送邮件
     */
    async send(options: SendEmailOptions): Promise<SendEmailResult> {
        if (!this.transporter) {
            return {
                success: false,
                error: '邮件服务未配置，请检查 SMTP 配置'
            };
        }

        const fromAddress = this.config.fromName ? `"${this.config.fromName}" <${this.config.user}>` : this.config.user;

        try {
            const info = await this.transporter.sendMail({
                from: fromAddress,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                cc: options.cc,
                bcc: options.bcc
            });

            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || '发送失败'
            };
        }
    }

    /**
     * 发送邮件并记录日志
     */
    async sendAndLog(options: SendEmailOptions): Promise<SendEmailResult> {
        const startTime = Date.now();
        const result = await this.send(options);

        // 记录邮件发送日志
        try {
            await this.befly.db.insData({
                table: 'addon_admin_email_log',
                data: {
                    adminId: options.adminId || 0,
                    username: options.username || '',
                    nickname: options.nickname || '',
                    toEmail: options.to,
                    subject: options.subject,
                    content: options.html || options.text || '',
                    ccEmail: options.cc || '',
                    bccEmail: options.bcc || '',
                    sendTime: startTime,
                    sendResult: result.success ? 1 : 0,
                    messageId: result.messageId || '',
                    failReason: result.error || ''
                }
            });
        } catch (logError: any) {
            this.befly.logger.error({ err: logError }, '记录邮件日志失败');
        }

        return result;
    }

    /**
     * 验证 SMTP 连接
     */
    async verify(): Promise<boolean> {
        if (!this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取当前配置（隐藏密码）
     */
    getConfig(): Omit<EmailConfig, 'pass'> & { pass: string } {
        return {
            ...this.config,
            pass: this.config.pass ? '******' : ''
        };
    }
}

/**
 * 邮件插件
 */
const emailPlugin: Plugin = {
    after: ['db', 'logger', 'config'],
    async handler(befly: BeflyContext): Promise<EmailHelper> {
        // 从 befly.config.addons.admin.email 获取配置
        const addonEmailConfig = befly.config?.addons?.admin?.email || {};
        const emailConfig: EmailConfig = {
            ...defaultConfig,
            ...addonEmailConfig
        };

        return new EmailHelper(befly, emailConfig);
    }
};

export default emailPlugin;
