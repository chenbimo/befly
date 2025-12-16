export default {
  name: "获取邮件配置",
  handler: async (befly) => {
    if (!(befly as any).addon_admin_email) {
      return befly.tool.No("邮件插件未加载，请检查配置");
    }

    const config = (befly as any).addon_admin_email.getConfig();

    return befly.tool.Yes("获取成功", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromName: config.fromName,
      configured: !!config.user,
    });
  },
};
