export default {
    name: '获取邮件配置',
    handler: async (befly, ctx) => {
        const config = befly.email.getConfig();

        return befly.tool.Yes('获取成功', {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            pass: config.pass,
            fromName: config.fromName,
            configured: !!config.user
        });
    }
};
