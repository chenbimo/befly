/**
 * 邮件助手类
 * 提供邮件发送功能，支持 SMTP 配置
 */

import type { BeflyContext } from "befly/types/befly.js";
import type { Transporter } from "nodemailer";

import nodemailer from "nodemailer";

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
}

/** 发送结果 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 邮件助手类
 */
export class EmailHelper {
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
          pass: this.config.pass,
        },
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
        error: "邮件服务未配置，请检查 SMTP 配置",
      };
    }

    const fromAddress = this.config.fromName
      ? `"${this.config.fromName}" <${this.config.user}>`
      : this.config.user;

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "发送失败",
      };
    }
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
  getConfig(): Omit<EmailConfig, "pass"> & { pass: string } {
    return {
      ...this.config,
      pass: this.config.pass ? "******" : "",
    };
  }
}
