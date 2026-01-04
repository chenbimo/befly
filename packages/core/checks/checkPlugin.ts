import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger.ts";

export async function checkPlugin(plugins: any[]): Promise<void> {
    let hasError = false;

    for (const plugin of plugins) {
        try {
            if (!isPlainObject(plugin)) {
                Logger.warn(omit(plugin, ["handler"]), "插件导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            if (!Array.isArray((plugin as any).deps)) {
                Logger.warn(omit(plugin, ["handler"]), "插件的 deps 属性必须是字符串数组");
                hasError = true;
                continue;
            }

            if ((plugin as any).deps.some((depItem: any) => typeof depItem !== "string")) {
                Logger.warn(omit(plugin, ["handler"]), "插件的 deps 属性必须是字符串数组");
                hasError = true;
            }

            if (typeof (plugin as any).handler !== "function") {
                Logger.warn(omit(plugin, ["handler"]), "插件的 handler 属性必须是函数");
                hasError = true;
                continue;
            }
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    item: plugin
                },
                "插件解析失败"
            );
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("插件结构检查失败");
    }
}
