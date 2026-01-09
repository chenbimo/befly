import { Logger } from "../lib/logger";
import { isPlainObject, omit } from "../utils/util";

const exportKeys: readonly string[] = ["name", "enable", "deps", "handler"];

export async function checkHook(hooks: any[]): Promise<void> {
    let hasError = false;

    // 说明：hooks 实际是 scanFiles/scanSources 的结果对象（包含元信息字段）。
    // 这里不再对白名单枚举 metaKeys（因为它们是系统生成的），只校验“用户 default export 导出的字段”。
    const coreBuiltinNameRegexp = /^[a-z]+(?:_[a-z]+)*$/;

    for (const hook of hooks) {
        try {
            if (!isPlainObject(hook)) {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子导出必须是对象（export default { deps, handler }）" }));
                hasError = true;
                continue;
            }

            const record = hook as Record<string, unknown>;

            // moduleName 必须存在（用于依赖排序与运行时挂载）。
            const moduleName = record["moduleName"];
            if (typeof moduleName !== "string" || moduleName.trim() === "") {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 moduleName 必须是非空字符串（由系统生成，用于 deps 与运行时挂载）" }));
                hasError = true;
                continue;
            }

            const customKeys = record["customKeys"];
            if (!Array.isArray(customKeys)) {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子扫描结果缺少 customKeys（无法判断用户导出的字段是否合法）" }));
                hasError = true;
                continue;
            }

            if (customKeys.some((k: any) => typeof k !== "string")) {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 customKeys 必须是 string[]（由系统生成）" }));
                hasError = true;
                continue;
            }

            // 严格字段校验：仅检查用户 default export 的字段集合，出现任何未支持字段都应视为错误。
            const unknownCustomKeys = (customKeys as string[]).filter((k) => !exportKeys.includes(k));
            if (unknownCustomKeys.length > 0) {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: `钩子导出存在不支持的属性：${unknownCustomKeys.join(", ")}；仅允许：${exportKeys.join(", ")}；当前 customKeys：${(customKeys as string[]).join(", ")}` }));
                hasError = true;
                continue;
            }

            const hasCustomEnable = (customKeys as string[]).includes("enable");
            const hasCustomDeps = (customKeys as string[]).includes("deps");

            // enable 必须显式声明且只能为 boolean（true/false），不允许 0/1 等其他类型。
            // - 允许缺省：由系统在此处补全默认值 true
            // - 若用户显式导出 enable：必须是 boolean
            if (hasCustomEnable) {
                const enable = record["enable"];
                if (typeof enable !== "boolean") {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 enable 属性必须是 boolean（true/false），不允许 0/1 等其他类型" }));
                    hasError = true;
                    continue;
                }
            } else {
                record["enable"] = true;
            }

            // core 内置钩子：必须来自静态注册（filePath 以 core:hook: 开头），且 name 必须显式指定并与 moduleName 一致。
            if (record["source"] === "core") {
                const name = typeof record["name"] === "string" ? (record["name"] as string) : "";
                if (name === "") {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "core 内置钩子必须显式设置 name（string），用于确定钩子名称" }));
                    hasError = true;
                    continue;
                }

                // name 必须满足：小写字母 + 下划线（不允许空格、驼峰、数字等）。
                if (!coreBuiltinNameRegexp.test(name)) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "core 内置钩子的 name 必须满足小写字母+下划线格式（例如 auth / rate_limit），不允许空格、驼峰或其他字符" }));
                    hasError = true;
                    continue;
                }

                if (!coreBuiltinNameRegexp.test(String(record["moduleName"]))) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "core 内置钩子的 moduleName 必须满足小写字母+下划线格式（由系统生成，且必须与 name 一致）" }));
                    hasError = true;
                    continue;
                }

                if (name !== String(record["moduleName"])) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "core 内置钩子的 name 必须与 moduleName 完全一致" }));
                    hasError = true;
                    continue;
                }

                const filePath = record["filePath"];
                if (typeof filePath !== "string" || !filePath.startsWith(`core:hook:${name}`)) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "core 内置钩子必须来自静态注册（filePath 必须以 core:hook:<name> 开头），不允许通过扫描目录加载" }));
                    hasError = true;
                    continue;
                }
            }

            // deps：允许缺省（补全为 []），但如果用户显式导出 deps，则必须是 string[]。
            if (hasCustomDeps) {
                const deps = record["deps"];
                if (!Array.isArray(deps)) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 deps 属性必须是字符串数组" }));
                    hasError = true;
                    continue;
                }

                if ((deps as unknown[]).some((depItem) => typeof depItem !== "string")) {
                    Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 deps 属性必须是字符串数组" }));
                    hasError = true;
                    continue;
                }
            } else {
                const deps = record["deps"];
                if (!Array.isArray(deps)) {
                    record["deps"] = [];
                }
            }

            if (typeof record["handler"] !== "function") {
                Logger.warn(Object.assign({}, omit(hook, ["handler"]), { msg: "钩子的 handler 属性必须是函数" }));
                hasError = true;
                continue;
            }
        } catch (error: unknown) {
            Logger.error({ err: error, item: hook, msg: "钩子解析失败" });
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("钩子结构检查失败");
    }
}
