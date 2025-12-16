export default {
  name: "验证邮件配置",
  handler: async (befly) => {
    if (!(befly as any).addon_admin_email) {
      return befly.tool.No("邮件插件未加载，请检查配置");
    }

    const isValid = await (befly as any).addon_admin_email.verify();

    if (isValid) {
      return befly.tool.Yes("邮件服务配置正常");
    }

    return befly.tool.No("邮件服务配置异常，请检查 SMTP 设置");
  },
};
