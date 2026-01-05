import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger";

export async function checkPlugin(plugins: any[]): Promise<void> {
    let hasError = false;

    for (const plugin of plugins) {
        try {
            if (!isPlainObject(plugin)) {
                Logger.warn(omit(plugin, ["handler"]), "插件导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            // enable 必须显式声明且只能为 boolean（true/false），不允许 0/1 等其他类型。
            if (!Object.prototype.hasOwnProperty.call(plugin as any, "enable")) {
                Logger.warn(omit(plugin, ["handler"]), "插件的 enable 属性是必填项，且必须显式声明为 true 或 false");
                hasError = true;
                continue;
            }

            if (typeof (plugin as any).enable !== "boolean") {
                Logger.warn(omit(plugin, ["handler"]), "插件的 enable 属性必须是 boolean（true/false），不允许 0/1 等其他类型");
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
