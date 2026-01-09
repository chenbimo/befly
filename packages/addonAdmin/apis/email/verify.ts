import type { ApiRoute } from "befly/types/api";

import { getAddonAdminEmailPlugin } from "./_emailPlugin";

const route: ApiRoute = {
    name: "验证邮件配置",
    handler: async (befly) => {
        const emailPlugin = getAddonAdminEmailPlugin(befly);
        if (!emailPlugin) {
            return befly.tool.No("邮件插件未加载，请检查配置");
        }

        const isValid = await emailPlugin.verify();

        if (isValid) {
            return befly.tool.Yes("邮件服务配置正常");
        }

        return befly.tool.No("邮件服务配置异常，请检查 SMTP 设置");
    }
};

export default route;
