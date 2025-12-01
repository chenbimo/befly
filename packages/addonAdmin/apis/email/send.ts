import emailLogTable from '../../tables/emailLog.json';

export default {
    name: '发送邮件',
    fields: {
        to: emailLogTable.toEmail,
        subject: emailLogTable.subject,
        content: {
            name: '邮件内容',
            type: 'string',
            min: 1,
            max: 50000
        },
        cc: emailLogTable.ccEmail,
        bcc: emailLogTable.bccEmail,
        isHtml: {
            name: '是否HTML',
            type: 'boolean',
            default: true
        }
    },
    required: ['to', 'subject', 'content'],
    handler: async (befly, ctx) => {
        const result = await befly.email.sendAndLog({
            adminId: ctx.user?.id || 0,
            username: ctx.user?.username || '',
            nickname: ctx.user?.nickname || '',
            to: ctx.body.to,
            subject: ctx.body.subject,
            html: ctx.body.isHtml ? ctx.body.content : undefined,
            text: ctx.body.isHtml ? undefined : ctx.body.content,
            cc: ctx.body.cc || undefined,
            bcc: ctx.body.bcc || undefined
        });

        if (result.success) {
            return befly.tool.Yes('发送成功', { messageId: result.messageId });
        }

        return befly.tool.No(result.error || '发送失败');
    }
};
