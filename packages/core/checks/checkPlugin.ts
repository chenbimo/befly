import { Logger } from "../lib/logger";
import { isPlainObject, omit } from "../utils/util";

export async function checkPlugin(plugins: any[]): Promise<void> {
    let hasError = false;

    const coreBuiltinNameRegexp = /^[a-z]+(?:_[a-z]+)*$/;

    for (const plugin of plugins) {
        try {
            if (!isPlainObject(plugin)) {
                Logger.warn(omit(plugin, ["handler"]), "插件导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            // moduleName 必须存在（用于依赖排序与运行时挂载）。
            if (typeof (plugin as any).moduleName !== "string" || (plugin as any).moduleName.trim() === "") {
                Logger.warn(omit(plugin, ["handler"]), "插件的 moduleName 必须是非空字符串（由系统生成，用于 deps 与运行时挂载）");
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

            // core 内置插件：必须来自静态注册（filePath 以 core:plugin: 开头），且 name 必须显式指定并与 moduleName 一致。
            if ((plugin as any).source === "core") {
                const name = typeof (plugin as any).name === "string" ? (plugin as any).name : "";
                if (name === "") {
                    Logger.warn(omit(plugin, ["handler"]), "core 内置插件必须显式设置 name（string），用于确定插件名称");
                    hasError = true;
                    continue;
                }

                // name 必须满足：小写字母 + 下划线（不允许空格、驼峰、数字等）。
                if (!coreBuiltinNameRegexp.test(name)) {
                    Logger.warn(omit(plugin, ["handler"]), "core 内置插件的 name 必须满足小写字母+下划线格式（例如 logger / redis_cache），不允许空格、驼峰或其他字符");
                    hasError = true;
                    continue;
                }

                if (!coreBuiltinNameRegexp.test((plugin as any).moduleName)) {
                    Logger.warn(omit(plugin, ["handler"]), "core 内置插件的 moduleName 必须满足小写字母+下划线格式（由系统生成，且必须与 name 一致）");
                    hasError = true;
                    continue;
                }

                if (name !== (plugin as any).moduleName) {
                    Logger.warn(omit(plugin, ["handler"]), "core 内置插件的 name 必须与 moduleName 完全一致");
                    hasError = true;
                    continue;
                }

                if (typeof (plugin as any).filePath !== "string" || !(plugin as any).filePath.startsWith(`core:plugin:${name}`)) {
                    Logger.warn(omit(plugin, ["handler"]), "core 内置插件必须来自静态注册（filePath 必须以 core:plugin:<name> 开头），不允许通过扫描目录加载");
                    hasError = true;
                    continue;
                }
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
