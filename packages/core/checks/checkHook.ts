import { Logger } from "../lib/logger";
import { isPlainObject, omit } from "../utils/util";

export async function checkHook(hooks: any[]): Promise<void> {
    let hasError = false;

    // 说明：hooks 实际是 scanFiles/scanSources 的结果对象（包含元信息字段）。
    // 为避免“写错字段但被静默忽略”，对钩子对象做严格字段白名单校验。
    // 注意：白名单包含 scanFiles 生成的元字段；对外导出仅允许：name/enable/deps/handler。
    const metaKeys = ["source", "type", "sourceName", "filePath", "relativePath", "fileName", "moduleName", "addonName", "fileBaseName", "fileDir"];
    const exportKeys = ["name", "enable", "deps", "handler"];
    const allowedKeySet = new Set<string>([...metaKeys, ...exportKeys]);
    const allowedExportKeyText = exportKeys.join(", ");

    const coreBuiltinNameRegexp = /^[a-z]+(?:_[a-z]+)*$/;

    for (const hook of hooks) {
        try {
            if (!isPlainObject(hook)) {
                Logger.warn(omit(hook, ["handler"]), "钩子导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            // moduleName 必须存在（用于依赖排序与运行时挂载）。
            if (typeof (hook as any).moduleName !== "string" || (hook as any).moduleName.trim() === "") {
                Logger.warn(omit(hook, ["handler"]), "钩子的 moduleName 必须是非空字符串（由系统生成，用于 deps 与运行时挂载）");
                hasError = true;
                continue;
            }

            // 严格字段校验：出现任何未支持字段都应视为错误（避免静默忽略导致依赖顺序/行为误判）。
            const keys = Object.keys(hook as any);
            const unknownKeys = keys.filter((k) => !allowedKeySet.has(k));
            if (unknownKeys.length > 0) {
                Logger.warn(omit(hook, ["handler"]), `钩子导出存在不支持的属性：${unknownKeys.join(", ")}；仅允许：${allowedExportKeyText}`);
                hasError = true;
                continue;
            }

            // enable 必须显式声明且只能为 boolean（true/false），不允许 0/1 等其他类型。
            if (!Object.prototype.hasOwnProperty.call(hook as any, "enable")) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 enable 属性是必填项，且必须显式声明为 true 或 false");
                hasError = true;
                continue;
            }

            if (typeof (hook as any).enable !== "boolean") {
                Logger.warn(omit(hook, ["handler"]), "钩子的 enable 属性必须是 boolean（true/false），不允许 0/1 等其他类型");
                hasError = true;
                continue;
            }

            // core 内置钩子：必须来自静态注册（filePath 以 core:hook: 开头），且 name 必须显式指定并与 moduleName 一致。
            if ((hook as any).source === "core") {
                const name = typeof (hook as any).name === "string" ? (hook as any).name : "";
                if (name === "") {
                    Logger.warn(omit(hook, ["handler"]), "core 内置钩子必须显式设置 name（string），用于确定钩子名称");
                    hasError = true;
                    continue;
                }

                // name 必须满足：小写字母 + 下划线（不允许空格、驼峰、数字等）。
                if (!coreBuiltinNameRegexp.test(name)) {
                    Logger.warn(omit(hook, ["handler"]), "core 内置钩子的 name 必须满足小写字母+下划线格式（例如 auth / rate_limit），不允许空格、驼峰或其他字符");
                    hasError = true;
                    continue;
                }

                if (!coreBuiltinNameRegexp.test((hook as any).moduleName)) {
                    Logger.warn(omit(hook, ["handler"]), "core 内置钩子的 moduleName 必须满足小写字母+下划线格式（由系统生成，且必须与 name 一致）");
                    hasError = true;
                    continue;
                }

                if (name !== (hook as any).moduleName) {
                    Logger.warn(omit(hook, ["handler"]), "core 内置钩子的 name 必须与 moduleName 完全一致");
                    hasError = true;
                    continue;
                }

                if (typeof (hook as any).filePath !== "string" || !(hook as any).filePath.startsWith(`core:hook:${name}`)) {
                    Logger.warn(omit(hook, ["handler"]), "core 内置钩子必须来自静态注册（filePath 必须以 core:hook:<name> 开头），不允许通过扫描目录加载");
                    hasError = true;
                    continue;
                }
            }

            if (!Array.isArray((hook as any).deps)) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
                continue;
            }

            if ((hook as any).deps.some((depItem: any) => typeof depItem !== "string")) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
            }

            if (typeof (hook as any).handler !== "function") {
                Logger.warn(omit(hook, ["handler"]), "钩子的 handler 属性必须是函数");
                hasError = true;
                continue;
            }
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    item: hook
                },
                "钩子解析失败"
            );
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("钩子结构检查失败");
    }
}
