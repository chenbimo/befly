import type { ApiRoute } from "befly/types/api";

import { getAddonAdminEmailPlugin } from "./_emailPlugin";

const route: ApiRoute = {
    name: "获取邮件配置",
    handler: async (befly) => {
        const emailPlugin = getAddonAdminEmailPlugin(befly);
        if (!emailPlugin) {
            return befly.tool.No("邮件插件未加载，请检查配置");
        }

        const config = emailPlugin.getConfig();

        return befly.tool.Yes("获取成功", {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            pass: config.pass,
            fromName: config.fromName,
            configured: Boolean(config.user)
        });
    }
};

export default route;
