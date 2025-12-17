import emailLogTable from "../../tables/emailLog.json";

export default {
    name: "发送邮件",
    fields: {
        to: emailLogTable.toEmail,
        subject: emailLogTable.subject,
        content: {
            name: "邮件内容",
            type: "string",
            min: 1,
            max: 50000
        },
        cc: emailLogTable.ccEmail,
        bcc: emailLogTable.bccEmail,
        isHtml: {
            name: "是否HTML",
            type: "boolean",
            default: true
        }
    },
    required: ["to", "subject", "content"],
    handler: async (befly, ctx) => {
        if (!(befly as any).addon_admin_email) {
            return befly.tool.No("邮件插件未加载，请检查配置");
        }

        const startTime = Date.now();

        // 发送邮件
        const result = await (befly as any).addon_admin_email.send({
            to: ctx.body.to,
            subject: ctx.body.subject,
            html: ctx.body.isHtml ? ctx.body.content : undefined,
            text: ctx.body.isHtml ? undefined : ctx.body.content,
            cc: ctx.body.cc || undefined,
            bcc: ctx.body.bcc || undefined
        });

        // 记录邮件发送日志
        try {
            await befly.db.insData({
                table: "addon_admin_email_log",
                data: {
                    adminId: ctx.user?.id || 0,
                    username: ctx.user?.username || "",
                    nickname: ctx.user?.nickname || "",
                    toEmail: ctx.body.to,
                    subject: ctx.body.subject,
                    content: ctx.body.content,
                    ccEmail: ctx.body.cc || "",
                    bccEmail: ctx.body.bcc || "",
                    sendTime: startTime,
                    sendResult: result.success ? 1 : 0,
                    messageId: result.messageId || "",
                    failReason: result.error || ""
                }
            });
        } catch (logError: any) {
            befly.logger.error({ err: logError }, "记录邮件日志失败");
        }

        if (result.success) {
            return befly.tool.Yes("发送成功", { messageId: result.messageId });
        }

        return befly.tool.No(result.error || "发送失败");
    }
};
