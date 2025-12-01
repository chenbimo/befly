export default {
    name: '验证邮件配置',
    handler: async (befly, ctx) => {
        const isValid = await befly.email.verify();

        if (isValid) {
            return befly.tool.Yes('邮件服务配置正常');
        }

        return befly.tool.No('邮件服务配置异常，请检查 SMTP 设置');
    }
};
